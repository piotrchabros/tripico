import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MESSAGE_SELECT = {
  id: true,
  channelId: true,
  senderId: true,
  text: true,
  createdAt: true,
  editedAt: true,
  sender: {
    select: {
      id: true,
      displayName: true,
      slug: true,
      avatarUrl: true,
      isVerifiedBadge: true,
    },
  },
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async sendMessage(tripId: string, senderId: string, text: string) {
    await this.assertCanParticipate(tripId, senderId);
    const trimmed = text.trim();
    if (!trimmed) throw new ForbiddenException('EMPTY_MESSAGE');
    if (trimmed.length > 2000) throw new ForbiddenException('MESSAGE_TOO_LONG');

    const channel = await this.ensureGroupChannel(tripId);
    return this.prisma.message.create({
      data: {
        channel: { connect: { id: channel.id } },
        sender: { connect: { id: senderId } },
        text: trimmed,
      },
      select: MESSAGE_SELECT,
    });
  }

  async listMessages(tripId: string, userId: string, limit = 50) {
    await this.assertCanParticipate(tripId, userId);
    const channel = await this.prisma.chatChannel.findUnique({
      where: { tripId_type: { tripId, type: 'TRIP_GROUP' } },
      select: { id: true },
    });
    if (!channel) return { data: [], meta: { hasMore: false } };

    const cappedLimit = Math.min(Math.max(limit, 1), 100);
    const data = await this.prisma.message.findMany({
      where: { channelId: channel.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: cappedLimit,
      select: MESSAGE_SELECT,
    });
    return { data, meta: { hasMore: data.length === cappedLimit } };
  }

  /**
   * Returns true if the user is the trip organizer or an active MEMBER.
   * Used by gateway to gate joining a trip's chat room.
   */
  async canParticipate(tripId: string, userId: string): Promise<boolean> {
    try {
      await this.assertCanParticipate(tripId, userId);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureGroupChannel(tripId: string) {
    const existing = await this.prisma.chatChannel.findUnique({
      where: { tripId_type: { tripId, type: 'TRIP_GROUP' } },
      select: { id: true },
    });
    if (existing) return existing;
    return this.prisma.chatChannel.create({
      data: {
        type: 'TRIP_GROUP',
        trip: { connect: { id: tripId } },
      },
      select: { id: true },
    });
  }

  private async assertCanParticipate(
    tripId: string,
    userId: string,
  ): Promise<void> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { id: true, organizerId: true },
    });
    if (!trip) throw new NotFoundException('TRIP_NOT_FOUND');
    if (trip.organizerId === userId) return;

    const membership = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId } },
      select: { role: true, leftAt: true },
    });
    if (!membership || membership.role !== 'MEMBER' || membership.leftAt) {
      throw new ForbiddenException('NOT_TRIP_PARTICIPANT');
    }
  }
}
