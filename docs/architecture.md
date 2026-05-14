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
│   ├── tripico/         # Angular SSR frontend (PWA, scaffold only)
│   └── tripico-e2e/     # Playwright e2e for frontend
├── docs/                # ADRs, runbooks, this doc, PRD
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
| `prisma/` | `PrismaService` extends `PrismaClient` with `PrismaPg` adapter (PRD §12, ADR-004). `@Global` so any service can inject. |
| `shared/` | Cross-cutting: `filters/http-exception.filter.ts` (RFC 7807), `constants/enums.ts` (TS unions mirrored from Prisma), `utils/slug.ts`. |
| `app/` | Composition root. |

API prefix: `/api/v1/*` (set in `main.ts`).

## App boundaries

- **`backend`** owns: REST API, auth, DB via Prisma, WebSocket gateways. BullMQ workers + Redis adapter planned but not yet wired.
- **`tripico`** owns: SSR-rendered Angular app, hydration, PWA shell, Mapbox, socket.io-client. Pages not yet implemented beyond Nx scaffold.
- **No shared lib yet.** When DTO types start duplicating between FE/BE, extract to `libs/shared-types`.

## Deployment topology

Per PRD §13 (target — not yet provisioned):

| Layer | Provider |
|---|---|
| Frontend SSR | Vercel |
| Backend API + workers | Railway |
| Postgres | Neon |
| Redis | Upstash |
| Object storage | Cloudflare R2 |
| Image variants | Cloudflare Images |
| Video | Cloudflare Stream |
| CDN/WAF | Cloudflare |

## Current state (May 2026)

- Backend: 99 unit tests across 8 modules, all green. Local Postgres connected, 5 migrations applied.
- Auth: register, login, refresh rotation, logout, /me, email verification (mock-email — token logged + returned in response).
- Trips: full CRUD, slug auto-generation (PL-safe), publish/cancel transitions, discovery filters (country, transport, dates, price range, search).
- Memberships: join/approve/reject/leave with transactional currentMembers + FULL↔PUBLISHED transitions. Notifications wired into the flow.
- Board posts: text posts, member-only, author/organizer-only moderation.
- Chat: Socket.io gateway, JWT handshake auth, room-per-trip, persist-before-broadcast. REST history fetch.
- Notifications: per-user feed, unreadCount, mark-read.
- Frontend: Angular SSR scaffold only — no domain pages yet.
- No deployment configured.

## Deferred (per PRD §4 MVP backlog)

AI categorization (Anthropic Haiku), media uploads (R2 presigned), payments (Stripe), OAuth (Google/Facebook), password reset, KYC verification, admin/moderation panel, BullMQ workers + Redis, ranking computation, FTS via tsvector + GIN.

Update this file when: new domain module added to backend, new app added to workspace, deployment topology changes, shared lib extracted.
