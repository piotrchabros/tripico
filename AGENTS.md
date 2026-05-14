<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

# Tripico — Agent Engineering Rules

You are an engineering assistant for **Tripico**, a community-driven trip-finding PWA. Your authoritative source of architecture is `docs/PRD.md`. **Never invent architecture; read PRD first.** If PRD does not cover something, ask before coding.

---

## 1. Stack — non-negotiable

- **Backend:** NestJS 10+ (TypeScript strict), Prisma 5+, PostgreSQL 16 (Neon), Redis (Upstash), BullMQ, Socket.io + `@socket.io/redis-adapter`, Passport.js, Pino.
- **Frontend:** Angular 18+ (signals, standalone components, control flow `@if`/`@for`/`@switch`), Angular SSR (Universal + Hydration), Tailwind CSS, Angular CDK, Mapbox GL JS, socket.io-client.
- **Auth:** Custom Passport-based, JWT RS256 (access 15min + refresh 7d httpOnly cookie with rotation), Argon2id passwords.
- **Storage:** Cloudflare R2 (direct upload via presigned URLs) + Cloudflare Images (image variants) + Cloudflare Stream (video).
- **AI:** Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) for categorization; OpenAI `text-embedding-3-small` for embeddings (pgvector).
- **Payments:** Stripe (Subscriptions + Tax in MVP; Connect Express in Phase 2 — do NOT implement Connect features in MVP code).
- **Hosting:** Vercel (Angular SSR), Railway (NestJS + workers), Neon (Postgres), Upstash (Redis), Cloudflare (CDN/R2/Images/Stream/WAF).
- **Analytics:** PostHog Cloud EU, Sentry (FE + BE), Better Stack (logs + uptime).

**Do not propose alternative stacks.** If a library is missing for a task, propose adding it within the existing stack philosophy first.

---

## 2. Hard rules — violations are bugs

1. **Never use `any`.** Use `unknown` + narrowing, or proper types. If truly needed, write `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why.
2. **Never use `Date.now()` in business logic** — inject `ClockService` (custom) or use `dayjs` consistently. Required for testability.
3. **Never store JWT or refresh tokens in `localStorage`/`sessionStorage`.** Access token: Angular memory (signal/service). Refresh token: httpOnly Secure SameSite=Strict cookie set by backend.
4. **Never query DB without indexes for production paths.** If you add a `WHERE`, `ORDER BY`, or `JOIN` column, verify index exists in Prisma schema. If not, add it in the same PR.
5. **Never use raw SQL** unless absolutely required (ranking, FTS, pgvector). When you do, use `Prisma.$queryRaw` with parameterized templates — NEVER string concatenation.
6. **Never break the WebSocket auth contract.** Every WS Gateway method must be guarded by `WsJwtAuthGuard` + appropriate `TripMemberGuard`. No exceptions.
7. **Never block the API thread for >200ms.** Anything heavier (LLM, image processing, email, push) → BullMQ.
8. **Never delete records with `DELETE` for user-owned data.** Use soft delete (`deletedAt`). Hard delete only via GDPR data-erasure worker.
9. **Never log PII.** Pino is configured with `redact` for `email`, `phone`, `passwordHash`, `Authorization`. Don't bypass it. Use `userId` (UUID) only.
10. **Never put secrets in code or commit them.** Use `@nestjs/config` + Zod validation. Secrets live in Railway/Vercel env or `.env.local` (gitignored).

---

## 3. NestJS conventions

### Module structure
- One module per domain feature: `auth`, `users`, `trips`, `discovery`, `chat`, `board`, `media`, `notifications`, `billing`, `ai`, `moderation`, `admin`, `webhooks`.
- Each module exposes: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.gateway.ts` (if WS), `dto/`, `entities/` (if needed beyond Prisma).
- Shared cross-cutting concerns in `shared/`: guards, decorators, pipes, interceptors, filters.

### Service rules
- Services are **stateless**. No instance state beyond injected dependencies.
- Services are **thin** — orchestrate Prisma queries + domain logic + emit events. Business rules in services, not controllers.
- One service per concept; if a service grows past ~300 lines, split it (e.g. `TripService` → `TripQueryService` + `TripMutationService`).
- **`PrismaService` is a singleton** extending `PrismaClient` with `OnModuleInit` (`$connect`) and `OnModuleDestroy` (`$disconnect`). Never instantiate `new PrismaClient()` elsewhere.

### Controller rules
- Controllers are **dumb**. Only: parse input (DTO + ValidationPipe), call service, return response.
- Always use `@HttpCode()` explicitly for non-200 success codes.
- Always validate DTOs with `class-validator` decorators. For polymorphic JSONB payloads, use Zod schemas in a `ZodValidationPipe`.
- Response envelope for lists: `{ data: T[], meta: { cursor?: string, hasMore: boolean, total?: number } }`.
- Errors: throw NestJS HttpException subclasses (`BadRequestException`, `NotFoundException`, etc.) — never return error objects. Global `HttpExceptionFilter` formats as RFC 7807.

### Guards & decorators
- **`@Public()`** decorator marks endpoints that skip `JwtAuthGuard` (registered as global guard).
- **`@CurrentUser()`** parameter decorator returns typed `AuthenticatedUser`.
- **`@Roles('ADMIN')`** + `RolesGuard` for system roles.
- **`@TripRole('ORGANIZER')`** + `TripMemberGuard` for trip-level role checks. The guard reads `tripId` from `params.id`.
- **`@Idempotent()`** interceptor for write endpoints requiring `Idempotency-Key` header (mandatory: payments, trip creation; recommended: all mutations).

### Background jobs (BullMQ)
- One queue per domain action: `media-processing`, `nsfw-check`, `ai-classify`, `ranking-recompute`, `push-notifications`, `email`, `embeddings`.
- Workers in `apps/api/src/workers/` — each as `*.worker.ts` registered via `BullModule.registerQueue`.
- Job payloads are typed with explicit `JobData` interfaces. **Never `Record<string, unknown>`**.
- Workers must be **idempotent** — same job replayed must produce same result (use existence checks before mutations).
- Retry strategy: `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`. Configure per-queue based on cost (e.g. AI jobs cost money — limit retries).
- Failed jobs go to a dead-letter queue with manual review in admin panel (Phase 2 — for MVP just log + Sentry).

### WebSocket gateway
- One `ChatGateway` for `/chat` namespace, one `NotificationGateway` for `/notifications`.
- Apply `WsJwtAuthGuard` via `@UseGuards()` on every `@SubscribeMessage`. JWT comes from `client.handshake.auth.token`.
- Always validate room membership before broadcasting. **A user-initiated broadcast to a room they're not in is a security bug.**
- Persist to DB **before** broadcasting. Never emit messages that don't exist in DB.
- Rate limit chat messages per user: 30 messages / 10s (Redis-backed).

---

## 4. Prisma rules

- Single source of truth: `apps/api/prisma/schema.prisma`. Modify schema → run `npx prisma migrate dev --name descriptive_name` → commit both schema + migration.
- **Migrations must be backward-compatible** for 1 deploy cycle (see PRD §15 migration policy). For breaking changes: 2-step or 3-step migrations split across PRs.
- Use `select` and `include` explicitly — never fetch all columns when you need 3.
- Use Prisma transactions (`prisma.$transaction`) for any operation modifying ≥2 tables atomically.
- Use **Prisma `connect`** instead of raw foreign key writes (`{ user: { connect: { id } } }` not `{ userId: id }`) — type-safer.
- Soft delete: add `WHERE deletedAt = null` to all default queries. Consider extending PrismaService with a global middleware that adds this filter, BUT explicitly bypass for admin queries.
- Enums in schema → Prisma generates TypeScript enums → use those, not string literals.
- Decimal columns (money): always `Decimal` in Prisma, never `Float`. Use `decimal.js` for arithmetic, never JS numbers.

---

## 5. Angular conventions

### Components
- **Standalone components only.** No `NgModule` for new code (root module is the exception via `bootstrapApplication`).
- Inputs: `input()` signal. Outputs: `output()` signal. **Don't use `@Input()/@Output()` decorators in new code.**
- Templates: use `@if`, `@for`, `@switch` control flow. **Avoid `*ngIf`, `*ngFor` in new code.**
- Change detection: prefer signals over RxJS for component state. Use RxJS for streams (WebSocket, HTTP polling, complex async composition).
- Smart vs Presentational: pages = smart (inject services), components = presentational (inputs/outputs only).
- One component per file. Component file < 200 lines; if larger, extract sub-components or move logic to services.

### Services
- All services `providedIn: 'root'` unless explicitly feature-scoped.
- HTTP services: one per backend resource (`TripApiService`, `AuthApiService`). They return `Observable<T>` typed from `shared-types` package.
- State services: hold signals, expose readonly getters + update methods. **No direct mutation of signal value from outside.**

### Forms
- **Reactive Forms only.** No template-driven forms.
- `FormBuilder` with typed controls (`form: FormGroup<{ email: FormControl<string>; ... }>`).
- Validators: use built-ins + custom validators in `shared/validators/`. Async validators for server-side checks (email taken, slug available).
- Submit handler: disable form during submission, show spinner, handle error case explicitly.

### Routing
- Lazy-load every feature route: `loadComponent: () => import('./feature.component').then(m => m.FeatureComponent)`.
- Route guards: `canActivate` for auth, `canMatch` for premium gating (more efficient — doesn't load the chunk).
- URL params are typed via `withComponentInputBinding()` + `input()` signal in route components.

### Styling
- **Tailwind utility classes** for 95% of styling. No `*.scss` files unless absolutely necessary (custom animations, complex media queries).
- Design tokens (colors, spacing, typography) defined in `tailwind.config.ts` — never hardcode hex values.
- Avoid `:host` styles unless component truly needs them.
- A11y: every interactive element must have proper `aria-*` attributes, keyboard navigation works, focus visible.

### State management
- **No NgRx, no Akita, no NGXS.** Signals + services are enough for MVP.
- Global state: services with signals (`AuthStateService`, `UserPreferencesService`).
- Server state: services that fetch + cache via simple signal-based cache (or `@ngneat/query` if it becomes needed in Phase 2).

### PWA
- Service worker via `@angular/pwa`. Custom logic in `src/sw.ts` for Web Push handling.
- App manifest in `src/manifest.webmanifest` — keep updated when icons change.
- Install prompt: show banner contextually (e.g. after first trip join), never on first visit.
- iOS PWA: detect with `navigator.standalone` check; show "Add to Home Screen" tutorial for iOS Safari users when push notification is requested.

---

## 6. Naming conventions

| Type | Convention | Example |
|---|---|---|
| TypeScript files | kebab-case | `trip-discovery.service.ts` |
| Classes | PascalCase | `TripDiscoveryService` |
| Methods/functions | camelCase | `findTrendingTrips()` |
| Constants | SCREAMING_SNAKE | `MAX_TRIP_MEMBERS` |
| Interfaces/Types | PascalCase, no `I` prefix | `TripFilters`, not `ITripFilters` |
| Enums | PascalCase singular | `TripStatus`, `TransportType` |
| DTO classes | `*Dto` suffix | `CreateTripDto`, `JoinRequestDto` |
| Angular components | `*Component` suffix, kebab-case file | `trip-card.component.ts` → `TripCardComponent` |
| Angular services | `*Service` suffix | `TripApiService` |
| BullMQ jobs/queues | kebab-case | `media-processing`, `ai-classify` |
| Database tables | PascalCase singular (Prisma default) | `Trip`, `TripMembership` |
| Database columns | camelCase (Prisma default) | `createdAt`, `pricePerPerson` |
| PostHog events | snake_case, past tense | `trip_join_approved` |
| API routes | kebab-case, plural resources | `/api/v1/trips/:id/join-requests` |

---

## 7. Testing rules

### What MUST be tested (coverage ≥ 70%)
- **AuthService:** registration, login, refresh rotation, password reset.
- **TripService:** create, publish, member management, soft delete.
- **PaymentService / BillingService:** subscription state transitions, webhook idempotency.
- **Ranking computation:** unit tests for each signal score + final aggregation.
- **AI classification:** mock Anthropic SDK; test parsing of LLM JSON output + confidence threshold logic.
- **All guards:** `JwtAuthGuard`, `TripMemberGuard`, `RolesGuard`.
- **Webhook handlers:** signature verification + idempotency + state mutations.

### What can be skipped (judgment call)
- Pure DTOs (no logic).
- Generated code (Prisma client).
- Angular templates (covered by e2e).

### Test conventions
- **Jest** for unit + integration. **Playwright** for e2e (NEVER Cypress).
- Test files: `*.spec.ts` colocated next to source.
- E2E tests: `apps/web/e2e/*.spec.ts`.
- **Testcontainers** for integration tests requiring real Postgres. **No SQLite swap-in** — too many incompatibilities with our schema (enums, pgvector, FTS).
- Mock external services (Stripe, Anthropic, Sightengine, Mapbox) via `nock` or sdk-level mocks. **Never hit live external APIs in CI.**
- Test data: factories in `test/factories/` using `@faker-js/faker`. Avoid hardcoded test data.

---

## 8. Security rules

- **Helmet middleware enabled** on NestJS bootstrap. CSP configured to allow only known origins (Stripe, Mapbox, Cloudflare Images, PostHog).
- **CORS allowlist:** only Vercel preview pattern + production domain. No wildcard `*` in production.
- **Rate limiting via `@nestjs/throttler` + Redis store.** Decorate auth endpoints with stricter limits.
- **Input validation always.** No `req.body` access without DTO validation.
- **Output sanitization for user-generated HTML** — if board posts ever render markdown, use `DOMPurify` (server-side) before storing.
- **No PII in error messages returned to client.** Generic message → user; detailed → Sentry.
- **All webhook endpoints verify signatures.** Stripe: `stripe.webhooks.constructEvent`. R2/Cloudflare: HMAC with shared secret. Reject unsigned with 401.
- **No SQL injection.** Prisma protects you — don't bypass with raw concatenation.
- **Admin endpoints behind `/admin` path + `RolesGuard('ADMIN')`.** Additional IP allowlist in production (env config).
- **Secrets via Railway/Vercel env.** Validated at startup by Zod schema in `config/`. Failed validation = crash on boot, don't run with bad config.

---

## 9. Performance budgets

| Target | Limit |
|---|---|
| API endpoint p95 | < 300ms |
| API endpoint p99 | < 800ms |
| Search query p95 | < 200ms |
| WebSocket message delivery (same room) | < 200ms |
| Angular initial bundle (main + framework) | < 350 KB gzip |
| Lighthouse mobile LCP | < 2.5s |
| Lighthouse mobile TBT | < 200ms |

When you write code that touches these paths, **measure**. Use `console.time` / Prisma query logs / Sentry transactions during development. If a query exceeds 100ms, add an index or refactor.

---

## 10. Code style

- **Prettier + ESLint** — configured at repo root. Format on save in IDE.
- **No commented-out code in commits.** If it's not needed, delete it. Git history has it.
- **No `console.log` in committed code** — use Pino logger or `Sentry.captureMessage`.
- **Imports order:** (1) Node built-ins, (2) external packages, (3) `@/` aliases, (4) relative imports. ESLint rule enforces this.
- **No default exports for components/services.** Named exports only. (Default exports for Next.js pages would be the exception, but Angular doesn't use them.)
- **Functions > 30 lines:** consider extracting. Functions > 50 lines: extract.
- **Cyclomatic complexity > 10:** refactor. ESLint warns at 8.
- **Comments explain WHY, not WHAT.** Code shows what; comments justify non-obvious decisions.

---

## 11. Internationalization & content

- **MVP language: Polish only.** All user-facing strings in Polish.
- **No hardcoded strings in components.** Even though i18n is Phase 3, use `@angular/localize` `$localize` tagged template literals from day 1. Cost: zero. Benefit: Phase 3 is a translation file away.
- **Error messages from API:** keys + parameters, frontend translates. Example: `{ code: 'TRIP_FULL', params: { current: 5, max: 5 } }` → FE renders `"Ta wycieczka jest pełna (5/5)"`.
- **Dates: dayjs with `pl` locale.** Never `new Date().toLocaleString()` without explicit locale.
- **Currency formatting:** `Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })`.
- **Slugs:** PL-safe slugification — `slugify` lib with locale option, removes diacritics (Ł→l, ą→a, etc.).

---

## 12. Specific Tripico domain rules

### Trip lifecycle
- Trip created in `DRAFT` status. Must be explicitly `publish()`-ed to become discoverable.
- `currentMembers` is denormalized — always updated in the same transaction as `TripMembership` insert/delete.
- `maxMembers` includes the organizer. Validation: `currentMembers ≤ maxMembers` enforced at app level + DB CHECK constraint.
- When `currentMembers === maxMembers` → status auto-transitions to `FULL`. When member leaves → back to `PUBLISHED`.
- Organizer cannot leave their own trip — must `cancel()` it instead. If they want to leave: transfer ownership first (Phase 2 feature; in MVP: contact admin).

### Membership flow
- `join_request` creates `TripMembership` with `role = PENDING`.
- Approval transitions `PENDING → MEMBER`, sets `joinedAt`, increments `Trip.currentMembers`, broadcasts to group room, sends notification.
- Rejection deletes the `TripMembership` row (no soft delete for pending — it didn't really exist).
- Member leaving: sets `leftAt`, decrements `currentMembers`, broadcasts. Member can re-request later — but if they were kicked out (Phase 2), block re-request.

### Chat rules
- Group chat (`ChatType.TRIP_GROUP`) accessible only by `MEMBER` or `ORGANIZER` of the trip.
- Organizer DM (`ChatType.ORGANIZER_DM`) accessible only by the specific `PENDING` user + organizer.
- After a `PENDING` user is approved → their DM channel becomes inactive (read-only or hidden). Main group chat opens.
- After rejection → DM channel auto-archives after 7 days (cron job).
- Edit window for messages: **5 minutes** after send. After that, only soft-delete.
- File attachments in chat: images only in MVP (Phase 2: documents).

### Discovery & ranking
- Only `PUBLISHED` (not `DRAFT`, not `CANCELLED`, not `COMPLETED`, not `ARCHIVED`) trips appear in discovery.
- Ranking computed by `ranking-recompute` worker every 5 minutes for trips with engagement in last 24h; full recompute nightly.
- Faceted counts cached 2 minutes in Redis (`facets:${filterHash}`).
- Search results: FTS in Postgres with `polish` config + `pg_trgm` for typo tolerance.

### AI categorization
- Triggered on trip `publish` and on `update` (debounced 5s) via BullMQ job `ai:classify-trip`.
- Use the prompt template from PRD §10. Model: `claude-haiku-4-5-20251001`.
- Apply categories with `confidence >= 0.6`. Threshold is in `app_config` table (settable by admin).
- Manual override by organizer logged to `CategoryOverride` table for feedback loop.
- If Anthropic API fails: retry 3x with exponential backoff. Final failure: log to Sentry, leave trip un-categorized (it remains discoverable via filters but missing from category feeds).

### Premium gating
- Free users: max 2 active trips as organizer, no verification badge, see ads (Phase 2+).
- Premium check: `user.isPremium && (user.premiumUntil === null || user.premiumUntil > now)`. Denormalized for fast access; source of truth is Stripe webhooks.
- Paywall component: show contextually (when trying to create 3rd trip, when starting verification). Tagged with PostHog event `paywall_shown` with trigger context.

### Verification
- MVP: manual review by admin. User uploads document + selfie to private R2 bucket → `VerificationRequest` row → admin queue.
- Approved: `user.verificationLevel = IDENTITY`, `user.isVerifiedBadge = true`. Documents deleted from R2 after 90 days (retention policy worker).
- Rejected: user notified with reason, can resubmit.
- Phase 2: integrate Stripe Identity or Veriff. Until then, **do not implement automated verification logic.**

### Media uploads
- Direct-to-R2 via presigned URLs. Backend issues presigned PUT URL with TTL 10 min + content-type + size limits.
- After R2 webhook: trigger `media-processing` (CF Images / CF Stream) + `nsfw-check` (Sightengine) in parallel.
- Media has 3 states: `PENDING` (signed) → `UPLOADED` (R2 confirmed) → `PROCESSING` (workers running) → `READY` (publishable) | `FAILED` | `REJECTED` (moderation).
- Posts/messages referring to media MUST check media is `READY` before allowing publish/send. UI shows spinner during processing.

---

## 13. What to do when uncertain

1. **Re-read `docs/PRD.md`** — the relevant section.
2. **Check existing patterns in codebase** — grep for similar use cases.
3. **Ask Piotr.** Better one clarifying question than a wrong implementation.
4. **Never invent business rules.** If the rule isn't in PRD or codebase, it doesn't exist yet — ask.
5. **Never silently expand scope.** "While I was at it, I added X" is a code review red flag. If you see a needed improvement, mention it separately as a follow-up suggestion.

---

## 14. Pull request rules

- One PR = one logical change. No "WIP" or "minor fixes" mixed in.
- PR title: `[T-123] Short imperative description` (matches Linear/Jira issue).
- PR description template:
  ```
  ## What
  ## Why
  ## How
  ## Testing
  ## Screenshots (if UI)
  ## Migration notes (if schema change)
  ```
- All tests must pass + coverage gate (70%) + no new ESLint warnings.
- Migration PRs reviewed extra carefully — backward-compat is non-negotiable.

---

## 15. Anti-patterns — instant rejection

- Returning `any` from a service method.
- `console.log` in production code.
- Hardcoded user IDs, trip IDs, secrets in code.
- Synchronous external API calls in HTTP handlers (must be async + BullMQ for heavy ops).
- Direct `PrismaClient` instantiation outside of `PrismaService`.
- `setInterval` / `setTimeout` for scheduled work (use BullMQ scheduled jobs).
- DOM manipulation in Angular (use template bindings + signals).
- `subscribe()` without `takeUntilDestroyed()` (memory leak).
- Service worker custom code that breaks the `@angular/pwa` defaults without explicit reason.
- Adding a new external service/dependency without proposing in a separate ADR PR first.

---

**End of rules.**

When in doubt: read PRD, ask Piotr, prefer explicit over clever. Ship small, ship safe.