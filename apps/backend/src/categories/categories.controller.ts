import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.category.findMany({
      orderBy: { labelPl: 'asc' },
      select: {
        id: true,
        slug: true,
        labelPl: true,
        description: true,
        iconEmoji: true,
      },
    });
  }
}
