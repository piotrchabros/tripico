import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceStub {},
}));

jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

// devToken in the email/password reset responses is gated behind
// EMAIL_DEV_TOKENS=true (ADR-007). Tests opt in so they can assert on the
// dev-mode shape; production deploys leave the flag unset and the token
// is logged only.
beforeAll(() => {
  process.env['EMAIL_DEV_TOKENS'] = 'true';
});
afterAll(() => {
  delete process.env['EMAIL_DEV_TOKENS'];
});

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    jwt.signAsync.mockResolvedValue('signed.jwt');
  });

  // -------------------- register --------------------

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      password: 'strongpass123',
      displayName: 'New User',
      slug: 'new-user',
    };

    it('hashes password with PRD §12 Argon2id params and creates user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('argon2id-hash');
      prisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        email: dto.email,
        displayName: dto.displayName,
        slug: dto.slug,
        createdAt: new Date(),
      });

      const result = await service.register(dto);

      expect(argon2.hash).toHaveBeenCalledWith('strongpass123', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      expect(result).toHaveProperty('id', 'uuid-1');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws EMAIL_TAKEN when email exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        email: dto.email,
        slug: 'other',
      });
      await expect(service.register(dto)).rejects.toThrow(
        new ConflictException('EMAIL_TAKEN'),
      );
      expect(argon2.hash).not.toHaveBeenCalled();
    });

    it('throws SLUG_TAKEN when slug exists but email is new', async () => {
      prisma.user.findFirst.mockResolvedValue({
        email: 'other@example.com',
        slug: dto.slug,
      });
      await expect(service.register(dto)).rejects.toThrow(
        new ConflictException('SLUG_TAKEN'),
      );
    });

    it('excludes soft-deleted users from uniqueness check', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('h');
      prisma.user.create.mockResolvedValue({
        id: 'u',
        email: dto.email,
        displayName: dto.displayName,
        slug: dto.slug,
        createdAt: new Date(),
      });
      await service.register(dto);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: dto.email }, { slug: dto.slug }],
          deletedAt: null,
        },
        select: { email: true, slug: true },
      });
    });
  });

  // -------------------- login --------------------

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'rightpass' };
    const dbUser = {
      id: 'user-uuid',
      email: dto.email,
      passwordHash: 'stored-argon2-hash',
      role: 'USER',
      isPremium: false,
      emailVerifiedAt: null as Date | null,
      displayName: 'Test',
      slug: 'test',
    };

    it('issues access + refresh tokens on valid credentials', async () => {
      prisma.user.findFirst.mockResolvedValue(dbUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto, {
        userAgent: 'jest',
        ip: '127.0.0.1',
      });

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-uuid',
          email: dto.email,
          role: 'USER',
          isPremium: false,
          jti: expect.any(String),
        }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-uuid',
            family: expect.any(String),
            userAgent: 'jest',
            ip: '127.0.0.1',
          }),
        }),
      );
      expect(result.accessToken).toBe('signed.jwt');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshExpiresAt).toBeInstanceOf(Date);
      expect(result.user).toEqual({
        id: 'user-uuid',
        email: dto.email,
        displayName: 'Test',
        slug: 'test',
        emailVerified: false,
      });
    });

    it('throws INVALID_CREDENTIALS when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('INVALID_CREDENTIALS'),
      );
      expect(argon2.verify).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('throws INVALID_CREDENTIALS when user has no password (OAuth-only)', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...dbUser, passwordHash: null });
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('INVALID_CREDENTIALS'),
      );
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('throws INVALID_CREDENTIALS on wrong password (no email-existence leak)', async () => {
      prisma.user.findFirst.mockResolvedValue(dbUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('INVALID_CREDENTIALS'),
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });

  // -------------------- refresh --------------------

  describe('refresh', () => {
    const rawToken = 'raw-refresh-token';
    const tokenHash = sha256(rawToken);
    const userId = 'user-uuid';
    const family = 'family-uuid';

    const activeRecord = {
      id: 'rt-1',
      userId,
      family,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
    };
    const activeUser = {
      id: userId,
      email: 'a@b.com',
      role: 'USER',
      isPremium: false,
      emailVerifiedAt: null as Date | null,
      displayName: 'A',
      slug: 'a',
    };

    it('rotates token: revokes old, issues new, returns session', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeRecord);
      prisma.user.findFirst.mockResolvedValue(activeUser);

      const result = await service.refresh(rawToken);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        select: expect.any(Object),
      });
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ family, userId }),
        }),
      );
      expect(result.accessToken).toBe('signed.jwt');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshToken).not.toBe(rawToken);
    });

    it('throws INVALID_REFRESH_TOKEN when token not in DB', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('INVALID_REFRESH_TOKEN'),
      );
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('detects reuse: revokes entire family and throws REFRESH_REUSE_DETECTED', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...activeRecord,
        revokedAt: new Date(),
      });

      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('REFRESH_REUSE_DETECTED'),
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('throws REFRESH_EXPIRED when expiresAt past', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...activeRecord,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('REFRESH_EXPIRED'),
      );
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('throws USER_INACTIVE when underlying user is soft-deleted', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeRecord);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('USER_INACTIVE'),
      );
    });
  });

  // -------------------- logout --------------------

  describe('logout', () => {
    it('revokes the matching active refresh token', async () => {
      const token = 'some-token';
      await service.logout(token);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256(token), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('no-ops when token is undefined', async () => {
      await service.logout(undefined);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  // -------------------- email verification --------------------

  describe('requestEmailVerification', () => {
    it('persists hashed token + expiry, returns devToken (mock-email)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        email: 'a@b.com',
        emailVerifiedAt: null,
      });
      prisma.user.update.mockResolvedValue({});

      const res = await service.requestEmailVerification('u-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({
            emailVerificationTokenHash: expect.any(String),
            emailVerificationExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(res.sent).toBe(true);
      expect(typeof res.devToken).toBe('string');
    });

    it('throws EMAIL_ALREADY_VERIFIED when user is already verified', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        email: 'a@b.com',
        emailVerifiedAt: new Date('2026-01-01'),
      });
      await expect(service.requestEmailVerification('u-1')).rejects.toThrow(
        /EMAIL_ALREADY_VERIFIED/,
      );
    });
  });

  describe('verifyEmail', () => {
    it('marks user verified and clears token on valid token', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
        emailVerifiedAt: null,
      });
      prisma.user.update.mockResolvedValue({});
      const res = await service.verifyEmail('raw-token');
      expect(res).toEqual({ verified: true });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: {
            emailVerifiedAt: expect.any(Date),
            emailVerificationTokenHash: null,
            emailVerificationExpiresAt: null,
          },
        }),
      );
    });

    it('throws INVALID_TOKEN when no user matches the hash', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.verifyEmail('x')).rejects.toThrow(/INVALID_TOKEN/);
    });

    it('throws TOKEN_EXPIRED when expiry passed', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        emailVerificationExpiresAt: new Date(Date.now() - 1000),
        emailVerifiedAt: null,
      });
      await expect(service.verifyEmail('x')).rejects.toThrow(/TOKEN_EXPIRED/);
    });

    it('throws EMAIL_ALREADY_VERIFIED if user already verified', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
        emailVerifiedAt: new Date('2026-01-01'),
      });
      await expect(service.verifyEmail('x')).rejects.toThrow(
        /EMAIL_ALREADY_VERIFIED/,
      );
    });
  });

  // -------------------- password reset --------------------

  describe('requestPasswordReset', () => {
    it('persists hashed token + expiry, returns devToken', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        email: 'a@b.com',
      });
      prisma.user.update.mockResolvedValue({});
      const res = await service.requestPasswordReset('a@b.com');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({
            passwordResetTokenHash: expect.any(String),
            passwordResetExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect((res as { devToken: string }).devToken).toEqual(expect.any(String));
    });

    it('returns uniform success when email does not exist (no enumeration)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const res = await service.requestPasswordReset('ghost@example.com');
      expect(res).toEqual({ sent: true });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      // resetPassword uses $transaction with a callback for user + refreshToken updates
      (
        prisma as unknown as { $transaction: jest.Mock }
      ).$transaction = jest.fn(
        async (cb: (tx: typeof prisma) => unknown) => cb(prisma),
      );
    });

    it('updates password hash and revokes all active refresh tokens', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });
      (argon2.hash as jest.Mock).mockResolvedValue('new-hash');
      prisma.user.update.mockResolvedValue({});

      await service.resetPassword('raw-token', 'newpass123');

      expect(argon2.hash).toHaveBeenCalledWith(
        'newpass123',
        expect.objectContaining({
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({
            passwordHash: 'new-hash',
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('throws INVALID_TOKEN when no user matches', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword('x', 'newpass123'),
      ).rejects.toThrow(/INVALID_TOKEN/);
    });

    it('throws TOKEN_EXPIRED when expiry passed', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-1',
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword('x', 'newpass123'),
      ).rejects.toThrow(/TOKEN_EXPIRED/);
    });
  });
});
