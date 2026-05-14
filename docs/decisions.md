# Architecture Decisions & Bug Log

Append-only. Never delete entries. Newest at the bottom of each section.

---

## ADRs (Architecture Decision Records)

### ADR-001: Use Nx monorepo (2026-05)

**Decision**: Single Nx workspace hosting backend + frontend + e2e apps.
**Rationale**: Single TS toolchain, shared types via `libs/`, atomic refactors across stack, simpler CI.
**Trade-off**: Heavier tooling vs separate repos; harder to grant partial access (e.g. open-sourcing FE only).

### ADR-002: Angular 21 with SSR + Hydration (2026-05)

**Decision**: Angular standalone components, signals, control flow, Universal SSR with client hydration.
**Rationale**: SEO for trip discovery pages; LCP target < 2.5s per PRD §13.
**Trade-off**: Larger initial complexity vs CSR-only; SSR cold starts on Vercel.

### ADR-003: Engineering rules in AGENTS.md, not CLAUDE.md (2026-05)

**Decision**: Project-specific engineering rules (stack, hard rules, conventions) live in `AGENTS.md` at root.
**Rationale**: Standard convention recognized by both Claude Code and Codex CLI. CLAUDE.md is reserved for Claude-specific workflow (Dawid persona, skill triggers).
**Trade-off**: Cursor's `.mdc` format with `globs`/`alwaysApply` not used; need to manually re-add for Cursor support.

### ADR-004: Prisma 7 with PrismaPg driver adapter (2026-05)

**Decision**: Use Prisma 7's new `prisma-client` generator (TS-native client generated to `src/generated/prisma/`) + `@prisma/adapter-pg` driver adapter wrapping `pg`. `PrismaService` constructs `new PrismaPg({ connectionString: process.env.DATABASE_URL })` and passes it to `super({ adapter })`. Schema datasource has no `url` field; CLI reads `DATABASE_URL` via `prisma.config.ts` + dotenv.
**Rationale**: Prisma 7 retired the Rust query engine. The pure-JS driver adapter path is now mandatory for new projects — there is no Prisma-5/6-style "just put url in schema and it works" route. PrismaPg + pg is the official PostgreSQL recipe per Prisma's NestJS guide.
**Trade-off**: One extra runtime dependency (`pg`) compared to Rust-engine Prisma. Slightly more constructor wiring in `PrismaService`. Connection pooling now configured on `pg` side, not Prisma. Existing Prisma docs/tutorials assuming `import { PrismaClient } from '@prisma/client'` no longer apply — must import from generated path.

### ADR-005: Global JwtAuthGuard via APP_GUARD + `@Public()` opt-out (2026-05)

**Decision**: `JwtAuthGuard` registered as `APP_GUARD` in `AuthModule` so every controller is protected by default. Endpoints that should remain anonymous (register, login, refresh, logout, verify-email, list/get trips, get trip by slug) are explicitly marked with `@Public()`. The guard reads `Authorization: Bearer <token>`, verifies via `JwtService.verifyAsync`, and attaches a typed `AuthenticatedUser` to `req.user`. A `@CurrentUser()` parameter decorator surfaces that to handlers.
**Rationale**: Default-deny is safer than default-allow — easy to miss applying a guard on a new endpoint; impossible to miss removing `@Public()`. Single global guard avoids ad-hoc `@UseGuards()` repetition. NestJS Reflector handles class + handler-level metadata.
**Trade-off**: Anonymous browse endpoints now require an extra decorator; forgetting `@Public()` returns 401 instead of working. Tests must consider the guard exists when adding integration tests (handled by `Test.createTestingModule` providing the guard).

### ADR-006: Argon2id + RS256 access + httpOnly refresh cookie + family rotation (2026-05)

**Decision**: Passwords hashed with Argon2id (memory=64 MiB, t=3, p=4 per PRD §12). Access tokens are RS256-signed JWTs (15-min TTL) carrying `{ sub, email, role, isPremium, emailVerified, jti, iss=tripico }`. Refresh tokens are 256-bit `crypto.randomBytes(32)` base64url strings stored as SHA-256 hashes in `RefreshToken { tokenHash, family, expiresAt, userAgent, ip }`. Refresh sets `tripico_rt` httpOnly Secure SameSite=Strict cookie with `path=/api/v1/auth`. On refresh, the old token is revoked and a new one issued in the same family; presenting a revoked token revokes the entire family (theft mitigation).
**Rationale**: Matches PRD §12 verbatim. RS256 supports public-key JWT verification on edge / SSR without leaking the signing key. httpOnly cookie keeps the refresh out of JS reach, mitigating XSS. Family rotation lets us detect token replay deterministically. Argon2id beats bcrypt per current OWASP guidance.
**Trade-off**: RSA keys must be provisioned per environment — currently a manual `openssl` step documented in `apps/backend/.env.example`. Family revocation cascade adds one `updateMany` to the reuse path. Cookie scope `path=/api/v1/auth` means `/refresh` and `/logout` are the only endpoints that see the cookie — by design.

### ADR-007: Mock email-verification flow returns `devToken` inline (2026-05)

**Decision**: Until Resend/Postmark is wired, `POST /auth/request-verification` logs the generated token at LOG level and includes it in the response body as `devToken`. Production rollout flips this off via env flag or simply removes the field once the email provider is configured. `POST /auth/verify-email` accepts the raw token, hashes it, marks `emailVerifiedAt`.
**Rationale**: Lets the gate (trip-create, trip-join require `emailVerified`) be tested end-to-end without an email service. Cheaper than mocking an SMTP server in dev. Keeps the verification surface stable for the FE — only the delivery channel changes.
**Trade-off**: A naive prod deploy would leak verification tokens to attackers via the API response. Strict mitigation: env-gated `SHOW_DEV_TOKENS` defaulting to false, plus a CI check. Until provider is in place, also a security finding to flag in `docs/security.md` (done).

---

## Bug Log

_Append fixes here with root cause, not just symptom. Format:_

```
### BUG: Short title (YYYY-MM)
**Cause**: Root cause.
**Fix**: What was changed.
```

_No entries yet._
