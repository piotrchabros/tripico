import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Named throttler groups mirrored from PRD §12. Concrete endpoint
 * decorators (@Throttle({ login: { limit, ttl } })) pick the group
 * they want — defaults are loose enough that public reads aren't
 * affected. TTLs are milliseconds.
 *
 * Storage is the in-memory default for now; swap to Redis-backed
 * `ThrottlerStorageRedisService` once Upstash is provisioned
 * (PRD §13 deployment topology).
 */
export const throttlerConfig: ThrottlerModuleOptions = [
  // Loose default — applied to every route unless overridden. Keeps a
  // bare-minimum DoS lid on read endpoints.
  {
    name: 'default',
    ttl: 60_000,
    limit: 120,
  },
  // POST /auth/login — 5 / 15 min / IP. PRD says "+email" too; the
  // throttler only tracks by IP by default so the email dimension is
  // additionally enforced in the controller via a custom key (see
  // AuthController.login).
  {
    name: 'login',
    ttl: 15 * 60_000,
    limit: 5,
  },
  // POST /auth/register — 3 / hour / IP.
  {
    name: 'register',
    ttl: 60 * 60_000,
    limit: 3,
  },
  // POST /auth/forgot-password — 3 / hour / IP.
  {
    name: 'forgot-password',
    ttl: 60 * 60_000,
    limit: 3,
  },
  // POST /auth/refresh — 30 / min / userId (the throttler's IP-based
  // tracker is close enough until we layer in per-user keys).
  {
    name: 'refresh',
    ttl: 60_000,
    limit: 30,
  },
  // POST /auth/verify-email — 10 / hour / IP.
  {
    name: 'verify-email',
    ttl: 60 * 60_000,
    limit: 10,
  },
];
