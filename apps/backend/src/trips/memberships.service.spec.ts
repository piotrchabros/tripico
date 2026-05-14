import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceStub {},
}));

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsServiceStub {},
}));

jest.mock('../posthog/posthog.service', () => ({
  PostHogService: class PostHogServiceStub {},
}));

import { NotificationsService } from '../notifications/notifications.service';
import { PostHogService } from '../posthog/posthog.service';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipsService } from './memberships.service';

describe('MembershipsService', () => {
  let service: MembershipsService;
  let prisma: {
    trip: { findFirst: jest.Mock; update: jest.Mock };
    tripMembership: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      trip: { findFirst: jest.fn(), update: jest.fn() },
      tripMembership: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: typeof prisma) => unknown) =>
        cb(prisma),
      ),
    };

    notifications = { create: jest.fn().mockResolvedValue({}) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: PostHogService, useValue: { capture: jest.fn() } },
      ],
    }).compile();
    service = module.get(MembershipsService);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (cb: (tx: typeof prisma) => unknown) => cb(prisma),
    );
  });

  // ---------------- requestJoin ----------------

  describe('requestJoin', () => {
    const publishedTrip = {
      id: 'trip-1',
      status: 'PUBLISHED' as const,
      organizerId: 'organizer-1',
      currentMembers: 2,
      maxMembers: 5,
    };

    it('throws TRIP_NOT_FOUND when trip missing', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(
        service.requestJoin('t', 'u', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ALREADY_ORGANIZER when caller is the organizer', async () => {
      prisma.trip.findFirst.mockResolvedValue(publishedTrip);
      await expect(
        service.requestJoin('trip-1', 'organizer-1', {}),
      ).rejects.toThrow(new BadRequestException('ALREADY_ORGANIZER'));
    });

    it('throws TRIP_NOT_OPEN_FOR_JOIN when trip status is DRAFT/FULL/etc.', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        ...publishedTrip,
        status: 'FULL',
      });
      await expect(
        service.requestJoin('trip-1', 'u', {}),
      ).rejects.toThrow(new BadRequestException('TRIP_NOT_OPEN_FOR_JOIN'));
    });

    it('creates new PENDING membership when no prior row exists', async () => {
      prisma.trip.findFirst.mockResolvedValue(publishedTrip);
      prisma.tripMembership.findUnique.mockResolvedValue(null);
      prisma.tripMembership.create.mockResolvedValue({ id: 'm-1' });

      await service.requestJoin('trip-1', 'user-1', {
        requestMessage: 'Hi!',
      });

      expect(prisma.tripMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'PENDING',
            requestMessage: 'Hi!',
            trip: { connect: { id: 'trip-1' } },
            user: { connect: { id: 'user-1' } },
          }),
        }),
      );
    });

    it('throws ALREADY_PENDING when already pending', async () => {
      prisma.trip.findFirst.mockResolvedValue(publishedTrip);
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        role: 'PENDING',
        leftAt: null,
      });
      await expect(
        service.requestJoin('trip-1', 'user-1', {}),
      ).rejects.toThrow(new ConflictException('ALREADY_PENDING'));
    });

    it('throws ALREADY_MEMBER when already an active member', async () => {
      prisma.trip.findFirst.mockResolvedValue(publishedTrip);
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        role: 'MEMBER',
        leftAt: null,
      });
      await expect(
        service.requestJoin('trip-1', 'user-1', {}),
      ).rejects.toThrow(new ConflictException('ALREADY_MEMBER'));
    });

    it('re-uses prior left membership row, resetting to PENDING (PRD §12 re-request)', async () => {
      prisma.trip.findFirst.mockResolvedValue(publishedTrip);
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-old',
        role: 'MEMBER',
        leftAt: new Date('2026-01-01'),
      });
      prisma.tripMembership.update.mockResolvedValue({ id: 'm-old' });

      await service.requestJoin('trip-1', 'user-1', {
        requestMessage: 'second chance',
      });

      expect(prisma.tripMembership.update).toHaveBeenCalledWith({
        where: { id: 'm-old' },
        data: {
          role: 'PENDING',
          joinedAt: null,
          leftAt: null,
          requestMessage: 'second chance',
        },
        select: expect.any(Object),
      });
      expect(prisma.tripMembership.create).not.toHaveBeenCalled();
    });
  });

  // ---------------- approve ----------------

  describe('approve', () => {
    const baseTrip = {
      id: 'trip-1',
      status: 'PUBLISHED' as const,
      organizerId: 'organizer-1',
      currentMembers: 2,
      maxMembers: 5,
    };
    const pendingMembership = {
      id: 'm-1',
      role: 'PENDING' as const,
      leftAt: null,
      trip: baseTrip,
    };

    it('transitions PENDING → MEMBER and increments currentMembers', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue(pendingMembership);
      prisma.tripMembership.update.mockResolvedValue({ id: 'm-1' });
      prisma.trip.update.mockResolvedValue({});

      await service.approve('m-1', 'organizer-1');

      expect(prisma.tripMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm-1' },
          data: { role: 'MEMBER', joinedAt: expect.any(Date) },
        }),
      );
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: { currentMembers: 3, status: 'PUBLISHED' },
      });
    });

    it('flips trip to FULL when newCount reaches maxMembers', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        ...pendingMembership,
        trip: { ...baseTrip, currentMembers: 4, maxMembers: 5 },
      });
      prisma.tripMembership.update.mockResolvedValue({});
      prisma.trip.update.mockResolvedValue({});

      await service.approve('m-1', 'organizer-1');

      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: { currentMembers: 5, status: 'FULL' },
      });
    });

    it('throws NOT_ORGANIZER when caller is not the organizer', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue(pendingMembership);
      await expect(service.approve('m-1', 'other')).rejects.toThrow(
        new ForbiddenException('NOT_ORGANIZER'),
      );
    });

    it('throws NOT_PENDING for a non-pending membership', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        ...pendingMembership,
        role: 'MEMBER',
      });
      await expect(service.approve('m-1', 'organizer-1')).rejects.toThrow(
        new BadRequestException('NOT_PENDING'),
      );
    });

    it('throws TRIP_FULL when trip already at capacity', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        ...pendingMembership,
        trip: { ...baseTrip, status: 'FULL' as const },
      });
      await expect(service.approve('m-1', 'organizer-1')).rejects.toThrow(
        new BadRequestException('TRIP_FULL'),
      );
    });
  });

  // ---------------- reject ----------------

  describe('reject', () => {
    const baseTrip = {
      id: 'trip-1',
      status: 'PUBLISHED' as const,
      organizerId: 'organizer-1',
      currentMembers: 2,
      maxMembers: 5,
    };

    it('deletes the PENDING membership row', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        role: 'PENDING',
        leftAt: null,
        trip: baseTrip,
      });
      await service.reject('m-1', 'organizer-1');
      expect(prisma.tripMembership.delete).toHaveBeenCalledWith({
        where: { id: 'm-1' },
      });
    });

    it('throws NOT_ORGANIZER when caller is not the organizer', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        role: 'PENDING',
        leftAt: null,
        trip: baseTrip,
      });
      await expect(service.reject('m-1', 'other')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.tripMembership.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------- leave ----------------

  describe('leave', () => {
    const baseTrip = {
      id: 'trip-1',
      status: 'PUBLISHED' as const,
      currentMembers: 3,
      maxMembers: 5,
    };

    it('soft-leaves and decrements currentMembers', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        role: 'MEMBER',
        leftAt: null,
        trip: baseTrip,
      });
      prisma.tripMembership.update.mockResolvedValue({});
      prisma.trip.update.mockResolvedValue({});

      await service.leave('trip-1', 'user-1');

      expect(prisma.tripMembership.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { leftAt: expect.any(Date) },
      });
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: { currentMembers: 2, status: 'PUBLISHED' },
      });
    });

    it('flips FULL trip back to PUBLISHED on leave', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        role: 'MEMBER',
        leftAt: null,
        trip: { ...baseTrip, status: 'FULL' as const, currentMembers: 5 },
      });
      prisma.tripMembership.update.mockResolvedValue({});
      prisma.trip.update.mockResolvedValue({});

      await service.leave('trip-1', 'user-1');

      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: { currentMembers: 4, status: 'PUBLISHED' },
      });
    });

    it('throws ORGANIZER_CANNOT_LEAVE (must cancel instead) per AGENTS §12', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-org',
        role: 'ORGANIZER',
        leftAt: null,
        trip: baseTrip,
      });
      await expect(service.leave('trip-1', 'organizer-1')).rejects.toThrow(
        new BadRequestException('ORGANIZER_CANNOT_LEAVE'),
      );
    });

    it('deletes a PENDING row instead of soft-leave (treated as withdrawal)', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue({
        id: 'm-pending',
        role: 'PENDING',
        leftAt: null,
        trip: baseTrip,
      });
      await service.leave('trip-1', 'user-1');
      expect(prisma.tripMembership.delete).toHaveBeenCalledWith({
        where: { id: 'm-pending' },
      });
      expect(prisma.trip.update).not.toHaveBeenCalled();
    });

    it('throws MEMBERSHIP_NOT_FOUND when not a member or already left', async () => {
      prisma.tripMembership.findUnique.mockResolvedValue(null);
      await expect(service.leave('trip-1', 'u')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------- listForTrip ----------------

  describe('listForTrip', () => {
    it('throws TRIP_NOT_FOUND when trip missing', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(service.listForTrip('t', 'u')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NOT_TRIP_PARTICIPANT when caller is neither organizer nor member', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        id: 'trip-1',
        organizerId: 'organizer-1',
      });
      prisma.tripMembership.findUnique.mockResolvedValue(null);
      await expect(service.listForTrip('trip-1', 'stranger')).rejects.toThrow(
        new ForbiddenException('NOT_TRIP_PARTICIPANT'),
      );
    });

    it('organizer sees PENDING + MEMBER + ORGANIZER', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        id: 'trip-1',
        organizerId: 'organizer-1',
      });
      prisma.tripMembership.findMany.mockResolvedValue([]);
      await service.listForTrip('trip-1', 'organizer-1');
      expect(prisma.tripMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1', leftAt: null },
        }),
      );
    });

    it('member sees only MEMBER + ORGANIZER (no PENDING)', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        id: 'trip-1',
        organizerId: 'organizer-1',
      });
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
        leftAt: null,
      });
      prisma.tripMembership.findMany.mockResolvedValue([]);
      await service.listForTrip('trip-1', 'member-1');
      expect(prisma.tripMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tripId: 'trip-1',
            leftAt: null,
            role: { in: ['MEMBER', 'ORGANIZER'] },
          },
        }),
      );
    });
  });
});
