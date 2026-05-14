import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceStub {},
}));

jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

// Imports below the mocks intentionally — they rely on the mocked modules.
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findFirst: jest.Mock; create: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = {
      signAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validDto = {
      email: 'new@example.com',
      password: 'strongpass123',
      displayName: 'New User',
      slug: 'new-user',
    };

    it('hashes password with Argon2id (PRD §12 parameters) and creates user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('argon2id-hash');
      prisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        email: validDto.email,
        displayName: validDto.displayName,
        slug: validDto.slug,
        createdAt: new Date(),
      });

      const result = await service.register(validDto);

      expect(argon2.hash).toHaveBeenCalledWith('strongpass123', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: validDto.email,
          passwordHash: 'argon2id-hash',
          displayName: validDto.displayName,
          slug: validDto.slug,
        },
        select: expect.any(Object),
      });
      expect(result).toHaveProperty('id', 'uuid-1');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws ConflictException EMAIL_TAKEN when email already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        email: validDto.email,
        slug: 'someone-else',
      });

      await expect(service.register(validDto)).rejects.toThrow(
        new ConflictException('EMAIL_TAKEN'),
      );
      expect(argon2.hash).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException SLUG_TAKEN when slug taken but email is new', async () => {
      prisma.user.findFirst.mockResolvedValue({
        email: 'other@example.com',
        slug: validDto.slug,
      });

      await expect(service.register(validDto)).rejects.toThrow(
        new ConflictException('SLUG_TAKEN'),
      );
      expect(argon2.hash).not.toHaveBeenCalled();
    });

    it('excludes soft-deleted users from uniqueness check', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('h');
      prisma.user.create.mockResolvedValue({
        id: 'u',
        email: validDto.email,
        displayName: validDto.displayName,
        slug: validDto.slug,
        createdAt: new Date(),
      });

      await service.register(validDto);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: validDto.email }, { slug: validDto.slug }],
          deletedAt: null,
        },
        select: { email: true, slug: true },
      });
    });
  });

  describe('login', () => {
    const validDto = { email: 'test@example.com', password: 'rightpass' };
    const dbUser = {
      id: 'user-uuid',
      email: validDto.email,
      passwordHash: 'stored-argon2-hash',
      role: 'USER',
      isPremium: false,
      displayName: 'Test',
      slug: 'test',
    };

    it('returns access token + user when credentials valid', async () => {
      prisma.user.findFirst.mockResolvedValue(dbUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      jwt.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login(validDto);

      expect(argon2.verify).toHaveBeenCalledWith(
        'stored-argon2-hash',
        'rightpass',
      );
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-uuid',
          email: validDto.email,
          role: 'USER',
          isPremium: false,
          jti: expect.any(String),
        }),
      );
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        user: {
          id: 'user-uuid',
          email: validDto.email,
          displayName: 'Test',
          slug: 'test',
        },
      });
    });

    it('throws UnauthorizedException INVALID_CREDENTIALS when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(validDto)).rejects.toThrow(
        new UnauthorizedException('INVALID_CREDENTIALS'),
      );
      expect(argon2.verify).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when user is OAuth-only (no passwordHash)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...dbUser,
        passwordHash: null,
      });

      await expect(service.login(validDto)).rejects.toThrow(
        new UnauthorizedException('INVALID_CREDENTIALS'),
      );
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException on wrong password (does not disclose user exists)', async () => {
      prisma.user.findFirst.mockResolvedValue(dbUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(validDto)).rejects.toThrow(
        new UnauthorizedException('INVALID_CREDENTIALS'),
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('excludes soft-deleted users from lookup', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(validDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: validDto.email, deletedAt: null },
        select: expect.any(Object),
      });
    });
  });
});
