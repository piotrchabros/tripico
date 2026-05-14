import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceStub {},
}));

import { PrismaService } from '../prisma/prisma.service';
import { BoardService } from './board.service';

describe('BoardService', () => {
  let service: BoardService;
  let prisma: {
    trip: { findFirst: jest.Mock };
    tripMembership: { findUnique: jest.Mock };
    boardPost: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      trip: { findFirst: jest.fn() },
      tripMembership: { findUnique: jest.fn() },
      boardPost: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(BoardService);
    jest.clearAllMocks();
  });

  const tripRow = { id: 'trip-1', organizerId: 'organizer-1' };

  // ----- create -----

  describe('create', () => {
    it('allows organizer to post', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.boardPost.create.mockResolvedValue({});
      await service.create('trip-1', 'organizer-1', { text: 'hello' });
      expect(prisma.boardPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'TEXT',
            content: { text: 'hello' },
            trip: { connect: { id: 'trip-1' } },
            author: { connect: { id: 'organizer-1' } },
          }),
        }),
      );
    });

    it('allows active MEMBER to post', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
        leftAt: null,
      });
      prisma.boardPost.create.mockResolvedValue({});
      await service.create('trip-1', 'member-1', { text: 'hi' });
      expect(prisma.boardPost.create).toHaveBeenCalled();
    });

    it('throws NOT_TRIP_PARTICIPANT for PENDING user', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'PENDING',
        leftAt: null,
      });
      await expect(
        service.create('trip-1', 'pending-1', { text: 'hi' }),
      ).rejects.toThrow(new ForbiddenException('NOT_TRIP_PARTICIPANT'));
    });

    it('throws NOT_TRIP_PARTICIPANT for member who has left', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.tripMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
        leftAt: new Date(),
      });
      await expect(
        service.create('trip-1', 'left-1', { text: 'hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws TRIP_NOT_FOUND', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(
        service.create('x', 'u', { text: 'hi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----- list -----

  describe('list', () => {
    it('returns posts ordered by pinnedAt desc then createdAt desc', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.boardPost.findMany.mockResolvedValue([]);
      await service.list('trip-1', 'organizer-1');
      expect(prisma.boardPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1', deletedAt: null },
          orderBy: [
            { pinnedAt: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' },
          ],
        }),
      );
    });
  });

  // ----- update -----

  describe('update', () => {
    it('lets author update text in content', async () => {
      prisma.boardPost.findFirst.mockResolvedValue({
        id: 'p-1',
        tripId: 'trip-1',
        authorId: 'me',
        content: { text: 'old', extra: 'preserved' },
      });
      prisma.boardPost.update.mockResolvedValue({});
      await service.update('p-1', 'me', { text: 'new' });
      expect(prisma.boardPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { content: { extra: 'preserved', text: 'new' } },
        }),
      );
    });

    it('throws NOT_POST_AUTHOR when caller is not author', async () => {
      prisma.boardPost.findFirst.mockResolvedValue({
        id: 'p-1',
        tripId: 'trip-1',
        authorId: 'other',
        content: { text: 'x' },
      });
      await expect(service.update('p-1', 'me', { text: 'y' })).rejects.toThrow(
        new ForbiddenException('NOT_POST_AUTHOR'),
      );
    });
  });

  // ----- remove -----

  describe('remove', () => {
    it('allows author to soft-delete', async () => {
      prisma.boardPost.findFirst.mockResolvedValue({
        id: 'p-1',
        tripId: 'trip-1',
        authorId: 'me',
      });
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.boardPost.update.mockResolvedValue({});
      await service.remove('p-1', 'me');
      expect(prisma.boardPost.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('allows trip organizer to soft-delete any post', async () => {
      prisma.boardPost.findFirst.mockResolvedValue({
        id: 'p-1',
        tripId: 'trip-1',
        authorId: 'member-1',
      });
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.boardPost.update.mockResolvedValue({});
      await service.remove('p-1', 'organizer-1');
      expect(prisma.boardPost.update).toHaveBeenCalled();
    });

    it('throws when caller is neither author nor organizer', async () => {
      prisma.boardPost.findFirst.mockResolvedValue({
        id: 'p-1',
        tripId: 'trip-1',
        authorId: 'member-1',
      });
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      await expect(service.remove('p-1', 'stranger')).rejects.toThrow(
        new ForbiddenException('NOT_AUTHOR_OR_ORGANIZER'),
      );
    });
  });
});
