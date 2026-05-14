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
**Trade-off**: A naive prod deploy would leak verification tokens to attackers via the API response. **Follow-through (May 2026):** `devToken` is now only surfaced when `EMAIL_DEV_TOKENS=true` env is set; default OFF. Same gate covers `POST /auth/forgot-password`. Same caveat remains until a real email provider lands.

### ADR-008: Vercel `/api/*` rewrite proxies to Railway, no browser CORS (2026-05)

**Decision**: Production `vercel.json` carries a `rewrites` entry mapping `/api/(.*)` to `https://tripico-production.up.railway.app/api/$1`. The Angular bundle uses a relative `apiBaseUrl: '/api/v1'` in prod — every HTTP call stays same-origin from the browser's perspective. CORS on the backend is still on (defense-in-depth) but the user hot path never triggers a preflight.
**Rationale**: Simplest path to a working cross-host deploy. Avoids leaking the Railway hostname into client bundles, eliminates a class of CORS bugs (preflight, credentialed requests, cookie SameSite), and lets us swap Railway for a different backend host by editing one line of `vercel.json`.
**Trade-off**: Vercel adds an edge hop on every API request (latency, cost). WebSocket can't reuse the rewrite (Vercel's rewrites are HTTP-only), so chat traffic talks directly to Railway — frontend carries a separate `wsBaseUrl` for that. Each time the Railway hostname changes (or we promote a new prod deploy URL), `vercel.json` needs a corresponding edit + push.

### ADR-009: Static-only Angular build, SSR runtime dropped (2026-05)

**Decision**: `apps/tripico/project.json` no longer declares `outputMode: 'server'`, `server`, or `ssr` options on the build target. `@angular/build:application` falls back to a plain SPA build emitting `dist/apps/tripico/browser/index.html`. `app.routes.server.ts` still exists (all entries set to `RenderMode.Client`) but the SSR runtime never ships. Vercel serves the resulting bundle as static + SPA-fallback rewrite.
**Rationale**: First Vercel deploy returned 404 across the board — the SSR output was `dist/apps/tripico/{browser,server}/` with only `browser/index.csr.html` (no `index.html` at any path Vercel could auto-serve). All routes were already `RenderMode.Client` so the SSR runtime was rendering nothing useful, and switching to pure static is the smallest change that produces a Vercel-deployable artifact.
**Trade-off**: Lose SEO/LCP benefit on the static landing routes (`/login`, `/register`). Re-introducing SSR requires either an absolute prod API URL for the SSR pass (vs the relative `/api/v1` which only works in browser context) or a Vercel adapter that handles Angular's `outputMode: 'server'` layout — both bigger lifts than the MVP needs right now.

### ADR-010: PostHog Cloud EU + identified_only profiles + build-time key injection (2026-05)

**Decision**: PostHog Cloud EU (`https://eu.i.posthog.com`) for product analytics. Single project key shared by frontend (`posthog-js`) and backend (`posthog-node`). Frontend `AnalyticsService` calls `posthog.init` with `person_profiles: 'identified_only'` and `capture_pageview: false` (we capture `$pageview` manually on Angular's `NavigationEnd`). Identity is kept in sync with `AuthStateService.user()` via an `effect` (identify on login, reset on logout). Backend `PostHogService` (`@Global`) captures domain events (`trip_published`, `join_requested`, `join_approved`) with `distinctId = userId` so FE + BE events merge on a single person. The `phc_` key is injected at build time from Vercel/Railway env vars via `scripts/inject-build-env.mjs` (FE) and `process.env` (BE); `environment.prod.ts` is gitignored.
**Rationale**: PostHog Cloud EU keeps data residency in EU per PRD §16. `identified_only` keeps anonymous traffic out of person profiles (cleaner funnels, lower MTU billing). Build-time injection means the `phc_` value never sits in the repo even though it's technically a public key — easier rotation, no need to track which commits leaked which key. Same key for FE + BE means events stitched on `distinctId` correlate cross-source without extra alias plumbing.
**Trade-off**: Frontend bundle ships with the PostHog key embedded — anyone can scrape it from network/source. PostHog's design accepts this (their key-rotation flow assumes public exposure), but we still treat it as injectable + rotatable just in case. Each environment (staging/prod) needs the key configured in BOTH Vercel AND Railway separately; mismatch silently degrades coverage.

### ADR-011: Pin npm to 9.9.4 via `packageManager` field + corepack onboarding (2026-05)

**Decision**: `packageManager: "npm@9.9.4"` in `package.json`. New `scripts/check-npm-version.mjs` runs as `preinstall` and aborts with a clear error when the running npm version doesn't match. Devs onboard with `corepack enable && corepack prepare npm@9.9.4 --activate` once per machine; CI/Railway pick up the same version automatically because nixpacks' Node 24 ships npm 9.x.
**Rationale**: Railway's `npm ci` rejected three different lockfiles over a single afternoon because my local npm 11 writes metadata that npm 9 can't verify (`EUSAGE: Missing <transitive> from lock file`). Pinning + a preinstall guard prevents that class of regression silently slipping into a commit. `verify:lockfile` npm script (just `npm ci --dry-run`) gives a local pre-push check that mirrors Railway exactly. `@noble/hashes` override at `1.8.0` handles the `jsdom`-vs-`pkijs` peer mismatch that npm 9 surfaced (npm 11 had been silently tolerating it).
**Trade-off**: One more onboarding step (corepack enable). Devs without corepack can `SKIP_NPM_VERSION_CHECK=1` if they really need to, but the safer path is to install corepack. We're tied to an older npm than the team's defaults — when Railway upgrades nixpacks Node, we may need to bump together.

---

## Bug Log

_Append fixes here with root cause, not just symptom. Format:_

```
### BUG: Short title (YYYY-MM)
**Cause**: Root cause.
**Fix**: What was changed.
```

_No entries yet._
