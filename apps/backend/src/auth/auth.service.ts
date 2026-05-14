import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { slug: dto.slug }],
        deletedAt: null,
      },
      select: { email: true, slug: true },
    });

    if (existing) {
      throw new ConflictException(
        existing.email === dto.email ? 'EMAIL_TAKEN' : 'SLUG_TAKEN',
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        slug: dto.slug,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        slug: true,
        createdAt: true,
      },
    });
  }
}
