import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceStub {},
}));

import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from './trips.service';

const futureDate = (days: number): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

const validCreateDto = () => ({
  title: 'Wycieczka w Bieszczady',
  description: 'A wonderful trip through the Polish mountains, ten days.',
  destinationCountry: 'pl',
  destinationName: 'Bieszczady, PL',
  startDate: futureDate(10),
  endDate: futureDate(17),
  transport: 'CAR' as const,
  pricePerPerson: 1200,
  maxMembers: 6,
});

describe('TripsService', () => {
  let service: TripsService;
  let prisma: {
    trip: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      trip: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TripsService);
    jest.clearAllMocks();
  });

  // ---------------- create ----------------

  describe('create', () => {
    it('creates trip with slug, organizer membership, currentMembers=1', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockResolvedValue({
        id: 'trip-1',
        slug: 'wycieczka-w-bieszczady',
      });

      const dto = validCreateDto();
      await service.create('organizer-uuid', dto);

      expect(prisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'wycieczka-w-bieszczady',
            title: dto.title,
            destinationCountry: 'PL',
            durationDays: 8,
            currency: 'PLN',
            currentMembers: 1,
            organizer: { connect: { id: 'organizer-uuid' } },
            memberships: expect.objectContaining({
              create: expect.objectContaining({
                user: { connect: { id: 'organizer-uuid' } },
                role: 'ORGANIZER',
              }),
            }),
          }),
        }),
      );
    });

    it('throws END_BEFORE_START when endDate < startDate', async () => {
      const dto = validCreateDto();
      dto.endDate = futureDate(5);
      dto.startDate = futureDate(10);
      await expect(service.create('u', dto)).rejects.toThrow(
        new BadRequestException('END_BEFORE_START'),
      );
    });

    it('throws START_IN_PAST when startDate before today', async () => {
      const dto = validCreateDto();
      dto.startDate = futureDate(-1);
      dto.endDate = futureDate(5);
      await expect(service.create('u', dto)).rejects.toThrow(
        new BadRequestException('START_IN_PAST'),
      );
    });

    it('appends random suffix when slug collides', async () => {
      prisma.trip.findUnique
        .mockResolvedValueOnce({ id: 'existing-1' })
        .mockResolvedValueOnce(null);
      prisma.trip.create.mockResolvedValue({ id: 't', slug: 'x' });

      await service.create('u', validCreateDto());

      expect(prisma.trip.findUnique).toHaveBeenCalledTimes(2);
      const secondCall = prisma.trip.findUnique.mock.calls[1][0].where.slug;
      expect(secondCall).toMatch(/^wycieczka-w-bieszczady-[0-9a-f]{6}$/);
    });
  });

  // ---------------- list / listMine / getBySlug ----------------

  describe('list', () => {
    it('defaults to PUBLISHED status and excludes soft-deleted', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.list({});
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED', deletedAt: null },
          take: 20,
        }),
      );
    });

    it('hasMore=true when result fills the page', async () => {
      prisma.trip.findMany.mockResolvedValue(Array(20).fill({ id: 'x' }));
      const result = await service.list({});
      expect(result.meta.hasMore).toBe(true);
    });

    it('applies destinationCountry filter (uppercased)', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.list({ destinationCountry: 'pl' });
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ destinationCountry: 'PL' }),
        }),
      );
    });

    it('applies transport filter', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.list({ transport: 'TRAIN' });
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ transport: 'TRAIN' }),
        }),
      );
    });

    it('applies startDate range when both bounds provided', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      const from = new Date('2026-07-01');
      const to = new Date('2026-07-31');
      await service.list({ startDateFrom: from, startDateTo: to });
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: { gte: from, lte: to },
          }),
        }),
      );
    });

    it('applies price range', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.list({ minPrice: 100, maxPrice: 2000 });
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pricePerPerson: { gte: 100, lte: 2000 },
          }),
        }),
      );
    });

    it('applies search across title and destinationName (case-insensitive)', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.list({ search: 'Bieszczady' });
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'Bieszczady', mode: 'insensitive' } },
              {
                destinationName: { contains: 'Bieszczady', mode: 'insensitive' },
              },
            ],
          }),
        }),
      );
    });
  });

  describe('listMine', () => {
    it('scopes by organizerId regardless of status', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.listMine('me', {});
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizerId: 'me', deletedAt: null },
        }),
      );
    });

    it('applies status filter when provided', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.listMine('me', { status: 'DRAFT' });
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizerId: 'me', deletedAt: null, status: 'DRAFT' },
        }),
      );
    });
  });

  describe('getBySlug', () => {
    it('returns trip when found', async () => {
      prisma.trip.findFirst.mockResolvedValue({ id: 't', slug: 's' });
      expect(await service.getBySlug('s')).toEqual({ id: 't', slug: 's' });
    });

    it('throws NotFoundException when not found', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(service.getBySlug('x')).rejects.toThrow(
        new NotFoundException('TRIP_NOT_FOUND'),
      );
    });
  });

  // ---------------- update / publish / cancel ----------------

  describe('update', () => {
    const tripRow = {
      id: 't-1',
      organizerId: 'organizer',
      status: 'DRAFT' as const,
      startDate: futureDate(10),
      endDate: futureDate(15),
      currentMembers: 3,
      maxMembers: 6,
    };

    it('throws NotFound when trip absent', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(service.update('t-x', 'u', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller is not organizer', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      await expect(service.update('t-1', 'other', {})).rejects.toThrow(
        new ForbiddenException('NOT_ORGANIZER'),
      );
    });

    it('rejects updates on cancelled trips', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        ...tripRow,
        status: 'CANCELLED',
      });
      await expect(
        service.update('t-1', 'organizer', { title: 'New' }),
      ).rejects.toThrow(new BadRequestException('TRIP_LOCKED'));
    });

    it('rejects reducing maxMembers below currentMembers', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      await expect(
        service.update('t-1', 'organizer', { maxMembers: 2 }),
      ).rejects.toThrow(new BadRequestException('MAX_MEMBERS_BELOW_CURRENT'));
    });

    it('recomputes durationDays when dates change', async () => {
      prisma.trip.findFirst.mockResolvedValue(tripRow);
      prisma.trip.update.mockResolvedValue({});
      const newStart = futureDate(20);
      const newEnd = futureDate(24);
      await service.update('t-1', 'organizer', {
        startDate: newStart,
        endDate: newEnd,
      });
      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ durationDays: 5 }),
        }),
      );
    });
  });

  describe('publish', () => {
    it('transitions DRAFT → PUBLISHED with publishedAt', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        id: 't',
        organizerId: 'u',
        status: 'DRAFT',
        currentMembers: 1,
        maxMembers: 5,
        startDate: futureDate(10),
        endDate: futureDate(15),
      });
      prisma.trip.update.mockResolvedValue({});
      await service.publish('t', 'u');
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 't' },
        data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
        select: expect.any(Object),
      });
    });

    it('rejects publishing a non-DRAFT trip', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        id: 't',
        organizerId: 'u',
        status: 'PUBLISHED',
        currentMembers: 1,
        maxMembers: 5,
        startDate: futureDate(10),
        endDate: futureDate(15),
      });
      await expect(service.publish('t', 'u')).rejects.toThrow(
        new BadRequestException('TRIP_NOT_DRAFT'),
      );
    });
  });

  describe('cancel', () => {
    it('transitions to CANCELLED', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        id: 't',
        organizerId: 'u',
        status: 'PUBLISHED',
        currentMembers: 1,
        maxMembers: 5,
        startDate: futureDate(10),
        endDate: futureDate(15),
      });
      prisma.trip.update.mockResolvedValue({});
      await service.cancel('t', 'u');
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 't' },
        data: { status: 'CANCELLED' },
        select: expect.any(Object),
      });
    });

    it('rejects cancelling a completed trip', async () => {
      prisma.trip.findFirst.mockResolvedValue({
        id: 't',
        organizerId: 'u',
        status: 'COMPLETED',
        currentMembers: 1,
        maxMembers: 5,
        startDate: futureDate(10),
        endDate: futureDate(15),
      });
      await expect(service.cancel('t', 'u')).rejects.toThrow(
        new BadRequestException('TRIP_LOCKED'),
      );
    });
  });
});
