# Architecture

## Source of truth

The authoritative product requirements + architecture spec is [PRD.md](./PRD.md). This file captures the **current implemented state** of the repo (which diverges from PRD as MVP is built). Engineering rules (conventions, hard rules) live in [../AGENTS.md](../AGENTS.md).

## Workspace layout

Nx monorepo, package manager: `npm`.

```
tripico/
├── apps/
│   ├── backend/        # NestJS API (workers + WebSocket gateways will live here)
│   ├── backend-e2e/    # Jest + supertest integration tests for backend
│   ├── tripico/        # Angular SSR frontend (PWA)
│   └── tripico-e2e/    # Playwright e2e for frontend
├── docs/               # ADRs, runbooks, this doc, PRD
├── AGENTS.md           # engineering rules (auto-loaded by Claude Code)
├── CLAUDE.md           # workflow + skill triggers
└── nx.json             # workspace config
```

## App boundaries

- **`backend`** owns: REST API (`/api/v1/*`), auth, DB access via Prisma, BullMQ workers, WebSocket gateways (`/chat`, `/notifications`), webhook handlers (Stripe, R2).
- **`tripico`** owns: SSR-rendered Angular app, hydration, PWA shell, Mapbox integration, socket.io-client.
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

## Current state

- Angular SSR scaffold + Express server (committed 2026-05)
- NestJS backend scaffold (default Nx generator output, no domain modules yet)
- Prisma installed but no schema modeled yet (only generator + datasource)
- No deployment configured

Update this file when: new domain module added to backend, new app added to workspace, deployment topology changes, shared lib extracted.