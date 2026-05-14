import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AICategorizationService } from '../ai/ai-categorization.service';
import { PostHogService } from '../posthog/posthog.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripStatus } from '../shared/constants/enums';
import { slugify } from '../shared/utils/slug';
import { CreateTripDto } from './dto/create-trip.dto';
import { ListTripsQueryDto } from './dto/list-trips-query.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

const TRIP_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  destinationCountry: true,
  destinationName: true,
  destinationLat: true,
  destinationLng: true,
  startDate: true,
  endDate: true,
  durationDays: true,
  transport: true,
  pricePerPerson: true,
  currency: true,
  maxMembers: true,
  currentMembers: true,
  coverImageUrl: true,
  galleryUrls: true,
  status: true,
  publishedAt: true,
  organizerId: true,
  createdAt: true,
} as const;

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posthog: PostHogService,
    private readonly ai: AICategorizationService,
  ) {}

  async create(organizerId: string, dto: CreateTripDto) {
    this.assertValidDateRange(dto.startDate, dto.endDate);

    const slug = await this.generateUniqueSlug(dto.title);
    const durationDays = computeDurationDays(dto.startDate, dto.endDate);

    return this.prisma.trip.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        destinationCountry: dto.destinationCountry.toUpperCase(),
        destinationName: dto.destinationName,
        destinationLat: dto.destinationLat ?? null,
        destinationLng: dto.destinationLng ?? null,
        mapboxPlaceId: dto.mapboxPlaceId ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        durationDays,
        transport: dto.transport,
        pricePerPerson: dto.pricePerPerson,
        currency: dto.currency ?? 'PLN',
        maxMembers: dto.maxMembers,
        currentMembers: 1,
        coverImageUrl: dto.coverImageUrl ?? null,
        galleryUrls: dto.galleryUrls ?? [],
        organizer: { connect: { id: organizerId } },
        memberships: {
          create: {
            user: { connect: { id: organizerId } },
            role: 'ORGANIZER',
            joinedAt: new Date(),
          },
        },
      },
      select: TRIP_SUMMARY_SELECT,
    });
  }

  async list(query: ListTripsQueryDto) {
    const limit = query.limit ?? 20;
    const status: TripStatus = query.status ?? 'PUBLISHED';

    const where = this.buildDiscoveryWhere(query, status);

    const data = await this.prisma.trip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: TRIP_SUMMARY_SELECT,
    });

    return { data, meta: { hasMore: data.length === limit } };
  }

  private buildDiscoveryWhere(query: ListTripsQueryDto, status: TripStatus) {
    const where: Record<string, unknown> = { status, deletedAt: null };

    if (query.destinationCountry) {
      where['destinationCountry'] = query.destinationCountry.toUpperCase();
    }
    if (query.transport) {
      where['transport'] = query.transport;
    }
    if (query.startDateFrom || query.startDateTo) {
      const range: Record<string, Date> = {};
      if (query.startDateFrom) range['gte'] = query.startDateFrom;
      if (query.startDateTo) range['lte'] = query.startDateTo;
      where['startDate'] = range;
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (query.minPrice !== undefined) range['gte'] = query.minPrice;
      if (query.maxPrice !== undefined) range['lte'] = query.maxPrice;
      where['pricePerPerson'] = range;
    }
    if (query.search) {
      const term = query.search.trim();
      where['OR'] = [
        { title: { contains: term, mode: 'insensitive' } },
        { destinationName: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async listMine(organizerId: string, query: ListTripsQueryDto) {
    const limit = query.limit ?? 20;
    const data = await this.prisma.trip.findMany({
      where: {
        organizerId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: TRIP_SUMMARY_SELECT,
    });

    return { data, meta: { hasMore: data.length === limit } };
  }

  async getBySlug(slug: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { slug, deletedAt: null },
      select: TRIP_SUMMARY_SELECT,
    });
    if (!trip) throw new NotFoundException('TRIP_NOT_FOUND');
    return trip;
  }

  async update(tripId: string, userId: string, dto: UpdateTripDto) {
    const trip = await this.findOrThrow(tripId);
    this.assertIsOrganizer(trip, userId);
    if (trip.status === 'CANCELLED' || trip.status === 'ARCHIVED') {
      throw new BadRequestException('TRIP_LOCKED');
    }

    const startDate = dto.startDate ?? trip.startDate;
    const endDate = dto.endDate ?? trip.endDate;
    if (dto.startDate || dto.endDate) {
      this.assertValidDateRange(startDate, endDate);
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.destinationCountry !== undefined)
      data['destinationCountry'] = dto.destinationCountry.toUpperCase();
    if (dto.destinationName !== undefined)
      data['destinationName'] = dto.destinationName;
    if (dto.destinationLat !== undefined) data['destinationLat'] = dto.destinationLat;
    if (dto.destinationLng !== undefined) data['destinationLng'] = dto.destinationLng;
    if (dto.mapboxPlaceId !== undefined) data['mapboxPlaceId'] = dto.mapboxPlaceId;
    if (dto.startDate !== undefined) data['startDate'] = dto.startDate;
    if (dto.endDate !== undefined) data['endDate'] = dto.endDate;
    if (dto.startDate || dto.endDate)
      data['durationDays'] = computeDurationDays(startDate, endDate);
    if (dto.transport !== undefined) data['transport'] = dto.transport;
    if (dto.pricePerPerson !== undefined)
      data['pricePerPerson'] = dto.pricePerPerson;
    if (dto.currency !== undefined) data['currency'] = dto.currency;
    if (dto.maxMembers !== undefined) {
      if (dto.maxMembers < trip.currentMembers) {
        throw new BadRequestException('MAX_MEMBERS_BELOW_CURRENT');
      }
      data['maxMembers'] = dto.maxMembers;
    }
    if (dto.coverImageUrl !== undefined) data['coverImageUrl'] = dto.coverImageUrl;
    if (dto.galleryUrls !== undefined) data['galleryUrls'] = dto.galleryUrls;

    return this.prisma.trip.update({
      where: { id: tripId },
      data,
      select: TRIP_SUMMARY_SELECT,
    });
  }

  async publish(tripId: string, userId: string) {
    const trip = await this.findOrThrow(tripId);
    this.assertIsOrganizer(trip, userId);
    if (trip.status !== 'DRAFT') {
      throw new BadRequestException('TRIP_NOT_DRAFT');
    }
    const published = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      select: TRIP_SUMMARY_SELECT,
    });
    this.posthog.capture({
      distinctId: userId,
      event: 'trip_published',
      properties: {
        trip_id: published.id,
        transport: published.transport,
        duration_days: published.durationDays,
        max_members: published.maxMembers,
        destination_country: published.destinationCountry,
      },
    });
    // Fire-and-forget AI categorization. Latency (~2–5s for the LLM
    // round-trip) doesn't belong in the publish response path. AGENTS
    // §3 calls for BullMQ here — this in-process detached promise is
    // the MVP intermediate until Redis is available.
    void this.ai.categorizeTrip(published.id);
    return published;
  }

  async cancel(tripId: string, userId: string) {
    const trip = await this.findOrThrow(tripId);
    this.assertIsOrganizer(trip, userId);
    if (trip.status === 'CANCELLED' || trip.status === 'COMPLETED') {
      throw new BadRequestException('TRIP_LOCKED');
    }
    return this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'CANCELLED' },
      select: TRIP_SUMMARY_SELECT,
    });
  }

  private async findOrThrow(tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        organizerId: true,
        status: true,
        startDate: true,
        endDate: true,
        currentMembers: true,
        maxMembers: true,
      },
    });
    if (!trip) throw new NotFoundException('TRIP_NOT_FOUND');
    return trip;
  }

  private assertIsOrganizer(
    trip: { organizerId: string },
    userId: string,
  ): void {
    if (trip.organizerId !== userId) {
      throw new ForbiddenException('NOT_ORGANIZER');
    }
  }

  private assertValidDateRange(start: Date, end: Date): void {
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('END_BEFORE_START');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start.getTime() < today.getTime()) {
      throw new BadRequestException('START_IN_PAST');
    }
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.prisma.trip.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${randomBytes(3).toString('hex')}`;
    }
    throw new InternalServerErrorException('SLUG_GENERATION_FAILED');
  }
}

function computeDurationDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}
