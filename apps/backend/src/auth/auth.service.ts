import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SystemRole } from './types/authenticated-user';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

interface AccessTokenClaims {
  sub: string;
  email: string;
  role: SystemRole;
  isPremium: boolean;
  emailVerified: boolean;
  jti: string;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: {
    id: string;
    email: string;
    displayName: string;
    slug: string;
    emailVerified: boolean;
  };
}

interface IssueRefreshParams {
  userId: string;
  family: string;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // EmailService is injected via constructor below; kept separate for
  // readability against the other deps.

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  private appBaseUrl(): string {
    return process.env['APP_BASE_URL'] ?? 'http://localhost:4200';
  }

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

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ip?: string } = {},
  ): Promise<AuthSession> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isPremium: true,
        emailVerifiedAt: true,
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

    const emailVerified = !!user.emailVerifiedAt;
    const family = randomUUID();
    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as SystemRole,
      isPremium: user.isPremium,
      emailVerified,
      jti: randomUUID(),
    });
    const refresh = await this.issueRefreshToken({
      userId: user.id,
      family,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        slug: user.slug,
        emailVerified,
      },
    };
  }

  async refresh(
    rawToken: string,
    meta: { userAgent?: string; ip?: string } = {},
  ): Promise<AuthSession> {
    const tokenHash = hashRefreshToken(rawToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        family: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!existing) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { family: existing.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('REFRESH_REUSE_DETECTED');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('REFRESH_EXPIRED');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: existing.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        isPremium: true,
        emailVerifiedAt: true,
        displayName: true,
        slug: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('USER_INACTIVE');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const emailVerified = !!user.emailVerifiedAt;
    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as SystemRole,
      isPremium: user.isPremium,
      emailVerified,
      jti: randomUUID(),
    });
    const refresh = await this.issueRefreshToken({
      userId: user.id,
      family: existing.family,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        slug: user.slug,
        emailVerified,
      },
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashRefreshToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Issues a verification token for the given user. In production this would
   * dispatch an email via Resend/Postmark; in MVP it logs the token and
   * returns it inline so dev tooling and tests can complete the flow.
   */
  async requestEmailVerification(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    if (user.emailVerifiedAt) {
      throw new BadRequestException('EMAIL_ALREADY_VERIFIED');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: hashEmailToken(rawToken),
        emailVerificationExpiresAt: expiresAt,
      },
    });

    this.logger.log(
      `[email-verification] dev-mode: token for ${user.email} = ${rawToken}`,
    );

    await this.email.sendVerificationEmail({
      to: { email: user.email },
      verifyUrl: `${this.appBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`,
    });

    return buildTokenResponse(expiresAt, rawToken);
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = hashEmailToken(rawToken);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        deletedAt: null,
      },
      select: {
        id: true,
        emailVerificationExpiresAt: true,
        emailVerifiedAt: true,
      },
    });
    if (!user) throw new BadRequestException('INVALID_TOKEN');
    if (user.emailVerifiedAt) {
      throw new BadRequestException('EMAIL_ALREADY_VERIFIED');
    }
    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('TOKEN_EXPIRED');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
    return { verified: true };
  }

  /**
   * Initiates a password reset. Always returns a uniform "sent" response,
   * regardless of whether the email exists (prevents email-enumeration).
   * Token logged + included as devToken (dev mode) — same caveats as
   * email verification (see ADR-007).
   */
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true },
    });

    if (!user) {
      return { sent: true } as const;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashEmailToken(rawToken),
        passwordResetExpiresAt: expiresAt,
      },
    });

    this.logger.log(
      `[password-reset] dev-mode: token for ${user.email} = ${rawToken}`,
    );

    await this.email.sendPasswordResetEmail({
      to: { email: user.email },
      resetUrl: `${this.appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`,
    });

    return buildTokenResponse(expiresAt, rawToken);
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashEmailToken(rawToken);
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash, deletedAt: null },
      select: { id: true, passwordResetExpiresAt: true },
    });
    if (!user) throw new BadRequestException('INVALID_TOKEN');
    if (
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('TOKEN_EXPIRED');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      });
      // Revoke ALL active refresh tokens for the user — password change
      // invalidates existing sessions per PRD §12 security baseline.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { reset: true };
  }

  private signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims);
  }

  private async issueRefreshToken(params: IssueRefreshParams) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.prisma.refreshToken.create({
      data: {
        userId: params.userId,
        tokenHash: hashRefreshToken(token),
        family: params.family,
        expiresAt,
        userAgent: params.userAgent ?? null,
        ip: params.ip ?? null,
      },
    });
    return { token, expiresAt };
  }
}

function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function hashEmailToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Dev-mode token exposure (ADR-007). The raw token is only returned in the
 * HTTP response body when EMAIL_DEV_TOKENS=true is explicitly set in the
 * environment. Default is OFF — production deploys MUST leave this unset.
 */
function buildTokenResponse(expiresAt: Date, rawToken: string) {
  const exposeDevToken = process.env['EMAIL_DEV_TOKENS'] === 'true';
  return exposeDevToken
    ? { sent: true, expiresAt, devToken: rawToken }
    : { sent: true, expiresAt };
}
