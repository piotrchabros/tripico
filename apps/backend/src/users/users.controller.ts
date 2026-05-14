import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public profile lookup by slug. Returns the safe subset of user fields
   * + the user's currently-discoverable (PUBLISHED) trips. Anonymous
   * users can reach this — it's the canonical /u/:slug experience.
   */
  @Public()
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const user = await this.prisma.user.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        slug: true,
        avatarUrl: true,
        bio: true,
        isVerifiedBadge: true,
        createdAt: true,
        organizedTrips: {
          where: { status: 'PUBLISHED', deletedAt: null },
          orderBy: { startDate: 'asc' },
          select: {
            id: true,
            slug: true,
            title: true,
            destinationName: true,
            startDate: true,
            endDate: true,
            currentMembers: true,
            maxMembers: true,
            pricePerPerson: true,
            currency: true,
            coverImageUrl: true,
            categories: {
              select: {
                category: {
                  select: {
                    id: true,
                    slug: true,
                    labelPl: true,
                    iconEmoji: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }
}
