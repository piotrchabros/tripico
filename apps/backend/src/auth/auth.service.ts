import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  isPremium: boolean;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isPremium: true,
        displayName: true,
        slug: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const claims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isPremium: user.isPremium,
      jti: randomUUID(),
    };

    const accessToken = await this.jwt.signAsync(claims);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        slug: user.slug,
      },
    };
  }
}
