# Architecture

## Source of truth

The authoritative product requirements + architecture spec is [PRD.md](./PRD.md). This file captures the **current implemented state** of the repo (which diverges from PRD as MVP is built). Engineering rules (conventions, hard rules) live in [../AGENTS.md](../AGENTS.md).

## Workspace layout

Nx monorepo, package manager: `npm`.

```
tripico/
├── apps/
│   ├── backend/         # NestJS API + WebSocket gateways
│   ├── backend-e2e/     # Jest + supertest integration tests
│   ├── tripico/         # Angular SPA (static-only build, see ADR-009)
│   └── tripico-e2e/     # Playwright smoke tests
├── docs/                # ADRs, runbooks, this doc, PRD, deploy runbook
├── scripts/             # Build-time env injection + npm version guard
├── nixpacks.toml        # Railway build phases
├── railway.json         # Railway service (healthcheck, restart policy)
├── vercel.json          # Vercel build + /api/* rewrite to Railway
├── AGENTS.md            # engineering rules (auto-loaded by Claude Code)
├── CLAUDE.md            # Dawid workflow + skill triggers
└── nx.json              # workspace config
```

## Backend modules (`apps/backend/src/`)

| Module | Purpose |
|---|---|
| `auth/` | Register, login, refresh rotation, logout, /me, email verification. Owns `JwtAuthGuard` (global via APP_GUARD), `@Public()` / `@CurrentUser()`. |
| `trips/` | Trip CRUD + publish/cancel + discovery filters. Memberships (join/approve/reject/leave + list) live here too — both share the trips domain. |
| `board/` | BoardPost CRUD (text only for now); member-only access; organizer can moderate-delete. |
| `chat/` | Socket.io gateway (namespace `/chat`) + REST history fetch. Handshake JWT auth. Persist-then-broadcast. |
| `notifications/` | Global module exposing `NotificationsService.create()` to domain services. REST `/me/notifications` for list + mark-read. |
| `health/` | `GET /api/v1/health` with DB probe. Targeted by Railway `healthcheckPath`. |
| `posthog/` | `@Global` `PostHogService` wrapping `posthog-node`. Reads `POSTHOG_API_KEY` + `POSTHOG_HOST` (default eu.i.posthog.com). No-op when key absent. Captures `trip_published`, `join_requested`, `join_approved`. |
| `prisma/` | `PrismaService` extends `PrismaClient` with `PrismaPg` adapter (PRD §12, ADR-004). `@Global` so any service can inject. |
| `shared/` | Cross-cutting: `filters/http-exception.filter.ts` (RFC 7807), `constants/enums.ts` (TS unions mirrored from Prisma), `utils/slug.ts`. |
| `app/` | Composition root. |

API prefix: `/api/v1/*` (set in `main.ts`). Server listens on `0.0.0.0` (Railway container reachability). Helmet middleware on. CORS allowlist from `CORS_ALLOWED_ORIGINS` env var (comma-separated), localhost dev fallback.

## Frontend modules (`apps/tripico/src/app/`)

| Area | Purpose |
|---|---|
| `core/auth-state.service.ts` | Signal-based session store (`accessToken`, `user`, `isAuthenticated`) persisted to `sessionStorage`; SSR-safe `typeof window` checks. |
| `core/auth-api.service.ts` | `register`/`login`/`refresh`/`logout`/`requestVerification`/`verifyEmail`. Login + refresh tap into `AuthStateService` and PostHog identify. |
| `core/trips-api.service.ts` | Full trip + memberships surface: `list`, `listMine`, `getBySlug`, `create`, `publish`, `cancel`, `join`, `leave`, `listMemberships`, `approveMembership`, `rejectMembership`. |
| `core/chat.service.ts` | One Socket.io connection per session; `loadHistory` (REST) + `connect`/`joinTrip`/`leaveTrip`/`sendMessage` with promise-style ack. Signals: `connected`, `messages`, `error`. |
| `core/analytics.service.ts` | `posthog-js` wrapper. Init on `provideAppInitializer`, `$pageview` on `NavigationEnd`, `identify`/`reset` synced to `AuthStateService.user()` via `effect`. Silent no-op when key empty/placeholder. |
| `core/auth.guard.ts` | `authMatchGuard` (`CanMatchFn`) — gates `/create` and `/me/trips`; lazy chunks not loaded for anonymous. |
| `core/auth.interceptor.ts` | Functional `HttpInterceptorFn` attaching `Authorization: Bearer` from `AuthStateService`. |
| `pages/` | One lazy-loaded standalone component per route (see Routing below). |
| `components/trip-chat.component.ts` | Drop-in chat panel on trip detail; only rendered for active MEMBER + ORGANIZER. |
| `environments/environment{,.prod.template}.ts` | Build-time config. Prod template tokens (`__POSTHOG_API_KEY__`) replaced by `scripts/inject-build-env.mjs` from Vercel env vars. Generated `environment.prod.ts` is gitignored. |

Styling: Tailwind v4 via `.postcssrc.json` (root) + `@source "../**/*.html"` + `@source "../**/*.ts"` directives in `styles.css` so utilities inline-templated in component `.ts` files are picked up.

## Routing

| Path | Component | Auth |
|---|---|---|
| `/` | `TripsListPage` | public — banner prompts verify-email when authenticated & not verified |
| `/login` | `LoginPage` | public |
| `/register` | `RegisterPage` | public; auto-login on success |
| `/verify-email` | `VerifyEmailPage` | public; reads `?token=` query, auto-verifies |
| `/create` | `CreateTripPage` | `authMatchGuard` → `/login` if anon |
| `/me/trips` | `MyTripsPage` | `authMatchGuard`; status filter tabs |
| `/wycieczka/:slug` | `TripDetailPage` | public; membership UI + chat for MEMBER/ORGANIZER |

## App boundaries

- **`backend`** owns: REST API, auth, DB via Prisma, WebSocket gateways, server-side analytics capture. BullMQ workers + Redis adapter planned but not yet wired.
- **`tripico`** owns: Angular SPA (static-only, see ADR-009), PWA shell (deferred), Mapbox (deferred), socket.io-client.
- **No shared lib yet.** When DTO types start duplicating between FE/BE, extract to `libs/shared-types`.

## Deployment topology — staging is live (May 2026)

| Layer | Provider | URL |
|---|---|---|
| Frontend | Vercel | `https://tripico-alpha.vercel.app` |
| Backend | Railway | `https://tripico-production.up.railway.app` |
| Database | Neon (EU/Frankfurt) | `ep-ancient-meadow-aqw6zbyz-pooler.c-8.us-east-1.aws.neon.tech` |
| Analytics | PostHog Cloud EU | `https://eu.i.posthog.com` |

Browser sees a single origin: `vercel.json` rewrites `/api/*` → Railway origin. The browser never makes a cross-origin call → no CORS preflight on the hot user path (ADR-008). WebSocket can't reuse the rewrite (HTTP-only) so `chat.service.ts` connects directly to Railway via `wsBaseUrl`.

Build pipelines:
- **Vercel** — `npm run build:frontend` chains `node scripts/inject-build-env.mjs` (env-var → `environment.prod.ts`) and `nx build tripico --skip-nx-cache`. Output: `dist/apps/tripico/browser`. SPA-fallback rewrite (`/(.*)` → `/index.html`).
- **Railway** — `nixpacks.toml` overrides defaults: install phase `npm ci --include=dev` with empty `cacheDirectories=[]` (avoids EBUSY on `/app/node_modules/.cache` bind mount); build phase runs `prisma generate` before `nx build backend`; start phase runs `prisma migrate deploy` then boots `node dist/apps/backend/main.js`. `NPM_CONFIG_PRODUCTION=false` so devDeps stay through build.
- **npm** pinned to 9.9.4 via `packageManager` (matches Railway nixpacks default). `scripts/check-npm-version.mjs` runs as `preinstall` and aborts when the local npm differs (ADR-011).

Still planned per PRD §13: Upstash Redis (BullMQ), Cloudflare R2/Images/Stream, Cloudflare CDN/WAF.

## Current state (May 2026)

- Backend: 104 unit tests across 8 modules, all green. Deployed to Railway against Neon Postgres (6 migrations applied). Helmet on, CORS allowlist driven by `CORS_ALLOWED_ORIGINS` env, healthcheck at `/api/v1/health`.
- Auth: register, login, refresh rotation, logout, /me, email verification (mock-email — token surfaced via `devToken` only when `EMAIL_DEV_TOKENS=true`), password reset with all-session revocation.
- Trips: full CRUD, slug auto-generation (PL-safe), publish/cancel transitions, discovery filters (country, transport, dates, price range, search).
- Memberships: join/approve/reject/leave with transactional `currentMembers` + FULL↔PUBLISHED transitions. Notifications wired into the flow.
- Board posts: text posts, member-only, author/organizer-only moderation.
- Chat: Socket.io gateway, JWT handshake auth, room-per-trip, persist-before-broadcast. REST history fetch.
- Notifications: per-user feed, unreadCount, mark-read.
- Frontend: 7 routes shipped (`/`, `/login`, `/register`, `/verify-email`, `/create`, `/me/trips`, `/wycieczka/:slug`). Membership UI (join / approve / reject / leave / publish / cancel) + live chat on trip detail. Email-verify banner on dashboard. Static-only build (ADR-009).
- Analytics: PostHog Cloud EU baseline live (FE + BE). Events: `$pageview`, `user_registered`, `user_logged_in`, `user_logged_out`, `trip_created`, `trip_published`, `join_requested`, `join_approved`. `identified_only` person profiles (ADR-010).

## Deferred (per PRD §4 MVP backlog)

AI categorization (Anthropic Haiku), media uploads (R2 presigned), payments (Stripe), OAuth (Google/Facebook), KYC verification, admin/moderation panel, BullMQ workers + Redis, ranking computation, FTS via tsvector + GIN, real email provider (currently `EMAIL_DEV_TOKENS=true` workaround on staging — see [docs/security.md](./security.md) and [ADR-007](./decisions.md)), Sentry, rate limiting via `@nestjs/throttler`.

Update this file when: new domain module added to backend, new app added to workspace, deployment topology changes, shared lib extracted.
