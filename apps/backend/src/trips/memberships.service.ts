import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PostHogService } from '../posthog/posthog.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripMemberRole } from '../shared/constants/enums';
import { JoinTripDto } from './dto/join-trip.dto';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly posthog: PostHogService,
  ) {}

  async requestJoin(tripId: string, userId: string, dto: JoinTripDto) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        status: true,
        organizerId: true,
        currentMembers: true,
        maxMembers: true,
      },
    });
    if (!trip) throw new NotFoundException('TRIP_NOT_FOUND');
    if (trip.organizerId === userId) {
      throw new BadRequestException('ALREADY_ORGANIZER');
    }
    if (trip.status !== 'PUBLISHED') {
      throw new BadRequestException('TRIP_NOT_OPEN_FOR_JOIN');
    }

    const existing = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId } },
      select: { id: true, role: true, leftAt: true },
    });

    if (existing) {
      if (existing.role === 'PENDING') {
        throw new ConflictException('ALREADY_PENDING');
      }
      if (existing.role === 'MEMBER' && !existing.leftAt) {
        throw new ConflictException('ALREADY_MEMBER');
      }
      // Previously left: reset to PENDING for re-request (PRD §12)
      return this.prisma.tripMembership.update({
        where: { id: existing.id },
        data: {
          role: 'PENDING',
          joinedAt: null,
          leftAt: null,
          requestMessage: dto.requestMessage ?? null,
        },
        select: membershipPublicSelect,
      });
    }

    const membership = await this.prisma.tripMembership.create({
      data: {
        trip: { connect: { id: tripId } },
        user: { connect: { id: userId } },
        role: 'PENDING',
        requestMessage: dto.requestMessage ?? null,
      },
      select: membershipPublicSelect,
    });

    await this.notifications.create(trip.organizerId, 'JOIN_REQUEST_RECEIVED', {
      tripId,
      membershipId: membership.id,
      requesterId: userId,
    });

    this.posthog.capture({
      distinctId: userId,
      event: 'join_requested',
      properties: { trip_id: tripId, membership_id: membership.id },
    });

    return membership;
  }

  async approve(membershipId: string, callerId: string) {
    const membership = await this.findMembershipWithTrip(membershipId);
    if (membership.trip.organizerId !== callerId) {
      throw new ForbiddenException('NOT_ORGANIZER');
    }
    if (membership.role !== 'PENDING') {
      throw new BadRequestException('NOT_PENDING');
    }
    if (membership.trip.status === 'FULL') {
      throw new BadRequestException('TRIP_FULL');
    }
    if (membership.trip.status !== 'PUBLISHED') {
      throw new BadRequestException('TRIP_NOT_OPEN');
    }
    if (membership.trip.currentMembers >= membership.trip.maxMembers) {
      throw new BadRequestException('TRIP_FULL');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const newCount = membership.trip.currentMembers + 1;
      const nextStatus =
        newCount >= membership.trip.maxMembers ? 'FULL' : 'PUBLISHED';

      const m = await tx.tripMembership.update({
        where: { id: membership.id },
        data: { role: 'MEMBER', joinedAt: new Date() },
        select: membershipPublicSelect,
      });

      await tx.trip.update({
        where: { id: membership.trip.id },
        data: { currentMembers: newCount, status: nextStatus },
      });

      return m;
    });

    await this.notifications.create(updated.userId, 'JOIN_REQUEST_APPROVED', {
      tripId: membership.trip.id,
      membershipId: membership.id,
    });

    this.posthog.capture({
      distinctId: callerId,
      event: 'join_approved',
      properties: {
        trip_id: membership.trip.id,
        membership_id: membership.id,
        approved_user_id: updated.userId,
      },
    });

    return updated;
  }

  async reject(membershipId: string, callerId: string) {
    const membership = await this.findMembershipWithTrip(membershipId);
    if (membership.trip.organizerId !== callerId) {
      throw new ForbiddenException('NOT_ORGANIZER');
    }
    if (membership.role !== 'PENDING') {
      throw new BadRequestException('NOT_PENDING');
    }
    // capture userId before delete cascades the membership row
    const targetUserId = await this.prisma.tripMembership
      .findUnique({ where: { id: membership.id }, select: { userId: true } })
      .then((m) => m?.userId);
    await this.prisma.tripMembership.delete({
      where: { id: membership.id },
    });
    if (targetUserId) {
      await this.notifications.create(targetUserId, 'JOIN_REQUEST_REJECTED', {
        tripId: membership.trip.id,
      });
    }
  }

  async leave(tripId: string, userId: string) {
    const membership = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId } },
      select: {
        id: true,
        role: true,
        leftAt: true,
        trip: {
          select: {
            id: true,
            status: true,
            currentMembers: true,
            maxMembers: true,
          },
        },
      },
    });
    if (!membership || membership.leftAt) {
      throw new NotFoundException('MEMBERSHIP_NOT_FOUND');
    }
    if (membership.role === 'ORGANIZER') {
      throw new BadRequestException('ORGANIZER_CANNOT_LEAVE');
    }
    if (membership.role === 'PENDING') {
      // PENDING never "joined" — same as rejection from user side
      await this.prisma.tripMembership.delete({
        where: { id: membership.id },
      });
      return;
    }

    return this.prisma.$transaction(async (tx) => {
      const newCount = Math.max(0, membership.trip.currentMembers - 1);
      const nextStatus =
        membership.trip.status === 'FULL' ? 'PUBLISHED' : membership.trip.status;

      await tx.tripMembership.update({
        where: { id: membership.id },
        data: { leftAt: new Date() },
      });

      await tx.trip.update({
        where: { id: membership.trip.id },
        data: { currentMembers: newCount, status: nextStatus },
      });
    });
  }

  async listForTrip(tripId: string, callerId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { id: true, organizerId: true },
    });
    if (!trip) throw new NotFoundException('TRIP_NOT_FOUND');

    const callerMembership = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId: callerId } },
      select: { role: true, leftAt: true },
    });

    const isOrganizer = trip.organizerId === callerId;
    const isMember =
      callerMembership?.role === 'MEMBER' && !callerMembership.leftAt;

    if (!isOrganizer && !isMember) {
      throw new ForbiddenException('NOT_TRIP_PARTICIPANT');
    }

    // Organizer sees PENDING + MEMBER + ORGANIZER. Member sees only MEMBER + ORGANIZER.
    const where = isOrganizer
      ? { tripId, leftAt: null }
      : {
          tripId,
          leftAt: null,
          role: { in: ['MEMBER', 'ORGANIZER'] as TripMemberRole[] },
        };

    return this.prisma.tripMembership.findMany({
      where,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: membershipPublicSelect,
    });
  }

  private async findMembershipWithTrip(membershipId: string) {
    const membership = await this.prisma.tripMembership.findUnique({
      where: { id: membershipId },
      select: {
        id: true,
        role: true,
        leftAt: true,
        trip: {
          select: {
            id: true,
            status: true,
            organizerId: true,
            currentMembers: true,
            maxMembers: true,
          },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('MEMBERSHIP_NOT_FOUND');
    }
    return membership;
  }
}

const membershipPublicSelect = {
  id: true,
  tripId: true,
  userId: true,
  role: true,
  joinedAt: true,
  leftAt: true,
  requestMessage: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      displayName: true,
      slug: true,
      avatarUrl: true,
      isVerifiedBadge: true,
    },
  },
} as const;
