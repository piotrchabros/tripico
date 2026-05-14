# Frontend Components

## Conventions

Per [AGENTS.md §5](../AGENTS.md): standalone components only, `input()`/`output()` signals, `@if`/`@for`/`@switch` control flow, Tailwind for 95% of styling, no NgRx (signals + services).

Tailwind v4 is wired via `.postcssrc.json` (workspace root) + `@source "../**/*.html"` and `@source "../**/*.ts"` directives in `styles.css` so utility classes inline-templated inside component `.ts` files are discovered. Postcss config in JSON form — `@angular/build` v21 does not auto-detect `postcss.config.js`.

## Pages (`apps/tripico/src/app/pages/`)

All routes are lazy-loaded via `loadComponent` (see `app.routes.ts`).

| File | Route | Auth | Notes |
|---|---|---|---|
| `trips-list.page.ts` | `/` | public | Public discovery grid. Authenticated header shows `Moje wycieczki` link + `+ Nowa wycieczka` CTA. Top banner prompts verify-email when `user.emailVerified === false`. |
| `login.page.ts` | `/login` | public | Reactive form; INVALID_CREDENTIALS surfaced as PL copy. Redirects to `/` on success. |
| `register.page.ts` | `/register` | public | Email/password/displayName/slug. Auto-logs-in on success then redirects to `/`. EMAIL_TAKEN / SLUG_TAKEN messaged in PL. |
| `verify-email.page.ts` | `/verify-email` | public | Reads `token` query param via `withComponentInputBinding`, auto-verifies. Manual entry form when no URL token. Authenticated users can request a fresh token; `devToken` surfaced inline when backend has `EMAIL_DEV_TOKENS=true`. |
| `create-trip.page.ts` | `/create` | `authMatchGuard` | Full `CreateTripDto` form. EMAIL_NOT_VERIFIED handled with amber banner; field-level errors[] rendered from RFC 7807 response. |
| `my-trips.page.ts` | `/me/trips` | `authMatchGuard` | List of organizer's trips with status filter tabs (All / Robocze / Otwarte / Pełne / Odwołane / Zakończone). Counts derived client-side. |
| `trip-detail.page.ts` | `/wycieczka/:slug` | public | Public detail. Role-aware action block: organizer → publish/cancel, MEMBER → leave, PENDING → withdraw, anon → "Dołącz" form. Organizer-only pending queue with approve/reject. Status badges with PL labels + color coding. Renders `<app-trip-chat>` for MEMBER/ORGANIZER. |

## Shared components (`apps/tripico/src/app/components/`)

| File | Selector | Inputs | Purpose |
|---|---|---|---|
| `trip-chat.component.ts` | `<app-trip-chat>` | `tripId: string` | 480px-tall chat panel. Own messages on the right (teal), others on the left. Auto-scroll on new message. Composer disabled until WS connected. Error panel maps backend ack codes to PL copy. |

## Core services (`apps/tripico/src/app/core/`)

All `providedIn: 'root'` singletons.

| Service | Purpose |
|---|---|
| `AuthStateService` | Signal store: `accessToken` + `user` + `isAuthenticated` (computed). Persists to `sessionStorage` with SSR-safe `typeof window` checks. `hydrateFromStorage()` is called from page constructors so refresh-on-deep-link survives. |
| `AuthApiService` | All `/api/v1/auth/*` calls. `login`/`refresh` tap into `AuthStateService.setSession`. `logout` taps `clear`. Methods: `register`, `login`, `refresh`, `logout`, `requestVerification`, `verifyEmail`. |
| `TripsApiService` | `/api/v1/trips/*` + `/api/v1/memberships/*`. Methods: `list`, `listMine`, `getBySlug`, `create`, `publish`, `cancel`, `join`, `leave`, `listMemberships`, `approveMembership`, `rejectMembership`. |
| `ChatService` | One Socket.io connection per session. Methods: `loadHistory` (REST), `connect`, `joinTrip`, `leaveTrip`, `sendMessage` (Promise + ack), `hydrate`, `disconnect`. Signals: `connected`, `messages`, `error`. Handshake JWT from `AuthStateService.accessToken()`. |
| `AnalyticsService` | `posthog-js` wrapper. `init()` called via `provideAppInitializer`; `effect` syncs identify/reset with `AuthStateService.user()`. `$pageview` captured manually on `Router.events` `NavigationEnd`. `capture(event, props)` for explicit user actions. No-op when key empty/placeholder. |

## Guards + interceptors

| File | Type | Notes |
|---|---|---|
| `core/auth.guard.ts` | `CanMatchFn` (`authMatchGuard`) | Hydrates auth state, redirects anon to `/login`. Used on `/create` + `/me/trips` — lazy chunks never load for unauthenticated. |
| `core/auth.interceptor.ts` | Functional `HttpInterceptorFn` | Attaches `Authorization: Bearer <token>` from `AuthStateService.accessToken()` to outbound requests. |

## Routing summary

See `apps/tripico/src/app/app.routes.ts` for the canonical list. `**` redirects to `/`. `apps/tripico/src/app/app.routes.server.ts` flags `/`, `/wycieczka/:slug`, `/create` as `RenderMode.Client` (the rest prerender) — but post-[ADR-009](./decisions.md) the SSR runtime is no longer in the bundle, so the server route file is dormant scaffolding.

## State / persistence

| Service | Signals exposed | Mutators | Persisted? |
|---|---|---|---|
| `AuthStateService` | `accessToken` (readonly), `user` (readonly), `isAuthenticated` (computed) | `setSession({accessToken, user})`, `clear()`, `hydrateFromStorage()` | `sessionStorage` keys `__tripico_access` + `__tripico_user`. SSR-safe (no window → no-op). |
| `ChatService` | `connected`, `messages`, `error` | `connect()`, `joinTrip`, `leaveTrip`, `sendMessage`, `hydrate`, `disconnect` | In-memory only — re-fetched via `loadHistory` on mount. |
| `AnalyticsService` | (none — internal) | `init()`, `capture(event, props)` | PostHog SDK persists distinct_id in `localStorage` automatically. |

## UI primitives

Not extracted as separate components yet. Tailwind utility classes inline in each page; common patterns (rounded-2xl cards, teal CTAs, stone-50 backdrop, status badges) repeated across pages. When a primitive emerges 3+ times worth extracting, lift to `apps/tripico/src/app/ui/` and document here.
