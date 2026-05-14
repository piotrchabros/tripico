# Deployment runbook — staging & production

## Topology

```
Browser ──▶ Vercel (Angular SSR)
                │
                │ vercel.json rewrites /api/*
                ▼
            Railway (NestJS) ──▶ Neon (PostgreSQL)
                                       │
                                       └─ pgvector / pg_trgm (Phase 2)
```

- **Frontend** on Vercel — Angular CSR + SSR for static auth pages
- **Backend** on Railway — Node 22, exposes `/api/v1/*` over HTTPS
- **Database** on Neon — pooled connection string for Prisma adapter

Same-origin from the browser's POV: Vercel proxies `/api/*` to Railway, so no CORS preflight on the production user path.

---

## Phase A code (done in this branch, pre-deploy)

| Concern | Where | What changed |
|---|---|---|
| Frontend API base URL | `apps/tripico/src/environments/environment.{ts,prod.ts}` + `project.json` fileReplacements | Dev: `http://localhost:3000/api/v1`. Prod: `/api/v1` (Vercel proxy). |
| Health check | `apps/backend/src/health/health.controller.ts` | `GET /api/v1/health` returning `{ status, db, uptimeSeconds, timestamp }`. Railway uses this as `healthcheckPath`. |
| Migration runner | npm scripts | `npm run prisma:deploy` (uses `migrate deploy`, not `dev`). Wired into Railway start: `npm run backend:release && npm run backend:start`. |
| Dev token leak | `apps/backend/src/auth/auth.service.ts` | `devToken` only appears in `request-verification` / `forgot-password` response when `EMAIL_DEV_TOKENS=true` env is set. Default OFF. |
| CORS | `apps/backend/src/main.ts` | Reads `CORS_ALLOWED_ORIGINS` (comma-separated). Dev fallback: `localhost:4200`. |
| Helmet | `apps/backend/src/main.ts` | `app.use(helmet())` — default header set. |
| Railway config | `railway.json` | NIXPACKS build, healthcheck, restart policy |
| Vercel config | `vercel.json` | build command, rewrite `/api/*` → Railway URL (PLACEHOLDER — update with real domain) |

---

## Phase B — Staging (manual steps)

### 1. Push branch to GitHub

```bash
git push origin main
```

(or whatever branch is target; Railway + Vercel both watch GitHub).

### 2. Generate production JWT keypair

Generate a fresh pair (NOT the dev keys):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tmp/jwt-staging-private.pem
openssl rsa -pubout -in /tmp/jwt-staging-private.pem -out /tmp/jwt-staging-public.pem
cat /tmp/jwt-staging-private.pem  # copy into Railway env (multi-line OK)
cat /tmp/jwt-staging-public.pem   # copy into Railway env
rm /tmp/jwt-staging-*.pem         # DON'T commit
```

### 3. Provision Neon database (staging)

1. neon.tech → New project → name `tripico-staging`, region `eu-central-1` (Frankfurt — closest to Railway EU, latency to Polish users)
2. Copy the **pooled** connection string (`postgresql://...?sslmode=require&pgbouncer=true`)
3. Save as `DATABASE_URL` for the Railway service

### 4. Railway service (staging)

1. railway.app → New Project → Deploy from GitHub repo → select this repo
2. Service settings:
   - **Root directory**: leave empty (monorepo build runs from root)
   - **Build command**: covered by `railway.json` (`npm ci && npm run build:backend`)
   - **Start command**: covered by `railway.json` (`npm run backend:release && npm run backend:start`)
3. Environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<Neon pooled URL from step 3>
   JWT_PRIVATE_KEY=<multi-line PEM from step 2>
   JWT_PUBLIC_KEY=<multi-line PEM from step 2>
   CORS_ALLOWED_ORIGINS=https://tripico-staging.vercel.app
   PORT=8080
   ```
   (PORT — Railway exposes its own; let Railway override if not provided.)
4. Once first deploy is green, copy the public Railway URL (`https://<service-name>.up.railway.app`).
5. Hit `https://<railway-url>/api/v1/health` — expect `{ "status": "ok", "db": "ok", ... }`.

### 5. Update `vercel.json` with the Railway URL

Edit the placeholder:

```json
"destination": "https://<your-railway-url>.up.railway.app/api/$1"
```

Commit + push. Vercel build will pick this up.

### 6. Vercel project (staging)

1. vercel.com → Add New Project → Import this repo
2. Framework preset: **Other** (we use Nx build, not the auto-detect)
3. Build command: `npm run build:frontend`
4. Output directory: `dist/apps/tripico`
5. Install command: `npm ci`
6. Environment variables: none required (API URL is already in the bundled prod env file + rewrite)
7. Deploy. Copy the assigned URL (e.g. `tripico-staging.vercel.app`).
8. Update Railway `CORS_ALLOWED_ORIGINS` env with this exact URL if it differs from what you set in step 4. Restart the Railway service.

### 7. Smoke test staging end-to-end

```bash
# Replace with your real Vercel URL.
STAGING_BASE=https://tripico-staging.vercel.app

# Health (proxied → Railway)
curl -s $STAGING_BASE/api/v1/health | jq

# Public trip list (should be [] until you seed one)
curl -s $STAGING_BASE/api/v1/trips | jq

# Manual UI checks in browser:
# 1. /register — create a user
# 2. /login — confirm cookie set, /api/v1/auth/me returns user
# 3. /create — gated, expect EMAIL_NOT_VERIFIED banner
# 4. Verify email via API (token is in Railway logs since
#    EMAIL_DEV_TOKENS is unset — or set it on staging to ease iteration)
```

---

## Phase C — Production

1. **Neon production branch** — Use Neon branching to create a `prod` branch off `main`. Or a separate project `tripico-prod` if you want hard isolation. Apply migrations: Railway prod service runs `prisma migrate deploy` on every release.
2. **Railway production service** — separate service (not the staging one). Same env-var shape but production secrets. Use Railway's "Deploy from branch" gated to `main`.
3. **Vercel production deployment** — `main` branch → production by default. Update CORS allowlist on Railway to include the production Vercel URL + your real domain once DNS is cut.
4. **Custom domain** — point `tripico.pl` at Vercel; the API stays behind the same domain via the same `/api/*` rewrite.

---

## Rollback

- **Railway**: each release is versioned; "Rollback" button reverts the service to a previous deployment.
- **Vercel**: each deployment is an immutable URL; promote a prior one to production.
- **Neon**: migrations are forward-only (we never write down migrations). Use Neon's PITR to roll back data state if a release corrupted records. Keep migrations backward-compatible per [AGENTS §4](../AGENTS.md) so a Railway rollback doesn't crash.

---

## Known gaps still to address (out of scope for first staging cut)

- Real email provider (Resend/Postmark) — currently `EMAIL_DEV_TOKENS` workflow is the only way for users to finish verification. Acceptable for staging; **MUST NOT** ship to prod with this flag on.
- Rate limiting (`@nestjs/throttler`) on auth endpoints — see [docs/security.md](./security.md).
- pgvector / FTS extensions — enable on Neon when AI categorization milestone lands.
- Sentry + PostHog integration.
- BullMQ + Redis (Upstash) for async work.
