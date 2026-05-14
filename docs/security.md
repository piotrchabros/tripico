# Security

## Engineering rules

The canonical security rules are in [AGENTS.md §8](../AGENTS.md) — Helmet, CORS allowlist, rate limiting, input validation, webhook signatures, etc. This file complements those with **runbook-style** info: known surfaces, threat model notes, incident history.

## Current implementation status (May 2026)

| Control | Status |
|---|---|
| Argon2id password hashing (PRD §12 params) | ✅ implemented + tested |
| RS256 JWT access tokens (15 min, full claim set) | ✅ implemented |
| Refresh token rotation + family revocation | ✅ implemented + tested ([ADR-006](./decisions.md)) |
| httpOnly Secure SameSite=Strict refresh cookie | ✅ implemented (Secure flag prod-only) |
| Global JwtAuthGuard + @Public opt-out | ✅ implemented ([ADR-005](./decisions.md)) |
| Email-existence non-disclosure on bad-login | ✅ (`INVALID_CREDENTIALS` for both unknown email + wrong password) |
| RFC 7807 problem+json error envelope | ✅ via `HttpExceptionFilter` |
| Email verification (+ gate on create-trip / join) | ✅ — **delivery is mock** (`devToken` env-gated behind `EMAIL_DEV_TOKENS=true`, default OFF — [ADR-007](./decisions.md)) |
| Password reset with all-session revocation | ✅ — `forgot-password` / `reset-password` flow + bulk `revokedAt` on all active refresh tokens of that user |
| Helmet middleware | ✅ — `app.use(helmet())` in `main.ts`, default header set |
| CORS allowlist | ✅ — driven by `CORS_ALLOWED_ORIGINS` env (comma-separated), localhost dev fallback. Prod (Railway) set to the Vercel domain |
| Rate limiting (`@nestjs/throttler` + Redis) | ❌ — see PRD §12 rate-limit matrix; needs Upstash + module wiring |
| `@nestjs/config` + Zod schema validation on boot | ❌ — currently reads `process.env` directly |
| Webhook signature verification | n/a — no webhooks yet |
| Admin IP allowlist | n/a — no admin endpoints yet |
| WebSocket JWT auth (handshake) | ✅ inside `ChatGateway.handleConnection` |
| WebSocket room membership check on join_trip | ✅ via `ChatService.canParticipate` |
| Persist-before-broadcast for chat | ✅ |

## Threat model — MVP scope

_To be filled in. Cover at minimum:_
- Auth surface (registration, login, refresh rotation, password reset)
- Webhook surface (Stripe, R2, Cloudflare)
- File upload surface (R2 presigned URLs, NSFW pipeline)
- Admin surface (`/admin` endpoints + IP allowlist)
- WebSocket surface (gateway JWT verification + room membership checks)

## Known surfaces requiring extra review

| Area | Why | Mitigation |
|---|---|---|
| Membership approve / leave | Race on `Trip.currentMembers` increment / decrement | ✅ `$transaction` wrapping both updates |
| Refresh cookie | Token theft via XSS / stolen cookie | ✅ httpOnly + Secure (prod) + family rotation + reuse revocation |
| Email verification `devToken` | Token leaked in HTTP response in dev mode | ✅ — `EMAIL_DEV_TOKENS=true` env required to surface, default OFF ([ADR-007](./decisions.md)). Same flag covers password-reset tokens. Must stay unset on production until real email provider lands. |
| Password reset session revocation | Stolen refresh token survives a reset | ✅ — `resetPassword` runs `prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })` inside the same transaction as the hash update. |
| JWT private key | Local PEM in `apps/backend/.env` (gitignored) | ✅ — but document handoff to production secret manager when deploying |
| Chat broadcast | User outside room could receive others' messages | ✅ gateway joins `trip:<id>` room only after `canParticipate` check; `server.to(room).emit(...)` scopes |

## Secrets management

- **Local**: `apps/backend/.env` (gitignored via root `.gitignore`). `dotenv` loads at backend boot.
- **Production (planned)**: Railway / Vercel env vars
- **Validation**: Zod schema in `apps/backend/src/config/` — **TBD**. Currently `JwtModule.registerAsync` throws clearly when keys missing, but other env vars are unvalidated.
- **Failed validation** → crash on boot (do NOT run with bad config) — planned, not enforced yet.

### Generating JWT keys (per dev machine)

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out public.pem
# paste contents into apps/backend/.env as JWT_PRIVATE_KEY / JWT_PUBLIC_KEY
```

## `.env.example`

Authoritative list of required env vars lives in `apps/backend/.env.example`. Every new env var added to code → update `.env.example` in the same PR.

Currently documented:
- `DATABASE_URL` — Postgres connection string (Neon pooled URL in prod)
- `JWT_PRIVATE_KEY` (multi-line PEM)
- `JWT_PUBLIC_KEY` (multi-line PEM)
- `CORS_ALLOWED_ORIGINS` — comma-separated origin allowlist for prod (Vercel domain)
- `EMAIL_DEV_TOKENS` — when `"true"` exposes verification / password-reset tokens in API responses ([ADR-007](./decisions.md)). MUST stay unset in production
- `POSTHOG_API_KEY` + `POSTHOG_HOST` — backend analytics ([ADR-010](./decisions.md)). Unset = silent no-op.

Frontend production env is materialised at build time from Vercel project env vars via `scripts/inject-build-env.mjs` reading `environment.prod.template.ts` — see [ADR-010](./decisions.md) + [docs/deploy.md](./deploy.md).

## Incident history

_No incidents yet. Document Sentry alerts that required code changes here, format:_

```
### INCIDENT: Short title (YYYY-MM-DD)
**Detection**: How spotted (Sentry, user report, monitoring).
**Impact**: Scope (users affected, data exposed).
**Root cause**: What broke.
**Fix**: What changed.
**Prevention**: Test added / rule added / monitoring added.
```
