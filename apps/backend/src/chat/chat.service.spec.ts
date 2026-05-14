import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceStub {},
}));

import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    trip: { findFirst: jest.Mock };
    tripMembership: { findUnique: jest.Mock };
    chatChannel: { findUnique: jest.Mock; create: jest.Mock };
    message: { create: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      trip: { findFirst: jest.fn() },
      tripMembership: { findUnique: jest.fn() },
      chatChannel: { findUnique: jest.fn(), create: jest.fn() },
      message: { create: jest.fn(), findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ChatService);
    jest.clearAllMocks();
  });

  const tripRow = { id: 'trip-1', organizerId: 'organizer-1' };

  // ---------- sendMessage ----------

  describe('sendMessage', () => {
    it('lazy-creates channel and persists message for active member', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
        leftAt: null,
      });
      prisma.chatChannel.findUnique.mockResolvedValue(null);
      prisma.chatChannel.create.mockResolvedValue({ id: 'channel-1' });
      prisma.message.create.mockResolvedValue({
        id: 'm-1',
        text: 'hello',
      });

      const msg = await service.sendMessage('trip-1', 'member-1', '  hello  ');

      expect(prisma.chatChannel.create).toHaveBeenCalledWith({
        data: { type: 'TRIP_GROUP', trip: { connect: { id: 'trip-1' } } },
        select: { id: true },
      });
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: { connect: { id: 'channel-1' } },
            sender: { connect: { id: 'member-1' } },
            text: 'hello',
          }),
        }),
      );
      expect(msg).toEqual({ id: 'm-1', text: 'hello' });
    });

    it('re-uses existing channel', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
        leftAt: null,
      });
      prisma.chatChannel.findUnique.mockResolvedValue({ id: 'existing' });
      prisma.message.create.mockResolvedValue({});
      await service.sendMessage('trip-1', 'member-1', 'hi');
      expect(prisma.chatChannel.create).not.toHaveBeenCalled();
    });

    it('throws NOT_TRIP_PARTICIPANT when caller is not member/organizer', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue(null);
      await expect(
        service.sendMessage('trip-1', 'stranger', 'hi'),
      ).rejects.toThrow(new ForbiddenException('NOT_TRIP_PARTICIPANT'));
    });

    it('throws EMPTY_MESSAGE for whitespace-only text', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      await expect(
        service.sendMessage('trip-1', 'organizer-1', '   '),
      ).rejects.toThrow(new ForbiddenException('EMPTY_MESSAGE'));
    });

    it('throws MESSAGE_TOO_LONG above 2000 chars', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      await expect(
        service.sendMessage('trip-1', 'organizer-1', 'x'.repeat(2001)),
      ).rejects.toThrow(new ForbiddenException('MESSAGE_TOO_LONG'));
    });
  });

  // ---------- listMessages ----------

  describe('listMessages', () => {
    it('returns empty when no channel yet exists', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.chatChannel.findUnique.mockResolvedValue(null);
      const result = await service.listMessages('trip-1', 'organizer-1');
      expect(result).toEqual({ data: [], meta: { hasMore: false } });
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });

    it('returns recent messages from existing channel', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.chatChannel.findUnique.mockResolvedValue({ id: 'ch-1' });
      prisma.message.findMany.mockResolvedValue([{ id: 'm-1' }]);
      const result = await service.listMessages('trip-1', 'organizer-1', 10);
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channelId: 'ch-1', deletedAt: null },
          take: 10,
        }),
      );
      expect(result.data).toEqual([{ id: 'm-1' }]);
    });

    it('rejects non-participant', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue(null);
      await expect(service.listMessages('trip-1', 'stranger')).rejects.toThrow(
        new ForbiddenException('NOT_TRIP_PARTICIPANT'),
      );
    });

    it('throws TRIP_NOT_FOUND when trip absent', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(service.listMessages('x', 'u')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------- canParticipate ----------

  describe('canParticipate', () => {
    it('returns true for trip organizer', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      expect(await service.canParticipate('trip-1', 'organizer-1')).toBe(true);
    });

    it('returns true for active MEMBER', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
        leftAt: null,
      });
      expect(await service.canParticipate('trip-1', 'member-1')).toBe(true);
    });

    it('returns false for stranger/PENDING/left-member', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'PENDING',
        leftAt: null,
      });
      expect(await service.canParticipate('trip-1', 'pending-1')).toBe(false);
    });
  });
});
