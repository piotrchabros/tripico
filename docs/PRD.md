# PRD — Tripico

> **Product Requirements Document**  
> **Wersja:** 1.0 (MVP Architecture Lock)  
> **Data:** Maj 2026  
> **Autor:** Piotr + Architekt PRD  
> **Status:** Approved for implementation

---

## 1. Executive Summary

**Tripico** to platforma społecznościowa do organizowania i odnajdywania wspólnych wycieczek. Adresuje konkretny ból rynkowy: setki tysięcy osób na grupach facebookowych ("Szukam towarzysza w góry", "Wyjazdy budżetowe", itp.) nie mają sensownego sposobu na **odnalezienie pasującej wycieczki ani towarzysza** — Facebook jako platforma nie oferuje strukturalnego wyszukiwania, filtrów, ani narzędzi do koordynacji grupy po dołączeniu.

Tripico rozwiązuje to trójtorowo:
1. **Discovery** — kategorie auto-generowane przez AI, ranking trending/popular oparty o realny engagement, filtry deterministyczne (data, koszt, transport, destynacja).
2. **Coordination** — po dołączeniu do wycieczki: czat grupowy real-time, tablica grupowa (timeline z postami, zdjęciami, ankietami), mapa wycieczki, lista uczestników.
3. **Trust & Monetization (Phase 2+)** — weryfikacja użytkowników (premium), prowizje od profesjonalnych organizatorów (Stripe Connect), reklamy.

### Kluczowe parametry projektu

| Wymiar | Wartość |
|---|---|
| **Typ projektu** | Greenfield, B2C consumer SaaS |
| **Platforma** | PWA (Progressive Web App) — single codebase |
| **Geografia (MVP)** | Polska |
| **Target Y1** | 10 000 MAU |
| **Model monetyzacji** | Freemium subscription (MVP) + marketplace commission (Phase 2) + ads (Phase 2/3) |
| **MVP timeline** | 3–4 miesiące |

---

## 2. Cel biznesowy i problem

### Problem
- Polskie grupy facebookowe ("Szukam ekipy na wyjazd", "Backpacking Polska") liczą setki tysięcy członków, ale są **strukturalnie bezużyteczne**: brak wyszukiwania, brak filtrów, posty znikają w feedzie, brak weryfikacji autorów.
- Użytkownicy próbujący koordynować wyjazd po znalezieniu ekipy uciekają do Messengera, Discorda, WhatsAppa — fragmentacja, brak persystencji informacji, brak współdzielonych narzędzi (split kosztów, lista pakowania).
- Brak warstwy zaufania: ludzie jadą z obcymi pod namiot bez żadnej weryfikacji tożsamości czy reputacji.

### Cel produktu
Stworzyć dedykowaną platformę, która:
- Zastępuje grupy FB jako miejsce **odkrywania** wycieczek (strukturalny katalog, AI discovery, ranking).
- Zatrzymuje grupę po dołączeniu (czat, tablica, narzędzia).
- Buduje warstwę zaufania (weryfikacja premium, reputacja w Fazie 3).
- Monetyzuje subskrypcją Premium + prowizjami od pro-organizatorów + reklamami.

### Cele biznesowe (Y1)

| KPI | Target Y1 |
|---|---|
| MAU | 10 000 |
| Aktywne wycieczki (jednocześnie) | 1 500–3 000 |
| Konwersja Free → Premium | 3–7% |
| Retention D30 | ≥ 25% |
| Average trips joined per user | ≥ 1.5 |

---

## 3. Użytkownicy i persony

### Persona 1: **"Kasia, 28 — szukająca ekipy"**
- Pracuje w korpo, lubi podróżować, brakuje jej regularnej grupy znajomych chętnych na weekendowe wypady.
- Scrolluje grupy FB w autobusie, nie ma cierpliwości do długich postów.
- Potrzebuje: szybkie odkrywanie ("co jest w sierpniu, do 500zł, w góry?"), weryfikacja organizatora przed wpłatą jakichkolwiek pieniędzy.

### Persona 2: **"Marek, 32 — organizator"**
- Doświadczony turysta, regularnie organizuje wyjazdy dla 4–8 osób (paliwo split, ogarnia nocleg).
- Frustrują go ludzie odpadający w ostatniej chwili, fragmentacja komunikacji (kto co kupił, kto za co płaci).
- Potrzebuje: narzędzie do koordynacji grupy po dołączeniu, jasna komunikacja, w Fazie 2 — możliwość pobierania kasy z prowizją (gdy zacznie organizować komercyjnie).

> **Uwaga architektoniczna:** każdy user jest **jednocześnie organizatorem i uczestnikiem** — model danych nie rozróżnia ról na poziomie usera, tylko na poziomie relacji `trip_memberships` (per-trip role).

### Persona 3: **"Bartek, 40 — Pro-organizator"** *(Phase 2)*
- Prowadzi działalność gospodarczą, organizuje komercyjne wyjazdy (trekking w Bieszczadach za 800zł/osoba).
- Potrzebuje: KYC, faktury, prowizje, marketplace exposure, reklamy.
- Adresowany w **Fazie 2** przez integrację Stripe Connect Express.

---

## 4. Scope MVP vs roadmap

### 🚀 MVP (Faza 1) — ~3–4 miesiące

**Authentication & profiles**
- Email + hasło rejestracja, verify email obowiązkowa przed dołączeniem do wycieczki
- OAuth: **Google + Facebook**
- Reset hasła (magic link, TTL 1h)
- Profil użytkownika: avatar, bio, podstawowe info
- JWT-based auth (access 15min + refresh 7d w httpOnly cookie, rotation, Redis blacklist)

**Trips — CRUD**
- Tworzenie wycieczki: tytuł, opis, destynacja (z autocomplete Mapbox), daty (start/end), transport (enum), koszt per person, max members, cover image, gallery (do 10 zdjęć)
- Edycja/usuwanie tylko przez organizatora
- Pełny widok wycieczki: opis, galeria, mapa Mapbox, lista uczestników, tablica grupowa (members only), czat (members only)

**Discovery & search**
- 15–20 stałych top-level kategorii (AI-classified przez Claude Haiku)
- Strona główna: 6–8 kategorii jako sekcje z top wycieczkami
- "Odkrywaj" feed: `new`, `trending` (multi-signal ranking), `almost_full`, `popular`
- Wyszukiwanie tekstowe: Postgres FTS (`tsvector` + `pg_trgm`)
- Filtry: destynacja, daty, zakres cen, transport, liczba miejsc

**Membership flow**
- Request to join (przycisk "Poproś o dołączenie")
- Organizator approve/reject — DM chat 1:1 z kandydatem przed decyzją (osobny thread, nie main group chat)
- Member może opuścić wycieczkę
- Notyfikacje (Web Push VAPID + in-app): join request, approval/rejection, new message, post on board

**Group features (members only)**
- **Czat grupowy real-time (Socket.io)** — uproszczona wersja MVP:
  - Wysyłanie tekstu + obrazków (max 25MB)
  - Real-time delivery
  - History z paginacją (cursor-based)
  - Push notification offline
  - **NIE w MVP:** typing indicators, read receipts, reactions, threads, mentions
- **Tablica grupowa (timeline-style):**
  - Posty: tekst, zdjęcia (max 10), wideo (max 100MB / 60s)
  - Polimorficzny content (JSONB) — przyszłościowo: posts, polls, attachments
  - Ankiety: pytanie + opcje + single/multi-vote
- Mapa wycieczki: Mapbox GL JS z markerem destynacji

**Monetization (MVP)**
- Stripe Subscriptions
- Plan Free vs Premium (19–29 PLN/mc — cena do ustalenia)
- 14-dniowy trial
- Premium features (MVP):
  - **Weryfikacja użytkownika** (ręczna moderacja przez admina w MVP) → odznaka "Zweryfikowany" w profilu
  - **Brak reklam** (gdy reklamy się pojawią w Fazie 2)
  - **Nielimitowane tworzenie wycieczek** (Free: max 2 aktywne wycieczki jako organizator)
- Stripe Customer Portal (self-service)
- Stripe Tax (automatyczny VAT MOSS)
- Payment methods: karta + BLIK

**Operations**
- Admin panel (basic Angular app + osobny endpoint set): user management, trip moderation, manual KYC verification queue
- Reporting (zgłaszanie userów/wycieczek/postów) → queue dla admina
- Notification preferences (email/push toggle per kategorii)
- GDPR: data export, account deletion

### 📦 Faza 2 — ~2–3 miesiące po MVP

- **Apple Sign-In OAuth**
- **Phone verification (SMS OTP)** — Twilio lub krajowy provider
- **Marketplace** (Stripe Connect Express): pro-organizatorzy, KYC, escrow, payouts, prowizje (~10% domyślnie, konfigurowalne per organizator)
- **Sponsored cards / reklamy** w discovery feed
- **Split kosztów** (Splitwise-like): kto ile za co, balance per member
- **Lista pakowania** współdzielona z assignmentami
- **Meilisearch** (warunek: > 5k aktywnych wycieczek LUB p95 search query > 200ms)
- **pgvector "Similar trips"** (jeśli nie dolepiamy w MVP late stage)
- **Automatyczne faktury** (Fakturownia / InFakt) z KSeF readiness
- Audyt prawny (kancelaria od fintechu) przed launchem marketplace

### 🔮 Faza 3 — ~3–6 miesięcy po Fazie 2

- **AI sub-collections** (dynamiczne kolekcje pod stałymi kategoriami, embeddings + clustering)
- **Personalizacja feedu** (per-user "For You")
- **Reputation system**: ratings + reviews wycieczek i organizatorów
- **Premium tiers** (Basic / Pro)
- **i18n** (Angular + tłumaczenia)
- **Mobile native apps** (Capacitor wrap lub React Native)
- **Public API** dla integratorów / partnerów

---

## 5. Architektura systemu

### High-level

```
                       ┌─────────────────────┐
                       │   Cloudflare WAF/DNS │
                       │   + CDN + Images +   │
                       │   Stream             │
                       └──────────┬───────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
   ┌────────▼────────┐  ┌─────────▼─────────┐  ┌────────▼────────┐
   │  Angular SSR    │  │  NestJS API +      │  │  Cloudflare R2  │
   │  (Vercel)       │  │  WS Gateway        │  │  (object store) │
   │                 │◄─┤  (Railway)         │  └─────────────────┘
   │  PWA + SW       │  │                    │
   └────────┬────────┘  │  ┌───────────────┐ │
            │           │  │  BullMQ       │ │
     Web Push           │  │  workers      │ │
     (VAPID)            │  │  (Railway)    │ │
                        │  └───────┬───────┘ │
                        └────────┬─┴─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
       ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼──────┐
       │  Neon       │   │  Upstash     │   │  External   │
       │  Postgres   │   │  Redis       │   │  services:  │
       │  16 +       │   │  (cache +    │   │  - Stripe   │
       │  pgvector   │   │  pub/sub +   │   │  - Anthropic│
       │             │   │  BullMQ)     │   │  - Sightngn │
       └─────────────┘   └──────────────┘   │  - Mapbox   │
                                            │  - PostHog  │
                                            │  - Sentry   │
                                            │  - Better   │
                                            │    Stack    │
                                            └─────────────┘
```

### Tier-by-tier

**Edge / CDN:** Cloudflare. Tutaj: DNS, WAF, rate limiting na poziomie sieci, CDN przed R2 dla statycznych mediów, Cloudflare Images dla transformacji obrazów, Cloudflare Stream dla wideo (HLS adaptive bitrate).

**Frontend:** Angular 18+ (signals, standalone components, control flow `@if`/`@for`) z **Angular SSR (Universal)** dla SEO landing pages oraz indeksowania wycieczek (`/wycieczka/[slug]`). Hostowany na Vercel (edge network, preview deployments per PR). Service Worker dla PWA (Web Push, offline shell, install prompt).

**Backend:** NestJS (TypeScript) jako monolityczna aplikacja z modułową architekturą. Hostowany na Railway (Docker, persistent connections OK dla WebSocketów). Eksponuje REST API + Socket.io Gateway. Background workers (BullMQ) hostowane jako osobne Railway services dzielące codebase z głównym API (np. via `npm run worker:media`).

**Baza danych:** PostgreSQL 16 na Neon (managed, branching per PR, autoscaling). Prisma jako ORM (migration tooling + type-safe client). Extensions: `pg_trgm`, `unaccent`, `pgvector` (gotowość pod Fazę 2/3).

**Cache & queues:** Redis na Upstash (serverless, pay-per-request). Wykorzystanie:
- Cache rankingu trending/popular (TTL 5min)
- Cache faceted counts (TTL 2min)
- BullMQ queues (`media-processing`, `ranking-recompute`, `push-notifications`, `email`, `ai-classification`, `nsfw-check`)
- Pub/Sub adapter dla Socket.io (horizontal scaling)
- Refresh token blacklist
- Rate limiter store (`@nestjs/throttler`)

**Object storage:** Cloudflare R2 (S3-compatible, zero egress fees). Bucket struktura:
- `tripico-public` — avatars, trip covers, board post media (public read via Cloudflare CDN)
- `tripico-private` — KYC documents, signed URLs only

**External services:**
- **Stripe** — subscriptions, customer portal, tax, później Connect Express
- **Anthropic Claude Haiku** (model: `claude-haiku-4-5-20251001`) — AI klasyfikacja kategorii
- **Sightengine** — NSFW moderation media
- **Mapbox** — maps GL JS, geocoding API (autocomplete destynacji)
- **PostHog Cloud EU** — product analytics, feature flags, session replay
- **Sentry** — error tracking + performance + traces (FE + BE)
- **Better Stack** — log aggregation + uptime monitoring
- **VAPID Web Push** — własna implementacja przez `web-push` npm

### Architectural principles

1. **Single backend, modular monolith.** Nie mikroserwisy — overkill dla 10k MAU. NestJS modules dają wystarczającą separację (auth, trips, payments, notifications, media, ai).
2. **Background jobs as first-class.** Każda operacja > 200ms (LLM call, image processing, push, email) idzie do BullMQ. API zostaje szybkie.
3. **Read-heavy optimization.** Discovery jest read-heavy 100:1 vs write. Aggressive caching w Redis dla rankingów, faceted counts, popular feeds.
4. **Idempotent operations.** Każdy write endpoint przyjmuje opcjonalny `Idempotency-Key` header (krytyczne dla payment flow, ale stosowane wszędzie).
5. **Event sourcing-lite.** `trip_events` table jako audit log + źródło dla ranking computation. Nie pełen event sourcing, ale append-only history kluczowych eventów.
6. **Soft delete domyślnie.** Wycieczki, posty, wiadomości, użytkownicy — `deleted_at` zamiast `DELETE`. Hard delete tylko po GDPR request.

---

## 6. Stack technologiczny

### Frontend

| Komponent | Wybór | Uzasadnienie |
|---|---|---|
| Framework | **Angular 18+** | Wybór użytkownika; signals + standalone components dają nowoczesne DX |
| SSR | **Angular Universal (SSR + Hydration)** | Wymagane dla SEO landing pages i indeksowania wycieczek |
| Styling | **Tailwind CSS + Angular CDK** | Utility-first, szybkie prototypowanie; CDK dla a11y components (overlay, dialog, listbox) |
| State management | **Signals + RxJS** (selektywnie) | Signals dla local/component state, RxJS dla streams (WebSocket, complex async) |
| HTTP | **HttpClient + interceptors** | Standard Angular; interceptors dla auth (refresh), errors, retry |
| WebSocket client | **socket.io-client** | Natywny match z backend WS Gateway |
| Maps | **Mapbox GL JS** | Tańszy niż Google Maps przy skali, lepszy custom styling |
| Forms | **Reactive Forms** | Type-safe forms, validators, lepsze niż template-driven dla complex form |
| i18n | **@angular/localize** (Phase 3) | Standard Angular, AOT-friendly |
| PWA | **@angular/pwa** | Service Worker out-of-box, manifest, install prompt |
| Testing | **Jest** (unit) + **Playwright** (e2e) | Jest szybszy od Karmy, Playwright dla cross-browser e2e |

### Backend

| Komponent | Wybór | Uzasadnienie |
|---|---|---|
| Framework | **NestJS 10+** | Modular monolith, DI, decorators, świetne community |
| Language | **TypeScript 5+ (strict mode)** | Type safety end-to-end z Prismą |
| ORM | **Prisma 5+** | Type-safe queries, świetne migracje, lepsze DX niż TypeORM |
| WebSocket | **@nestjs/websockets + socket.io** | Native NestJS gateway support |
| Queues | **BullMQ + @nestjs/bullmq** | Battle-tested, Redis-based, świetna observability |
| Validation | **class-validator + class-transformer + Zod (dla JSONB schemas)** | DTO validation w controllerach; Zod dla polimorficznych JSON payloadów |
| Auth | **@nestjs/passport + Passport strategies + jsonwebtoken + argon2** | Standard, well-documented |
| Logger | **Pino + nestjs-pino** | Structured JSON logs, najszybszy logger Node |
| Config | **@nestjs/config + Zod schema validation** | Env validation przy starcie, fail-fast |
| HTTP client (external APIs) | **@nestjs/axios + retry interceptors** | Standard NestJS HTTP module |
| Testing | **Jest** (unit + integration) + **Testcontainers** (Postgres) | Real Postgres w testach integracyjnych |

### Storage & infra

| Komponent | Wybór | Plan startowy |
|---|---|---|
| Frontend hosting | **Vercel** | Pro plan po przekroczeniu free tier |
| Backend hosting | **Railway** | Hobby/Starter, scale up gdy potrzeba |
| Postgres | **Neon** | Launch plan ($19/mc), branching dla PR previews |
| Redis | **Upstash** | Pay-as-you-go (~$10-30/mc) |
| Object storage | **Cloudflare R2** | $0.015/GB storage, **zero egress** |
| Images | **Cloudflare Images** | $5/mc base + $1/100k transformations |
| Video | **Cloudflare Stream** | $1/1000min stored + $1/1000min delivered |
| DNS/CDN/WAF | **Cloudflare Free/Pro** | Pro plan ($20/mc) gdy potrzebne advanced security |

### External services

| Service | Cel | Pricing notes |
|---|---|---|
| **Stripe** | Subscriptions, Tax, Connect (Faza 2) | 1.5% + 0.25€ EU cards; BLIK 0.79% + 0.25€ |
| **Anthropic Claude Haiku 3.5** | AI klasyfikacja kategorii | ~$1/M input tokens; ~$2-5/mc przy 5k wycieczek |
| **Sightengine** | NSFW moderation | ~$0.001/check |
| **Mapbox** | Maps + Geocoding | 50k loads/mc free, potem $5/1000 |
| **PostHog Cloud EU** | Analytics, flags, replay | Free do 1M events/mc + 5k replays/mc |
| **Sentry** | Errors + APM | Team plan ($26/mc) |
| **Better Stack** | Logs + uptime | ~$15-25/mc |
| **VAPID** | Web Push | Free (własna implementacja) |
| **Twilio / SMS provider** | Phone verification (Faza 2) | ~$0.05/SMS PL |

### Estimated infra cost MVP

| Pozycja | Koszt/mc (estimate) |
|---|---|
| Vercel Pro | $20 |
| Railway (API + 1-2 workers) | $20-50 |
| Neon Launch | $19 |
| Upstash Redis | $10-30 |
| Cloudflare (R2 + Images + Stream + Pro) | $20-50 |
| Sentry Team | $26 |
| Better Stack | $15 |
| Anthropic API | $5-15 |
| Sightengine | $5-20 (zależne od volume) |
| Stripe (transactional, nie fixed) | n/a |
| **Suma** | **~$140-265/mc** |

Skaluje się sublineralnie do 10k MAU. Powyżej tego progu zaczyna boleć głównie Cloudflare Stream (jeśli userzy wrzucają dużo wideo) i Anthropic.

---

## 7. Schemat bazy danych

### Konwencje

- Wszystkie tabele: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Wszystkie tabele: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (auto-update przez Prisma)
- Soft delete: `deleted_at TIMESTAMPTZ NULL` + partial index `WHERE deleted_at IS NULL`
- Foreign keys: `ON DELETE` rozważone per case (cascade vs set null vs restrict)
- Enums: definiowane jako Postgres enums (`CREATE TYPE`) — Prisma generuje TypeScript types
- JSONB tam, gdzie sensowne (polimorficzny content, ai metadata) — z walidacją w aplikacji (Zod)
- Tabele wzrostu hot path (`messages`, `trip_events`, `notifications`) — partycjonowanie po `trip_id` lub `created_at` (przewidziane od początku, włączane gdy boli)

### Core schema (Prisma schema preview)

```prisma
// =========================================================================
// USERS & AUTH
// =========================================================================

enum UserRole {
  USER
  MODERATOR
  ADMIN
}

enum VerificationLevel {
  NONE
  EMAIL
  PHONE       // Phase 2
  IDENTITY    // Premium feature
}

model User {
  id                    String              @id @default(uuid()) @db.Uuid
  email                 String              @unique
  passwordHash          String?             // null jeśli signed up via OAuth only
  displayName           String              @db.VarChar(100)
  slug                  String              @unique @db.VarChar(50) // for /user/[slug]
  avatarUrl             String?
  bio                   String?             @db.Text
  
  emailVerifiedAt       DateTime?
  verificationLevel     VerificationLevel   @default(NONE)
  isVerifiedBadge       Boolean             @default(false) // premium "Zweryfikowany"
  
  role                  UserRole            @default(USER)
  
  // Subscription state (denormalized for fast access)
  isPremium             Boolean             @default(false)
  premiumUntil          DateTime?
  stripeCustomerId      String?             @unique
  
  // Reputation (Phase 3)
  reputationScore       Float               @default(0.0)
  
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  deletedAt             DateTime?
  
  // Relations
  oauthAccounts         OAuthAccount[]
  refreshTokens         RefreshToken[]
  pushSubscriptions     PushSubscription[]
  organizedTrips        Trip[]              @relation("Organizer")
  memberships           TripMembership[]
  boardPosts            BoardPost[]
  messages              Message[]
  notifications         Notification[]
  notificationPrefs     NotificationPreference?
  verificationRequests  VerificationRequest[]
  subscriptions         Subscription[]
  reports               Report[]            @relation("Reporter")
  
  @@index([email])
  @@index([slug])
  @@index([deletedAt])
}

model OAuthAccount {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @db.Uuid
  provider          String   // 'google' | 'facebook' | 'apple' (Phase 2)
  providerAccountId String
  
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt         DateTime @default(now())
  
  @@unique([provider, providerAccountId])
  @@index([userId])
}

model RefreshToken {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @db.Uuid
  tokenHash       String   @unique // SHA-256 of refresh token
  family          String   @db.Uuid // for rotation detection
  expiresAt       DateTime
  revokedAt       DateTime?
  userAgent       String?
  ip              String?
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime @default(now())
  
  @@index([userId])
  @@index([family])
  @@index([expiresAt])
}

model PushSubscription {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  endpoint    String   @unique
  p256dhKey   String
  authKey     String
  userAgent   String?
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt   DateTime @default(now())
  lastUsedAt  DateTime @default(now())
  
  @@index([userId])
}

// =========================================================================
// TRIPS
// =========================================================================

enum TransportType {
  CAR
  TRAIN
  BUS
  PLANE
  BIKE
  HIKING
  MIXED
  OTHER
}

enum TripStatus {
  DRAFT
  PUBLISHED
  FULL
  CANCELLED
  COMPLETED
  ARCHIVED
}

enum TripMemberRole {
  ORGANIZER
  MEMBER
  PENDING       // awaiting approval
}

enum CurrencyCode {
  PLN
  EUR
  USD
}

model Trip {
  id                  String              @id @default(uuid()) @db.Uuid
  slug                String              @unique // for /wycieczka/[slug]
  organizerId         String              @db.Uuid
  
  title               String              @db.VarChar(200)
  description         String              @db.Text
  
  // Destination
  destinationCountry  String              @db.VarChar(2)  // ISO 3166-1 alpha-2
  destinationName     String              @db.VarChar(200) // human-readable: "Bieszczady, PL"
  destinationLat      Float?
  destinationLng      Float?
  mapboxPlaceId       String?
  
  // Schedule
  startDate           DateTime            @db.Date
  endDate             DateTime            @db.Date
  durationDays        Int                 // generated col: endDate - startDate + 1
  
  // Logistics
  transport           TransportType
  pricePerPerson      Decimal             @db.Decimal(10, 2)
  currency            CurrencyCode        @default(PLN)
  maxMembers          Int                 // includes organizer
  currentMembers      Int                 @default(1) // includes organizer; denormalized for performance
  
  // Media
  coverImageUrl       String?
  galleryUrls         String[]            // array of public URLs
  
  // Search & ranking (denormalized for performance)
  searchVector        Unsupported("tsvector")? // managed via SQL trigger
  
  // AI / embeddings (Phase 2 ready)
  embedding           Unsupported("vector(1536)")?  // text-embedding-3-small
  embeddingUpdatedAt  DateTime?
  
  status              TripStatus          @default(DRAFT)
  publishedAt         DateTime?
  
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  deletedAt           DateTime?
  
  // Relations
  organizer           User                @relation("Organizer", fields: [organizerId], references: [id], onDelete: Restrict)
  memberships         TripMembership[]
  boardPosts          BoardPost[]
  messages            Message[]
  events              TripEvent[]
  categories          TripCategory[]
  ranking             TripRanking?
  reports             Report[]
  
  @@index([status, deletedAt])
  @@index([organizerId])
  @@index([startDate])
  @@index([destinationCountry, startDate])
  @@index([transport, pricePerPerson])
  @@index([slug])
  // GIN index on searchVector via raw SQL migration
}

model TripMembership {
  id              String           @id @default(uuid()) @db.Uuid
  tripId          String           @db.Uuid
  userId          String           @db.Uuid
  role            TripMemberRole
  joinedAt        DateTime?        // null if PENDING
  leftAt          DateTime?
  requestMessage  String?          @db.Text // optional message when requesting join
  
  trip            Trip             @relation(fields: [tripId], references: [id], onDelete: Cascade)
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  
  @@unique([tripId, userId])
  @@index([tripId, role])
  @@index([userId])
}

// =========================================================================
// CATEGORIES (AI-classified + manual override)
// =========================================================================

model Category {
  slug              String          @id @db.VarChar(50)
  displayName       String          @db.VarChar(100)
  description       String?         @db.Text
  iconEmoji         String?         @db.VarChar(10)
  promptCriteria    String          @db.Text // used in LLM prompt
  displayOrder      Int             @default(100)
  isActive          Boolean         @default(true)
  
  trips             TripCategory[]
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  @@index([isActive, displayOrder])
}

model TripCategory {
  id              String     @id @default(uuid()) @db.Uuid
  tripId          String     @db.Uuid
  categorySlug    String     @db.VarChar(50)
  
  confidence      Float      // 0.0 - 1.0, AI-assigned
  isManualOverride Boolean   @default(false) // if organizer manually set
  classifiedAt    DateTime   @default(now())
  modelVersion    String?    @db.VarChar(50) // e.g. 'claude-haiku-4-5-20251001'
  
  trip            Trip       @relation(fields: [tripId], references: [id], onDelete: Cascade)
  category        Category   @relation(fields: [categorySlug], references: [slug], onDelete: Cascade)
  
  @@unique([tripId, categorySlug])
  @@index([categorySlug])
}

// Audit log of manual category overrides (feedback loop for prompt tuning)
model CategoryOverride {
  id              String   @id @default(uuid()) @db.Uuid
  tripId          String   @db.Uuid
  categorySlug    String   @db.VarChar(50)
  action          String   // 'added' | 'removed'
  performedBy     String   @db.Uuid
  performedAt     DateTime @default(now())
  aiConfidence    Float?   // what AI thought before override
  
  @@index([categorySlug, performedAt])
}

// =========================================================================
// RANKING (materialized state)
// =========================================================================

model TripRanking {
  tripId                  String   @id @db.Uuid
  
  // Component scores (0.0 - 1.0)
  recencyScore            Float
  joinRateScore           Float
  chatActivityScore       Float
  nearlyFullScore         Float
  organizerReputationScore Float
  
  // Final weighted scores per feed
  trendingScore           Float    // weighted sum for 'trending' feed
  popularScore            Float    // weighted sum for 'popular' feed
  
  computedAt              DateTime @default(now())
  
  trip                    Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  
  @@index([trendingScore(sort: Desc)])
  @@index([popularScore(sort: Desc)])
}

// =========================================================================
// BOARD (timeline posts) + POLLS
// =========================================================================

enum BoardPostType {
  TEXT
  PHOTO
  VIDEO
  POLL
  MIXED
}

model BoardPost {
  id            String         @id @default(uuid()) @db.Uuid
  tripId        String         @db.Uuid
  authorId      String         @db.Uuid
  type          BoardPostType
  
  // Polymorphic content (validated via Zod in application)
  content       Json           // { text?: string, mediaIds?: string[], pollConfig?: {...} }
  
  // Moderation state
  moderationStatus    String   @default("pending") // 'pending' | 'approved' | 'flagged' | 'rejected'
  moderationReason    String?
  
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  deletedAt     DateTime?
  
  trip          Trip           @relation(fields: [tripId], references: [id], onDelete: Cascade)
  author        User           @relation(fields: [authorId], references: [id], onDelete: SetNull)
  comments      BoardComment[]
  pollVotes     PollVote[]
  
  @@index([tripId, createdAt(sort: Desc)])
  @@index([authorId])
}

model BoardComment {
  id            String     @id @default(uuid()) @db.Uuid
  postId        String     @db.Uuid
  authorId      String     @db.Uuid
  text          String     @db.Text
  
  createdAt     DateTime   @default(now())
  deletedAt     DateTime?
  
  post          BoardPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@index([postId, createdAt])
}

model PollVote {
  id              String     @id @default(uuid()) @db.Uuid
  postId          String     @db.Uuid
  voterId         String     @db.Uuid
  selectedOptions String[]   // array of option ids (multi-select support)
  
  votedAt         DateTime   @default(now())
  
  post            BoardPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@unique([postId, voterId])
  @@index([postId])
}

// =========================================================================
// CHAT (group chat + organizer DMs)
// =========================================================================

enum ChatType {
  TRIP_GROUP      // main group chat (members only)
  ORGANIZER_DM    // 1:1 between pending member and organizer (pre-approval)
}

model ChatChannel {
  id          String      @id @default(uuid()) @db.Uuid
  type        ChatType
  tripId      String      @db.Uuid
  // For ORGANIZER_DM: also contains the candidate userId
  participantUserId String? @db.Uuid // null for TRIP_GROUP
  
  lastMessageAt DateTime?
  
  createdAt   DateTime    @default(now())
  
  messages    Message[]
  
  @@unique([type, tripId, participantUserId])
  @@index([tripId])
}

model Message {
  id            String       @id @default(uuid()) @db.Uuid
  channelId     String       @db.Uuid
  tripId        String       @db.Uuid    // denormalized for partitioning
  senderId      String       @db.Uuid
  
  text          String?      @db.Text
  attachmentUrl String?      // image attachment
  
  // For UI: edited/deleted markers
  editedAt      DateTime?
  deletedAt     DateTime?
  
  createdAt     DateTime     @default(now())
  
  channel       ChatChannel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  trip          Trip         @relation(fields: [tripId], references: [id], onDelete: Cascade)
  sender        User         @relation(fields: [senderId], references: [id], onDelete: SetNull)
  
  @@index([channelId, createdAt(sort: Desc)])
  @@index([tripId])
  // Future: partition by tripId hash range when table > 10M rows
}

// =========================================================================
// MEDIA UPLOADS
// =========================================================================

enum MediaContext {
  AVATAR
  TRIP_COVER
  TRIP_GALLERY
  BOARD_POST
  CHAT_ATTACHMENT
  KYC_DOCUMENT     // private bucket
}

enum MediaStatus {
  PENDING       // signed URL issued, no upload yet
  UPLOADED      // R2 webhook received
  PROCESSING    // worker processing (resize, encode, NSFW check)
  READY         // available for use
  FAILED
  REJECTED      // failed moderation
}

model MediaUpload {
  id                  String        @id @default(uuid()) @db.Uuid
  userId              String        @db.Uuid
  context             MediaContext
  
  originalFilename    String
  mimeType            String
  sizeBytes           BigInt
  
  r2Key               String        @unique
  cfImageId           String?       // Cloudflare Images ID
  cfStreamId          String?       // Cloudflare Stream ID (videos)
  publicUrl           String?
  
  status              MediaStatus   @default(PENDING)
  
  // Moderation
  moderationStatus    String        @default("pending") // pending/approved/flagged/rejected
  moderationScore     Float?        // Sightengine confidence
  moderationReason    String?
  
  createdAt           DateTime      @default(now())
  readyAt             DateTime?
  
  @@index([userId])
  @@index([status])
  @@index([moderationStatus])
}

// =========================================================================
// EVENTS (audit + ranking source)
// =========================================================================

enum TripEventType {
  VIEW
  JOIN_REQUEST
  JOIN_APPROVED
  JOIN_REJECTED
  LEAVE
  LIKE
  COMMENT
  SHARE
  CHAT_MESSAGE
  BOARD_POST
}

model TripEvent {
  id          BigInt          @id @default(autoincrement())
  tripId      String          @db.Uuid
  userId      String?         @db.Uuid // null for anonymous views
  eventType   TripEventType
  metadata    Json?
  
  createdAt   DateTime        @default(now())
  
  trip        Trip            @relation(fields: [tripId], references: [id], onDelete: Cascade)
  
  @@index([tripId, eventType, createdAt])
  @@index([createdAt])
  // Future: partition by createdAt monthly when table > 50M rows
}

// =========================================================================
// NOTIFICATIONS
// =========================================================================

enum NotificationType {
  JOIN_REQUEST
  JOIN_APPROVED
  JOIN_REJECTED
  NEW_MESSAGE
  NEW_BOARD_POST
  POLL_CREATED
  TRIP_CANCELLED
  TRIP_REMINDER       // upcoming trip
  PAYMENT_SUCCESS
  PAYMENT_FAILED
  VERIFICATION_APPROVED
  VERIFICATION_REJECTED
}

model Notification {
  id              String              @id @default(uuid()) @db.Uuid
  userId          String              @db.Uuid
  type            NotificationType
  title           String
  body            String              @db.Text
  data            Json?               // deep-link payload, e.g. { tripId, messageId }
  
  readAt          DateTime?
  
  createdAt       DateTime            @default(now())
  
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, readAt, createdAt(sort: Desc)])
}

model NotificationPreference {
  userId                  String   @id @db.Uuid
  
  // Per-channel per-category toggles
  emailJoinRequest        Boolean  @default(true)
  emailMessages           Boolean  @default(false)
  emailBoardPosts         Boolean  @default(false)
  emailPaymentEvents      Boolean  @default(true)
  
  pushJoinRequest         Boolean  @default(true)
  pushMessages            Boolean  @default(true)
  pushBoardPosts          Boolean  @default(true)
  pushPaymentEvents       Boolean  @default(true)
  
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  updatedAt               DateTime @updatedAt
}

// =========================================================================
// PAYMENTS / SUBSCRIPTIONS
// =========================================================================

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  INCOMPLETE
  INCOMPLETE_EXPIRED
}

model Subscription {
  id                    String               @id @default(uuid()) @db.Uuid
  userId                String               @db.Uuid
  
  stripeSubscriptionId  String               @unique
  stripePriceId         String
  
  status                SubscriptionStatus
  
  trialEndsAt           DateTime?
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean              @default(false)
  
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt
  
  user                  User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([status])
}

// =========================================================================
// VERIFICATION (premium feature, manual KYC in MVP)
// =========================================================================

enum VerificationStatus {
  PENDING
  IN_REVIEW
  APPROVED
  REJECTED
}

model VerificationRequest {
  id                String              @id @default(uuid()) @db.Uuid
  userId            String              @db.Uuid
  
  documentMediaId   String              @db.Uuid // ID dowodu
  selfieMediaId     String              @db.Uuid // selfie z dowodem
  
  status            VerificationStatus  @default(PENDING)
  reviewedBy        String?             @db.Uuid // admin user id
  reviewedAt        DateTime?
  rejectionReason   String?             @db.Text
  
  createdAt         DateTime            @default(now())
  
  user              User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([status, createdAt])
  @@index([userId])
}

// =========================================================================
// REPORTING / MODERATION
// =========================================================================

enum ReportTargetType {
  USER
  TRIP
  BOARD_POST
  MESSAGE
}

enum ReportStatus {
  OPEN
  IN_REVIEW
  RESOLVED
  DISMISSED
}

model Report {
  id              String           @id @default(uuid()) @db.Uuid
  reporterId      String           @db.Uuid
  targetType      ReportTargetType
  targetId        String           @db.Uuid
  reason          String           @db.Text
  
  status          ReportStatus     @default(OPEN)
  resolvedBy      String?          @db.Uuid
  resolvedAt      DateTime?
  resolution      String?          @db.Text
  
  createdAt       DateTime         @default(now())
  
  reporter        User             @relation("Reporter", fields: [reporterId], references: [id], onDelete: Cascade)
  trip            Trip?            @relation(fields: [targetId], references: [id], onDelete: Cascade, map: "report_trip_fk")
  
  @@index([targetType, targetId])
  @@index([status, createdAt])
}

// =========================================================================
// PHASE 2 PLACEHOLDERS (architecture preview, not implemented in MVP)
// =========================================================================
// model StripeConnectedAccount { ... }  // Phase 2: pro-organizer KYC
// model PaidTripBooking { ... }          // Phase 2: marketplace bookings
// model CostShareEntry { ... }           // Phase 2: split kosztów
// model PackingListItem { ... }          // Phase 2: shared packing list
// model Advertisement { ... }            // Phase 2: sponsored cards / ads
```

### Critical SQL/Prisma extras

**Postgres extensions to enable on Neon:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector for Phase 2 embeddings
```

**Custom search vector trigger (raw SQL migration):**
```sql
ALTER TABLE "Trip" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('polish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('polish', coalesce("destinationName", '')), 'B') ||
    setweight(to_tsvector('polish', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX trip_search_vector_idx ON "Trip" USING GIN(search_vector);
CREATE INDEX trip_title_trgm_idx ON "Trip" USING GIN(title gin_trgm_ops);
```

**Materialized view refresh strategy:**
- `TripRanking` jest fizyczną tabelą (nie matview), aktualizowaną przez worker `ranking-recompute` co 5 min.
- Powód: częste, inkrementalne update'y — matview wymagałby `REFRESH CONCURRENTLY` całej, co marnuje I/O.

---

## 8. API Endpoints

### Konwencje

- REST: `/api/v1/...`
- Auth: `Authorization: Bearer <access_token>` (JWT). Refresh token w `httpOnly` cookie `tripico_rt`.
- Wszystkie write endpointy akceptują `Idempotency-Key` header (UUID v4).
- Response envelope dla list: `{ data: [...], meta: { cursor, hasMore, total? } }`.
- Cursor-based pagination dla feedów (nie offset — performance i UX).
- Wszystkie errors: zgodne z RFC 7807 (Problem Details), `{ type, title, status, detail, instance }`.
- Rate limiting przez `@nestjs/throttler` + Redis store. Per IP + per user.

### Auth

```
POST   /api/v1/auth/register              { email, password, displayName }
POST   /api/v1/auth/login                 { email, password }
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh               (uses httpOnly cookie)
POST   /api/v1/auth/verify-email          { token }
POST   /api/v1/auth/resend-verification
POST   /api/v1/auth/forgot-password       { email }
POST   /api/v1/auth/reset-password        { token, newPassword }

# OAuth
GET    /api/v1/auth/oauth/google
GET    /api/v1/auth/oauth/google/callback
GET    /api/v1/auth/oauth/facebook
GET    /api/v1/auth/oauth/facebook/callback
# /apple → Phase 2
```

### Users / profile

```
GET    /api/v1/me                          # current user profile
PATCH  /api/v1/me                          # update profile
DELETE /api/v1/me                          # GDPR account deletion
GET    /api/v1/me/notifications            # paginated notifications
PATCH  /api/v1/me/notifications/:id/read   # mark as read
POST   /api/v1/me/notifications/read-all
GET    /api/v1/me/notification-preferences
PATCH  /api/v1/me/notification-preferences

POST   /api/v1/me/push-subscriptions       # register PWA push endpoint
DELETE /api/v1/me/push-subscriptions/:id

POST   /api/v1/me/verification             # submit KYC documents (premium)
GET    /api/v1/me/verification             # check status

GET    /api/v1/users/:slug                 # public profile
```

### Trips — CRUD

```
POST   /api/v1/trips                       # create (DRAFT by default)
GET    /api/v1/trips/:id                   # get trip details (public)
PATCH  /api/v1/trips/:id                   # update (organizer only)
DELETE /api/v1/trips/:id                   # soft delete (organizer only)
POST   /api/v1/trips/:id/publish           # DRAFT → PUBLISHED
POST   /api/v1/trips/:id/cancel            # PUBLISHED → CANCELLED
```

### Trips — Discovery

```
GET    /api/v1/trips/discover              # main discovery endpoint
  Query params:
    - category=<slug>                      # filter by AI category
    - feed=trending|new|almost_full|popular
    - country=<ISO>
    - dateFrom=YYYY-MM-DD
    - dateTo=YYYY-MM-DD
    - priceMin=<int>
    - priceMax=<int>
    - transport=<TransportType>
    - search=<text>                        # FTS over title/description/destination
    - cursor=<opaque>
    - limit=<int, default 20, max 50>

GET    /api/v1/trips/categories            # list of active categories
GET    /api/v1/trips/facets                # faceted counts for current filter set
GET    /api/v1/trips/:id/similar           # pgvector nearest neighbors (if enabled)
```

### Trip membership

```
POST   /api/v1/trips/:id/join-request      { message? }
GET    /api/v1/trips/:id/join-requests     # organizer only
POST   /api/v1/trips/:id/join-requests/:requestId/approve
POST   /api/v1/trips/:id/join-requests/:requestId/reject
POST   /api/v1/trips/:id/leave             # member self-leave
GET    /api/v1/trips/:id/members           # public list of members
```

### Trip categories (manual override)

```
GET    /api/v1/trips/:id/categories
PUT    /api/v1/trips/:id/categories        { addSlugs: [...], removeSlugs: [...] }
```

### Board (posts + comments + polls)

```
GET    /api/v1/trips/:id/board             # paginated timeline
POST   /api/v1/trips/:id/board             # create post (member only)
PATCH  /api/v1/board/posts/:postId         # edit own post
DELETE /api/v1/board/posts/:postId         # soft delete own post

POST   /api/v1/board/posts/:postId/comments
PATCH  /api/v1/board/comments/:commentId
DELETE /api/v1/board/comments/:commentId

POST   /api/v1/board/posts/:postId/vote    { selectedOptionIds: [...] }
```

### Chat

```
GET    /api/v1/trips/:id/channels          # list channels (group + DMs if organizer)
GET    /api/v1/channels/:channelId/messages?cursor=&limit=
                                            # historical messages (real-time via WS)
POST   /api/v1/channels/:channelId/messages  # fallback for REST send (mostly via WS)
```

### Media

```
POST   /api/v1/uploads/sign                # request presigned upload URL
  Body: { context, filename, mimeType, sizeBytes }
  Response: { uploadId, presignedUrl, expiresAt, maxBytes }

POST   /api/v1/uploads/:uploadId/complete  # client signals upload done (fallback if webhook fails)
GET    /api/v1/uploads/:uploadId           # poll status (until READY)
```

### Payments / subscriptions

```
GET    /api/v1/billing/plans               # current plans (Free / Premium)
POST   /api/v1/billing/checkout            # create Stripe Checkout session
POST   /api/v1/billing/portal              # create Stripe Customer Portal session
GET    /api/v1/billing/subscription        # current sub status
POST   /api/v1/billing/cancel              # cancel at period end (also possible via portal)

# Stripe webhooks
POST   /api/v1/webhooks/stripe             # signed webhook handler
```

### Reporting / moderation

```
POST   /api/v1/reports                     { targetType, targetId, reason }
GET    /api/v1/admin/reports               # admin only, paginated
PATCH  /api/v1/admin/reports/:id/resolve   { resolution }
```

### Admin

```
GET    /api/v1/admin/users                 # admin only
PATCH  /api/v1/admin/users/:id             # ban, change role, force verify
GET    /api/v1/admin/verification-queue
POST   /api/v1/admin/verification/:id/approve
POST   /api/v1/admin/verification/:id/reject  { reason }
GET    /api/v1/admin/trips                 # all trips incl. drafts
POST   /api/v1/admin/trips/:id/force-cancel
```

### Webhooks (incoming)

```
POST   /api/v1/webhooks/stripe             # Stripe events (signed)
POST   /api/v1/webhooks/r2                 # Cloudflare R2 upload complete (signed)
POST   /api/v1/webhooks/cloudflare-images  # CF Images processing done
POST   /api/v1/webhooks/cloudflare-stream  # CF Stream encoding done
```

### Health

```
GET    /healthz                            # liveness
GET    /readyz                             # readiness (DB + Redis pingable)
```

---

## 9. Real-time architecture (WebSocket)

### Setup

- **Transport:** Socket.io 4.x (websocket fallback to long-polling).
- **NestJS:** `@nestjs/websockets` + `socket.io` adapter.
- **Scaling:** `@socket.io/redis-adapter` na Upstash Redis Pub/Sub — pozwala na horizontal scaling NestJS instancji (Railway może uruchomić wiele replicas).
- **Auth:** handshake JWT validation w `canActivate` guardzie (`WsJwtAuthGuard`). Client wysyła access token w `auth.token`. Po expiry — client reconnect z fresh tokenem.
- **Rooms:** każda wycieczka ma rooms:
  - `trip:${tripId}:group` — main group chat (tylko zaakceptowani members)
  - `trip:${tripId}:dm:${userId}` — organizer ↔ kandydat DM
  - `trip:${tripId}:board` — board real-time updates (new post notification)
  - `user:${userId}:notifications` — per-user notification channel

### Events (client → server)

| Event | Payload | Effect |
|---|---|---|
| `chat:message:send` | `{ channelId, text?, attachmentUrl? }` | Validate, persist to DB, broadcast to room |
| `chat:typing:start` | `{ channelId }` | *(Phase 2)* Broadcast typing indicator |
| `chat:typing:stop` | `{ channelId }` | *(Phase 2)* |
| `chat:history:load` | `{ channelId, beforeMessageId?, limit }` | Load page of history |
| `board:subscribe` | `{ tripId }` | Join board room for live updates |
| `presence:trip:enter` | `{ tripId }` | *(Phase 3)* Show "X people viewing" |

### Events (server → client)

| Event | Payload | Triggered when |
|---|---|---|
| `chat:message:new` | `{ message }` | New message in room |
| `chat:message:edited` | `{ messageId, text, editedAt }` | Sender edited within edit window |
| `chat:message:deleted` | `{ messageId }` | Sender soft-deleted |
| `board:post:new` | `{ post }` | New post on board |
| `board:post:updated` | `{ postId, ... }` | Edit or moderation change |
| `notification:new` | `{ notification }` | Personal notification |
| `trip:member:joined` | `{ tripId, member }` | Approval → broadcast to group |
| `trip:member:left` | `{ tripId, userId }` | Member left |
| `trip:updated` | `{ tripId, changes }` | Organizer edited trip |
| `system:error` | `{ code, message }` | Validation/auth errors |

### Flow przykład: send message

```
1. Angular client → emit 'chat:message:send' { channelId, text }
2. NestJS Gateway:
   a. WsJwtAuthGuard validates JWT → attaches user to socket
   b. TripMemberGuard validates user is member of channel.trip
   c. Validate DTO (Zod)
   d. Rate limit check (per-user, 30 messages / 10s)
   e. PrismaService inserts Message + updates ChatChannel.lastMessageAt
   f. server.to(`trip:${tripId}:group`).emit('chat:message:new', { message })
   g. BullMQ enqueue 'push-notification' job for offline members
3. Worker 'push-notifications':
   a. Find offline members (no active socket) with push subscription
   b. Send Web Push via web-push lib
```

### Scaling considerations

- **Sticky sessions** NIE są wymagane przy Redis adapterze (każda instancja może obsłużyć każdego klienta — message broadcasting przez Redis Pub/Sub).
- **Connection limits Railway:** standardowy plan obsłuży ~10k concurrent connections per replica. Przy 10k MAU peak concurrent ~500-2000 → komfortowo na 1-2 replicas.
- **Message persistence first, broadcast after.** Zapis do DB ZAWSZE przed broadcastem — jeśli DB padnie, klient dostaje error, brak ghost messages.
- **Heartbeat:** Socket.io domyślnie 25s ping. Dla iOS Safari (PWA) — okej, działa w background krótko, ale push notification jest backup'em.

---

## 10. AI / ML pipeline

### Kategoryzacja wycieczek (MVP)

**Cel:** Każda PUBLISHED wycieczka jest klasyfikowana do 1–3 predefiniowanych kategorii przez LLM, na podstawie title + description + destination.

**Stack:**
- **Provider:** Anthropic Claude Haiku, model `claude-haiku-4-5-20251001`
- **API:** Anthropic Messages API (`POST /v1/messages`)
- **Trigger:** Trip create/update → BullMQ job `ai:classify-trip` z 5s debounce (organizator może edytować szybko)
- **Worker:** osobny Railway service `worker-ai` z dedykowaną queue

**Prompt template (PL):**
```
Jesteś klasyfikatorem wycieczek dla aplikacji Tripico.

Otrzymujesz opis wycieczki i listę kategorii. 
Dla każdej kategorii oceń pasowanie wycieczki w skali 0.0 - 1.0,
gdzie 0.0 = w ogóle nie pasuje, 1.0 = idealnie pasuje.

Zwróć WYŁĄCZNIE JSON w formacie:
{
  "classifications": {
    "weekend_quick": 0.85,
    "warm_week": 0.05,
    ...
  }
}

WYCIECZKA:
Tytuł: {{title}}
Destynacja: {{destination}}
Czas trwania: {{durationDays}} dni
Cena: {{price}} PLN/osoba
Transport: {{transport}}
Opis: {{description}}

KATEGORIE:
{{#each categories}}
- {{slug}}: {{displayName}}
  Kryteria: {{promptCriteria}}
{{/each}}
```

**Decyzja klasyfikacyjna:** wycieczka otrzymuje kategorię, jeśli `confidence >= 0.6`. Próg konfigurowalny w `app_config` table.

**Cost estimation:** ~500 input tokens + 200 output tokens per classification = ~$0.001 per call. Przy 5k aktywnych wycieczek + ~20% edycji miesięcznie ≈ $5/mc.

**Manual override:** Organizator widzi AI-assigned categories w UI z opcją odznaczenia/dodania. Override loguje się do `CategoryOverride` (źródło danych do tuningu promptu).

### Embeddings (gotowość MVP, użycie w "Similar trips" + Phase 3 personalizacja)

**Stack:**
- **Provider:** Anthropic embeddings (gdy dostępne) lub OpenAI `text-embedding-3-small` (1536d). Domyślnie planujemy OpenAI dla embeddings, bo Anthropic dla classification — multi-provider OK.
- **Trigger:** Trip publish → BullMQ job `ai:embed-trip`.
- **Storage:** `Trip.embedding` jako `vector(1536)` w pgvector.
- **Index:** `CREATE INDEX trip_embedding_idx ON "Trip" USING hnsw (embedding vector_cosine_ops);`

**Use case MVP (nice-to-have):**
```sql
-- "Similar trips" na karcie wycieczki
SELECT id, title, slug
FROM "Trip"
WHERE id != $1 AND status = 'PUBLISHED' AND "deletedAt" IS NULL
ORDER BY embedding <=> (SELECT embedding FROM "Trip" WHERE id = $1)
LIMIT 5;
```

### NSFW moderation media

**Stack:** Sightengine API. Worker `nsfw-check` triggerowany po `MediaStatus = UPLOADED`.

**Pipeline:**
1. Worker pobiera obraz/wideo URL z R2.
2. Wywołanie Sightengine `models=nudity-2.1,offensive,gore`.
3. Decyzja:
   - `nudity.raw + nudity.partial > 0.7` → `moderationStatus = rejected`, media nie publikowane, user notified.
   - Między 0.4 - 0.7 → `flagged`, do manual review w admin queue.
   - Poniżej 0.4 → `approved`, publikacja.
4. Wynik zapisany w `MediaUpload.moderationScore` + `moderationReason`.

---

## 11. Media pipeline

### Upload flow (direct-to-R2)

```
1. Frontend Angular:
   user picks file → POST /api/v1/uploads/sign 
   { context: 'board_post', filename, mimeType, sizeBytes }

2. Backend NestJS:
   a. Validate: max size per context, allowed mime types, user permissions
   b. Rate limit (e.g. 20 uploads/min/user)
   c. Generate r2Key: `${context}/${userId}/${uuid}.${ext}`
   d. Generate R2 presigned PUT URL (TTL 10 min, max size enforced)
   e. Insert MediaUpload (status: PENDING)
   f. Return { uploadId, presignedUrl, expiresAt }

3. Frontend:
   PUT to presignedUrl directly to R2 (with progress bar)

4. Cloudflare R2:
   On successful upload → webhook to /api/v1/webhooks/r2 
   (HMAC-signed) with r2Key

5. Backend webhook handler:
   a. Verify HMAC
   b. Update MediaUpload status = UPLOADED
   c. Enqueue BullMQ jobs:
      - 'media:process' (image: CF Images variant generation; video: CF Stream upload)
      - 'nsfw:check' (Sightengine)
   d. Optionally: WebSocket emit to user.notifications channel

6. Workers process:
   a. media-processing worker:
      - For images: POST to CF Images with original URL → get cfImageId
      - For video: copy to CF Stream → get cfStreamId
      - Store IDs in MediaUpload, set publicUrl
   b. nsfw-check worker:
      - Sightengine API call
      - Update moderationStatus
   c. When both done AND moderation passes:
      - status = READY
      - WebSocket emit 'media:ready' to user
      - Resume any pending operation (e.g. publish board post)

7. Cron safety net:
   Every 5 min: scan MediaUpload status=PENDING older than 10 min → mark FAILED
   Every 1 hour: scan UPLOADED older than 30 min with no webhook → re-enqueue processing
```

### Limits (enforced server-side in /uploads/sign)

| Context | Max size | Allowed types | Max count |
|---|---|---|---|
| `AVATAR` | 5 MB | image/jpeg, image/png, image/webp | 1 per user (replaces) |
| `TRIP_COVER` | 10 MB | image/jpeg, image/png, image/webp | 1 per trip (replaces) |
| `TRIP_GALLERY` | 10 MB | image/jpeg, image/png, image/webp | 10 per trip |
| `BOARD_POST` images | 10 MB | image/jpeg, image/png, image/webp | 10 per post |
| `BOARD_POST` video | 100 MB | video/mp4, video/webm, video/quicktime | 1 per post, max 60s |
| `CHAT_ATTACHMENT` | 25 MB | image/* | n/a (rate-limited) |
| `KYC_DOCUMENT` | 10 MB | image/jpeg, image/png, application/pdf | 2 per verification request |

### Cloudflare Images variants (configured in CF dashboard)

- `avatar`: 200x200, cover, webp
- `card`: 600x400, cover, webp
- `full`: 1600x1200 max, contain, webp
- `thumbnail`: 100x100, cover, webp

URL format: `https://imagedelivery.net/{ACCOUNT_HASH}/{cfImageId}/{variant}`

---

## 12. Auth & autoryzacja

### Token strategy

**Access token (JWT):**
- Algorithm: **RS256** (asymmetric — private key na backend, public dla JWT verification, łatwiejszy key rotation)
- TTL: **15 minutes**
- Claims: `sub` (userId), `email`, `role`, `isPremium`, `iat`, `exp`, `jti`
- Storage on client: **Angular memory only** (signal/service) — NIE localStorage/sessionStorage (XSS risk)
- Transmission: `Authorization: Bearer <token>` header
- Frontend interceptor: on 401 → call `/auth/refresh` → retry request

**Refresh token:**
- Random 256-bit token (`crypto.randomBytes(32)`)
- TTL: **7 days** (configurable to 30)
- Storage on client: **httpOnly Secure SameSite=Strict cookie** `tripico_rt`
- Storage on backend: `RefreshToken` table (SHA-256 hash, family ID, expiresAt, userAgent, ip)
- **Rotation on every use**: refresh issues new access + new refresh, marks old as revoked; refresh detects reuse → revoke entire family (token theft mitigation)
- Cookie scope: domain `tripico.pl`, path `/api/v1/auth`

### Password hashing

- **Argon2id** (parameters: `memory=64MB, iterations=3, parallelism=4`). NIE bcrypt (Argon2 wins OWASP recommendation).
- Library: `argon2` npm package.

### OAuth providers (MVP)

| Provider | Strategy | Setup notes |
|---|---|---|
| **Google** | `passport-google-oauth20` | Easiest; OAuth Client ID + Secret z Google Cloud Console |
| **Facebook** | `passport-facebook` | Wymaga app review (Permissions: `email`, `public_profile`). |
| **Apple** | Phase 2 | Wymaga **paid Apple Developer Account ($99/rok)**, JWT client_secret regen co 6 miesięcy |

**OAuth flow:**
1. `/api/v1/auth/oauth/:provider` → redirect to provider authorize URL.
2. Callback `/api/v1/auth/oauth/:provider/callback`:
   - Validate state, exchange code for access token.
   - Fetch user info (email, displayName, avatar).
   - **Account linking logic:**
     - If `email` exists in DB AND has password → require email/password login first to link (avoids account takeover).
     - If `email` exists with same OAuth provider → log in.
     - If `email` does not exist → create user (auto-verified email).
   - Issue tokens (same as login).
   - Redirect to frontend with `Set-Cookie` for refresh + access in URL fragment.

### Rate limiting (auth endpoints)

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 attempts / 15 min / IP+email |
| `POST /auth/register` | 3 / hour / IP |
| `POST /auth/forgot-password` | 3 / hour / IP+email |
| `POST /auth/refresh` | 30 / min / userId |
| `POST /auth/verify-email` | 10 / hour / IP |

### Authorization (RBAC + ABAC)

**System-level roles** (in JWT claims): `USER`, `MODERATOR`, `ADMIN`.

**Trip-level roles** (from `TripMembership.role`): `ORGANIZER`, `MEMBER`, `PENDING`.

**Guards:**
- `JwtAuthGuard` — global default (sets `req.user`).
- `OptionalJwtAuthGuard` — for endpoints that work for both authed + anon (e.g. trip detail page increments view event for anon too).
- `RolesGuard` + `@Roles('ADMIN')` decorator — system roles.
- `TripMemberGuard` + `@TripRole('ORGANIZER')` — trip-level roles. Reads `tripId` from `params.id`, queries `TripMembership`.
- `OwnershipGuard` — for `BoardPost`, `Message` (sender must match `req.user.id`).

### Email verification gate

User CAN:
- Register, login, browse trips, see profiles.

User CANNOT (until email verified):
- Create trips.
- Request to join trips.
- Send messages.
- Post on boards.

UI shows banner "Verify your email" + "Resend verification" button.

### Verification (premium feature)

**Flow (MVP — manual moderation):**
1. User submits document photo + selfie via `POST /me/verification`.
2. Files uploaded to **private R2 bucket** (`tripico-private`), signed URLs only.
3. `VerificationRequest` created with `status = PENDING`.
4. Admin sees in admin panel queue, opens both images (signed 1h URLs).
5. Approves → `User.verificationLevel = IDENTITY`, `isVerifiedBadge = true`.
6. Rejects → user notified with reason, can resubmit.

**Phase 2:** Integration with **Stripe Identity** or **Veriff** for automated check (~$1.50-3/check) — premium users only, costs covered by subscription.

---

## 13. Płatności

### MVP: Subscription only (Stripe)

**Plans:**
- **Free**: 2 active trips as organizer, no verification badge, ads (Phase 2+).
- **Premium**: 29 PLN/mc (placeholder — final price TBD), unlimited trips, verification badge, no ads.
- **Trial**: 14 days for Premium, no card required upfront? — **decision: card required** (lower conversion but cleaner billing, no "trial abuse" loop).

**Stack:**
- **Stripe Subscriptions** (mode: `subscription` Checkout)
- **Stripe Tax** (auto VAT MOSS for EU)
- **Stripe Customer Portal** (self-service)
- **Payment methods**: cards + BLIK (one-time-confirm BLIK for first charge per session)

**Flow:**

```
1. User clicks "Get Premium"
2. POST /api/v1/billing/checkout:
   a. Lazy-create Stripe Customer (if not yet)
   b. Create Checkout Session (price_id, success_url, cancel_url, trial_period_days=14)
   c. Return { url } → frontend redirects
3. Stripe Checkout → user completes payment
4. Stripe webhook: customer.subscription.created
   a. Verify signature (STRIPE_WEBHOOK_SECRET)
   b. Upsert Subscription record
   c. Set User.isPremium = true, premiumUntil = current_period_end
   d. Emit PostHog event 'subscription_started'
5. On each renewal: customer.subscription.updated
6. On cancel: customer.subscription.deleted
   a. User.isPremium = false, premiumUntil = null
   b. Emit PostHog event 'subscription_cancelled'
```

### Webhook resilience

- Stripe webhooks idempotent przez `event.id` — store processed event IDs w Redis z TTL 7d (`stripe:event:${id}` = 1).
- Retry on failure: Stripe automatically retries up to 3 days with exponential backoff. Twoja odpowiedzialność: zwrócić 2xx tylko gdy event processed successfully.

### Phase 2 marketplace (architectural preview)

**Stripe Connect Express:**
- Pro-organizatorzy: onboarding flow `POST /api/v1/connect/onboard` → Stripe-hosted KYC.
- Booking payment: `PaymentIntent` z `application_fee_amount` (Twoja prowizja, np. 10%) + `transfer_data.destination = connectedAccountId`.
- Refunds: standard `refund` API, ale tylko **przed payout** (po payout — clawback z connected account balance).
- Payouts: weekly schedule by default, organizator może zmienić w portal.

**Tabele Phase 2 (preview):**
```
StripeConnectedAccount (userId, stripeAccountId, kycStatus, payoutSchedule)
PaidTripBooking (tripId, userId, stripePaymentIntentId, amount, fee, status, refundedAmount)
```

**KOMPLIANS — krytyczna nota:**
> Przed launchem marketplace w Fazie 2 **MUSI** być wykonana konsultacja prawna (kancelaria od fintechu). Stripe Connect rozwiązuje licencję agenta rozliczeniowego (Stripe Payments Europe), ale pozostają: polskie prawo konsumenckie, zasady reklamacji, prawo odstąpienia, RODO marketplace, **KSeF** (obowiązkowy dla większych firm). Pominięcie tej konsultacji jest realnym ryzykiem prawnym.

### Reklamy (Phase 2/3 — architectural preview)

- Tabela `Advertisement` z `placement_id`, `target_filters` (JSONB: country, age range, categories), `start_date`, `end_date`, `budget_pln`, `pricing_model` (cpm/cpc/flat), `creative_url`, `landing_url`.
- Frontend rendering: w discovery feed co N-ty kafelek (np. 1 na 8) zarezerwowany dla `<TripCard variant="sponsored">`.
- Płatność za reklamę: znowu Stripe (one-time invoice albo recurring).
- Ad serving logic: simple weighted random by remaining budget, w Fazie 3 ewolucja do real-time bidding.

---

## 14. Telemetria, analytics i observability

### Stack summary

| Layer | Tool | Purpose |
|---|---|---|
| Product analytics | **PostHog Cloud EU** | Events, funnels, retention, feature flags, A/B tests, session replay (10% sampling) |
| Errors + APM | **Sentry** | FE + BE error tracking, performance, traces, source maps |
| Logs | **Pino → Better Stack** | Structured JSON logs, retention 30 days |
| Uptime | **Better Stack Uptime** | Synthetic checks for /healthz, /readyz, key user flows |
| Custom metrics | **(MVP: ad hoc)** | Phase 3: Prometheus + Grafana if scale demands |

### PostHog event taxonomy

**Convention:** `noun_verb` snake_case, past tense (event happened).  
**Standard properties on all events:** `$user_id`, `$session_id`, `$timestamp`, `platform: 'web'`, `app_version`.

**Categories:**

```
# User lifecycle
user_signed_up                  { method: 'email' | 'google' | 'facebook' }
user_verified_email
user_completed_onboarding
user_logged_in                  { method }
user_logged_out
user_account_deleted

# Trip lifecycle
trip_created                    { trip_id, transport, country, price_range }
trip_published                  { trip_id }
trip_viewed                     { trip_id, source: 'discovery' | 'direct' | 'search' }
trip_join_requested             { trip_id }
trip_join_approved              { trip_id, by_organizer_id }
trip_join_rejected              { trip_id }
trip_left                       { trip_id, was_member: true }
trip_cancelled                  { trip_id }

# Engagement
chat_message_sent               { trip_id, message_length }
board_post_created              { trip_id, post_type }
poll_voted                      { poll_id, options_count }
media_uploaded                  { context, size_bytes, type }

# Discovery
discovery_filter_applied        { filter_type, filter_value }
search_performed                { query_length, results_count }
category_clicked                { category_slug }

# Monetization
paywall_shown                   { trigger: 'create_trip_limit' | 'profile_verification' }
paywall_dismissed
subscription_checkout_started
subscription_started            { plan, in_trial: true/false }
subscription_cancelled
payment_failed

# AI
ai_classification_completed     { trip_id, categories: [...], model_version }
ai_classification_overridden    { trip_id, added: [...], removed: [...] }
```

### Feature flags (PostHog)

Use cases at launch:
- `premium_paywall_enabled` — kill switch dla całej monetyzacji w razie problemu z Stripe.
- `ai_classification_enabled` — fallback do manualnej kategoryzacji.
- `web_push_enabled` — kill switch dla notyfikacji.
- `chat_enabled` — kill switch dla WebSocket fleet.
- `discovery_feed_v2` — A/B test nowych algorytmów rankingu w Fazie 2+.

### Sentry configuration

**Backend (NestJS):**
- `@sentry/node` + Sentry's Performance integration with Prisma + HTTP.
- All unhandled exceptions captured automatically.
- Manually capture domain errors via `Sentry.captureException(err, { tags, extra })`.
- Performance: 10% transaction sampling, 100% for errors.
- Releases: tagged on every deploy (Git SHA + version).

**Frontend (Angular):**
- `@sentry/angular`.
- Error handler global.
- Source maps uploaded on build (Vercel deploy hook).
- Session replay disabled in Sentry (we use PostHog for that).

### Pino logger conventions

```typescript
// Log levels: trace, debug, info, warn, error, fatal
logger.info({ userId, tripId }, 'Trip published');
logger.warn({ userId, attempt }, 'Login failed');
logger.error({ err, jobId, queue }, 'BullMQ job failed');
```

- Each HTTP request: `requestId` UUID (correlate across logs).
- BullMQ jobs: `jobId` + `queue` always logged.
- PII redaction: `email`, `phone`, `passwordHash` redacted via Pino `redact` config.

### Uptime checks (Better Stack)

- `GET /healthz` — every 1 min, alert if down 2 consecutive.
- `GET /readyz` — every 1 min.
- Synthetic flow (Phase 2): scripted Playwright "create user → create trip → publish" every 30 min.

### GDPR-friendly analytics

- **PostHog Cloud EU** (Frankfurt) — no transfer to USA.
- **Cookie consent banner** (custom or Cookiebot) — explicit opt-in for analytics.
- `respectDoNotTrack: true` in PostHog SDK config.
- **No PII in event properties** — only `user_id` (UUID).
- **Session replay**: 10% sampling; **mask `data-ph-mask` on all PII inputs** (email, phone, payment fields); **disabled entirely on `/trip/[id]/chat` view**.

---

## 15. CI/CD, środowiska, branching

### Environments

| Env | URL | DB | Auto-deploy from |
|---|---|---|---|
| **PR Preview** | `pr-{N}.tripico-preview.app` | Neon branch from `main` | Open PR (per-PR ephemeral) |
| **Staging** | `staging.tripico.pl` | Neon `staging` branch | `main` branch |
| **Production** | `tripico.pl` | Neon `main` (prod) | `production` branch |

### Branching

```
feature/T-123-trip-discovery    →    main (staging)    →    production (prod)
```

- **Trunk:** `main` — auto-deploys to staging. Merge via PR.
- **Production:** `production` — auto-deploys to prod. Promoted via PR from `main`.
- **Hotfix:** `hotfix/T-456-critical` → direct PR to `production` + cherry-pick to `main`.

### CI pipeline (GitHub Actions)

**On PR open / push to feature branch:**
```yaml
- Lint (ESLint + Prettier)              fail on errors
- Typecheck (tsc --noEmit)              fail on errors
- Unit tests (Jest)                     coverage ≥ 70% on critical paths
- Build (Angular + NestJS)              produce artifacts
- Migration safety check (prisma migrate diff vs production schema)
- E2E smoke (Playwright, key flows)     on PR Neon branch
- Auto-deploy preview (Vercel + Railway PR env)
- Comment PR with preview URL
```

**On merge to `main`:**
```yaml
- All PR checks +
- Integration tests (Testcontainers Postgres)
- Auto-deploy to staging
- Slack notification "Staging updated"
```

**On merge `main` → `production` (PR):**
```yaml
- Pre-deploy: prisma migrate diff dry-run
- Pre-deploy: Sentry release create
- Deploy backend (Railway zero-downtime rolling)
- Deploy frontend (Vercel atomic deploy)
- Post-deploy: synthetic monitoring check
- Auto-rollback if Sentry error rate > 5x baseline in first 5 min
- Slack notification
```

### Quality gates (PR merge blockers)

- ✅ All CI checks passing
- ✅ Code review approval (when team > 1)
- ✅ No merge conflicts
- ✅ Migration validated (no breaking changes without 2-step deploy plan)
- ✅ Test coverage ≥ 70% on changed critical files (Codecov gate)

### Migration policy

**Each migration MUST be backward-compatible for 1 release cycle** (rolling deploy: one instance still on old code while another is on new).

| Operation | Safe? | Strategy |
|---|---|---|
| Add nullable column | ✅ | Single migration |
| Add column with default | ✅ | Default value backfilled by Postgres |
| Add index | ✅ | `CONCURRENTLY` for production-sized tables |
| Drop column | ⚠️ 2-step | Step 1: code stops using; Step 2: drop |
| Rename column | ⚠️ 3-step | Add new + dual-write + remove old |
| Change type | ⚠️ 3-step | Add new col + backfill + swap |
| Add NOT NULL to existing | ⚠️ 2-step | Backfill all rows first, then constraint |

Every migration has a `down` script. Migrations applied via Prisma migrate on deploy.

### Testing strategy

| Layer | Tool | Coverage target |
|---|---|---|
| Unit (services, pure logic) | Jest | 70%+ on critical paths (auth, trips, payments, ranking, ai-classification) |
| Integration (API + DB) | Jest + Testcontainers (Postgres) | Cover all API endpoints with happy + 1-2 error paths |
| E2E (browser) | Playwright | Top 10 user journeys |
| Load (pre-release) | k6 | Smoke test 100 concurrent users / 5 min on staging |

**Critical e2e flows for MVP:**
1. Sign up + verify email + create trip + publish.
2. Discovery: filter trips + click → trip detail.
3. Join request + organizer approval + access chat.
4. Send message in chat (real-time).
5. Create board post with photo.
6. Premium upgrade flow (Stripe Checkout in test mode).
7. Login via Google.
8. Reset password.
9. Account deletion (GDPR).
10. Mobile responsive: discovery + trip detail + chat.

---

## 16. Bezpieczeństwo i compliance

### OWASP top 10 mitigation

| Risk | Mitigation |
|---|---|
| **Injection** | Prisma parameterized queries everywhere; no raw SQL except read-only ranking queries (validated). |
| **Broken auth** | JWT RS256, refresh rotation w/ family detection, rate limits on auth endpoints, Argon2id passwords. |
| **Sensitive data exposure** | TLS everywhere; PII in DB encrypted at rest (Neon default); no PII in logs (Pino redact); no PII in PostHog event properties. |
| **XXE** | N/A (no XML parsing). |
| **Broken access control** | RBAC + ABAC via NestJS guards; trip-level membership checks; no IDOR — all resource access checks ownership. |
| **Security misconfig** | Helmet middleware on NestJS; CSP headers via Vercel; CORS allowlist; secrets in Railway secrets / Vercel env (never in repo). |
| **XSS** | Angular escapes by default; sanitize user content rendered as HTML (DOMPurify for board post markdown if implemented). |
| **Insecure deserialization** | DTO validation via class-validator + Zod for JSONB. |
| **Vulnerable deps** | `npm audit` + Dependabot on GitHub; weekly review. |
| **Insufficient logging** | All auth events, admin actions, payment events logged with correlation IDs. |

### Specific protections

- **CSRF:** Refresh token cookie uses `SameSite=Strict` (mitigates CSRF). Critical state-changing endpoints additionally require valid JWT (not just cookie).
- **Rate limiting:** `@nestjs/throttler` with Redis store. Configurable per-endpoint via decorators.
- **DDoS:** Cloudflare in front of everything; Cloudflare Pro plan offers L7 DDoS protection.
- **File upload security:** Presigned URLs scoped to specific R2 key + max size + content-type. Server validates mime type both at sign and after upload (R2 webhook).
- **Webhook signature verification:** Stripe webhooks: `stripe-signature` HMAC. R2 webhooks: HMAC with shared secret. Reject unsigned requests.
- **Admin panel:** behind separate route (`/admin`), requires `ADMIN` role + optionally IP allowlist for production.

### GDPR / RODO compliance

| Requirement | Implementation |
|---|---|
| **Lawful basis (consent / contract)** | Explicit consent on signup + cookie consent banner for analytics. ToS + Privacy Policy required acceptance. |
| **Data minimization** | Collect only what's needed; verification documents in private bucket, deleted after approval (retention 90 days). |
| **Right to access (Art. 15)** | `GET /api/v1/me/data-export` — async generates JSON export of all user data, emailed link. |
| **Right to erasure (Art. 17)** | `DELETE /api/v1/me` — soft delete + scheduled hard delete after 30 days; GDPR exclusion list maintained for re-signups. |
| **Right to portability (Art. 20)** | Data export includes structured JSON of trips, messages, etc. |
| **Data breach notification** | Sentry + Better Stack alerts → manual notification process; document in internal runbook. |
| **DPA with sub-processors** | Sign DPAs with: Stripe, Anthropic, Sightengine, PostHog, Cloudflare, Vercel, Railway, Neon, Upstash, Sentry, Mapbox. |
| **EU data residency** | All providers chosen with EU regions: PostHog EU, Neon (Frankfurt), Cloudflare (EU PoPs), Upstash (Frankfurt). |

### PII handling

- **Stored:** email, displayName, avatar, bio, OAuth IDs, optionally phone (Phase 2), KYC documents (in private bucket).
- **Hashed:** password (Argon2id).
- **Never stored:** plaintext payment data (Stripe handles), passwords (only hash).
- **Encryption at rest:** Neon default (AES-256), R2 default.
- **Encryption in transit:** TLS 1.3 enforced.

---

## 17. Plan wdrożenia

### Założenia

- **Zespół MVP:** 1-2 developerów (Piotr + opcjonalnie 1 dev).
- **Sprint:** 2 tygodnie.
- **Pierwsze 4 sprinty:** foundation. Następne — feature delivery.
- **Definition of Done:** kod + testy (70%+ coverage critical paths) + dokumentacja w `/docs` + przeszedł code review + zdeployowany na staging + manualny smoke check.

### Faza 1 — MVP (Sprints 1-8, ~16 tygodni)

#### Sprint 1-2: Foundation
- Repo monorepo setup (Turborepo lub Nx) lub two-repo strategy
- NestJS scaffold: ConfigModule, PrismaModule, LoggerModule (Pino), HealthModule
- Angular scaffold: routing, SSR setup, Tailwind, layout shell, design system primitives
- Prisma schema core entities (User, OAuthAccount, RefreshToken, Trip)
- Database setup (Neon + branching), Redis (Upstash)
- CI/CD: GitHub Actions, Vercel + Railway preview deployments
- Sentry + Pino + Better Stack wired in
- **Demo at end:** "Hello World" deployed to staging, full pipeline working

#### Sprint 3-4: Auth & profiles
- Email/password registration + verification flow
- Login + JWT issuance + refresh rotation
- Google OAuth + Facebook OAuth
- Password reset
- Profile CRUD (avatar upload to R2)
- Push subscription registration (Web Push VAPID)
- Notification preferences
- **Demo:** User can sign up, verify email, log in via Google/FB, update profile, register for push notifications

#### Sprint 5-6: Trips CRUD + Discovery (basic)
- Trip create/read/update/delete (organizer only)
- Trip publish flow (DRAFT → PUBLISHED)
- Trip detail page with Mapbox map, gallery
- Discovery feed (basic, no AI yet):
  - "New" sort by `publishedAt DESC`
  - Basic filters (country, dates, transport, price range)
- Postgres FTS search
- Category seed data (15-20 categories)
- Trip cover image + gallery upload pipeline (R2 + CF Images)
- **Demo:** Create trip with cover + gallery, search and filter trips, see trip detail

#### Sprint 7-8: Membership, Chat, Board
- Join request flow + organizer approve/reject
- Trip member list
- Chat WebSocket Gateway (Socket.io + Redis adapter)
- Group chat: send/receive text + image attachments + history pagination
- Organizer DM channels for pending members
- Board posts: text, photos, video (CF Stream), polls
- Real-time board updates (post created → broadcast)
- In-app notifications + Web Push for offline
- NSFW moderation pipeline (Sightengine) for all media
- **Demo:** End-to-end: User A creates trip → User B requests join → A approves → B joins chat → B posts on board → both see it real-time

#### Sprint 9-10: AI categorization + Ranking + Premium
- AI categorization worker (Claude Haiku) — classification on publish + edit
- Manual override UI for organizers
- Multi-signal ranking computation (cron, materialized into `TripRanking`)
- "Trending", "Almost Full", "Popular" feeds on home page
- Category-based sections on home page
- Stripe Subscriptions integration (Checkout + Customer Portal + webhooks)
- Premium gating: trip creation limit for Free users, ad-free state placeholder
- Manual verification flow (KYC documents upload + admin queue + approve/reject)
- **Demo:** AI classifies new trip into categories within 30s; user upgrades to Premium via Stripe; user submits verification documents; admin approves → user gets verified badge

#### Sprint 11-12: Polish, admin, GDPR, load test
- Admin panel (Angular sub-app or admin route): user management, trip moderation, verification queue, reports
- Reporting flow (report user/trip/post)
- GDPR: data export endpoint + account deletion endpoint
- Cookie consent banner
- Privacy Policy + ToS pages
- PostHog events instrumented across critical paths
- Performance audit: Lighthouse scores ≥ 90 on mobile
- Accessibility audit: WCAG 2.1 AA basic compliance
- Load test (k6) on staging — 100 concurrent users, 5 min
- Bug bash + polish
- **Demo:** Full production-ready app on staging

#### Sprint 13-14 (buffer): Beta launch + iteration
- Beta launch to 100-500 invited users
- PostHog funnel analysis: identify drop-offs
- Sentry triage: critical bugs
- Performance optimization based on real data
- **Demo:** Public launch

### Faza 2 — Marketplace + advanced features (Sprints 15-20, ~12 tygodni post-MVP)

- Apple Sign-In OAuth
- Phone verification (SMS OTP)
- **Stripe Connect Express** — pro-organizer onboarding, KYC
- **Paid bookings**: marketplace flow with escrow + commission
- Refunds + payouts
- Sponsored cards in discovery feed
- Ad management admin UI
- **Split kosztów** (Splitwise-like)
- **Lista pakowania** shared in group
- Meilisearch integration (if catalog > 5k)
- pgvector "Similar trips" (if not in MVP)
- Automatic invoices (Fakturownia/InFakt) + KSeF readiness
- **Legal audit before marketplace launch (mandatory)**

### Faza 3 — Growth & personalization (Sprints 21+)

- AI sub-collections (dynamic clusters within fixed categories)
- Personalized feed (ML recommendations)
- Reputation system (ratings + reviews)
- Premium tiers
- i18n (English + Czech + German)
- Mobile native apps (Capacitor wrap)
- Public API

---

## 18. Ryzyka

| # | Ryzyko | Prawdopodobieństwo | Impact | Mitygacja |
|---|---|---|---|---|
| R1 | **Cold start problem**: <500 trips on launch, dyskoverowanie nieciekawe, churn high | Wysokie | Wysokie | Beta launch z seedem 50-100 wycieczek (płatni "ambassadors"); partner z istniejącymi grupami FB; AI categorization niezależna od ilości (lepsza UX nawet dla mała baza) |
| R2 | **Cost spike na video**: userzy wrzucają dużo wideo, CF Stream bills eksplodują | Średnie | Średnie | Hard cap 100MB/60s; monitoring CF Stream usage; alarm w Better Stack przy threshold; w razie czego — tighten limits |
| R3 | **NSFW/illegal content**: pierwszy troll wrzuca treści nielegalne, problem PR/prawny | Średnie | Bardzo wysokie | Sightengine moderation on ALL media before publish; admin queue dla flagged; reporting flow + szybki response time SLA (4h on flagged content); ToS jasno definiuje zakazane treści |
| R4 | **Marketplace compliance**: Phase 2 launch bez konsultacji prawnej, KNF problem | Niskie (jeśli audyt) | Krytyczne | **Obowiązkowy** audyt prawny przed Phase 2; Stripe Connect załatwia 90%, ale pozostałe 10% (KSeF, prawo konsumenckie, ODR) — wymaga prawnika |
| R5 | **Apple Push (PWA na iOS)**: userzy iOS nie instalują PWA, nie dostają notyfikacji | Wysokie | Średnie | Banner "Add to Home Screen" przy pierwszym join trip; education in UI; długoterminowo: native iOS app w Phase 2 |
| R6 | **Chat scale**: messages table puchnie, query po `trip_id ORDER BY createdAt DESC` wolny przy 50M+ wierszy | Niskie w Y1 | Średnie | Indeksy + cursor pagination od początku; partycjonowanie schema-ready (włączamy gdy boli, ~5M+ rows); archive old trips' messages do cold storage w Phase 3 |
| R7 | **Anthropic API outage** lub rate limit | Średnie | Niskie | AI classification jest async i nie blokuje publish; fallback: trip published bez kategorii, user sees "Categorizing..."; alternatywny provider (OpenAI) jako emergency switch przez feature flag |
| R8 | **Vercel/Railway/Neon outage** | Niskie | Wysokie | Cloudflare maintenance page; status communication via @TripicoPL Twitter; w razie chronicznych problemów — migration plan to Hetzner (Coolify) prepared but not executed |
| R9 | **Spam organizers / fake trips**: trolle tworzą fake wycieczki, manipulują rankingiem | Średnie | Średnie | Email verification gate + Web Push subscription jako proof-of-life; rate limits na trip creation (5/dzień Free, 20/dzień Premium); reporting + admin queue; Phase 3: reputation system filtruje |
| R10 | **GDPR data request flood**: bad actor zalewa data export requests | Niskie | Niskie | Rate limit 1 export request/30 dni per user; async fulfillment (24h SLA, not real-time) |
| R11 | **Stripe webhook miss / race condition**: subscription state out of sync | Niskie | Średnie | Webhook idempotency via event.id w Redis; daily reconciliation job: query Stripe API for active subs vs DB state |
| R12 | **Single-developer dependency** (jeśli Piotr solo): bus factor 1 | Wysokie | Krytyczne | Dokumentacja w `/docs` na każdy moduł; ADR (Architecture Decision Records); README runbook; ten PRD jako baseline knowledge transfer |

---

## 19. Metryki sukcesu

### North Star

**Liczba ZAAKCEPTOWANYCH dołączeń do wycieczek tygodniowo** (`trip_join_approved` events).

Powód: to event, który łączy wszystkie strony produktu — discovery działa (user znalazł), trust działa (organizator zaakceptował), engagement działa (kontakt nawiązany). Każdy inny metryka (signups, MAU) to vanity bez tego eventu.

### KPI dashboard (PostHog)

**Acquisition:**
- Daily / Weekly / Monthly Active Users (DAU / WAU / MAU)
- New signups per day
- Source breakdown (organic / referral / paid)
- Onboarding completion rate (% userów którzy verify email + complete profile)

**Activation:**
- % userów którzy view trip detail in first session
- % userów którzy join request a trip within D7
- Time to first join request

**Engagement:**
- Trips joined per active user (rolling 30d)
- Chat messages sent per active member
- Board posts per trip
- DAU / MAU ratio (target: > 0.2)

**Retention:**
- D1, D7, D30 retention curves
- Cohort analysis by signup month
- Churn rate (Premium users)

**Monetization:**
- Free → Premium conversion rate (target: 3-7% Y1)
- Trial → Paid conversion (target: > 50%)
- MRR (Monthly Recurring Revenue)
- Churn-adjusted LTV
- CAC (Customer Acquisition Cost) — gdy będzie paid acquisition

**Product health:**
- Trip publish → first join request median time
- Trip publish → fully booked rate (% trips reaching `maxMembers`)
- Trip cancellation rate
- Report-to-resolution time (admin SLA)

### Operational SLAs

| Metric | Target |
|---|---|
| API p95 latency | < 300 ms |
| API p99 latency | < 800 ms |
| WebSocket message delivery (in same room) | < 200 ms |
| Search query p95 | < 200 ms |
| Trip page LCP (Lighthouse mobile) | < 2.5 s |
| Uptime (production) | ≥ 99.5% (allows ~3.5h downtime/month) |
| Sentry error rate | < 0.5% of requests |
| Push notification delivery (online) | < 5 s |
| AI classification completion | < 30 s p95 |
| Stripe webhook processing | < 2 s |

---

## 20. Known limitations & assumptions

### Limitations w MVP

- **iOS Web Push:** wymaga zainstalowania PWA na ekranie głównym (iOS 16.4+). Standardowa karta Safari NIE dostanie notyfikacji. UX: pokazujemy banner "Add to Home Screen" przy pierwszym join trip dla użytkowników iOS Safari.
- **Brak natywnych aplikacji mobile:** PWA only. Phase 2/3 decyzja.
- **Brak czatu features:** typing indicators, read receipts, reactions, threads, mentions, voice notes — wszystko Phase 2+.
- **Brak split kosztów / packing list:** Phase 2.
- **Brak weryfikacji telefonu:** Phase 2.
- **Apple Sign-In:** Phase 2 (developer account + setup overhead).
- **Search FTS limits:** Postgres FTS scaluje się do ~5-10k aktywnych wycieczek. Przekroczenie tego = migracja do Meilisearch (zaplanowane Phase 2).
- **Manual KYC verification:** w MVP admin ręcznie review documents. Phase 2 → Stripe Identity / Veriff.
- **Single region:** Vercel + Railway + Neon w EU only. Cross-region jest Phase 3+ jeśli kiedykolwiek wyjdziemy poza Europę.
- **Brak public API:** Phase 3.

### Architectural assumptions

- **Skala Y1:** 10k MAU jest hard upper bound dla obecnej architektury bez fundamentalnych zmian. Powyżej 50k MAU pojawiają się decyzje typu read replicas, dedicated chat service, sharding messages table.
- **Komercyjne wycieczki:** zakładamy że są **wyłączone** w MVP — userzy mogą się zrzucać na paliwo (off-platform), ale platforma nie obsługuje płatności trip-level. Phase 2 wprowadza marketplace dla pro-organizatorów.
- **Język:** wszystko po polsku w MVP. i18n architecture-ready (struktura plików, brak hardcoded strings), ale aktywujemy w Phase 3.
- **Currency:** PLN domyślnie, ale schemat wspiera multi-currency (Phase 2 dla pro-organizatorów oferujących wycieczki w EUR).
- **Privacy mode:** wszystkie wycieczki są **publicznie widoczne** (discovery). Prywatne wycieczki (invite only) są Phase 3 feature.

---

## 21. Open questions (do decyzji przed Sprint 1)

1. **Repo strategy:** monorepo (Turborepo / Nx) czy two-repo (`tripico-api` + `tripico-web`)? — *Rekomendacja: monorepo (Turborepo) dla shared types between FE i BE.*
2. **Premium price point:** 19, 29, 39 PLN/mc? — *Decyzja produktowa, zakładamy placeholder 29 PLN/mc, A/B test po launchu.*
3. **Trial card-required vs not:** wymagamy karty przed 14d trialem? — *Rekomendacja: tak (cleaner billing, mniej trial abuse).*
4. **Free plan limit:** "max 2 active trips as organizer" — czy to dobra granica? — *Decyzja produktowa, można tunować feature flagiem.*
5. **Brand: `tripico.pl` vs `tripico.com`** — która domena primary? — *Decyzja biznesowa.*
6. **Logo, branding, design system tokens** — wymagane przed Sprint 2 (Angular scaffolding).
7. **Onboarding tour:** czy wymagamy walkthrough po signup? — *Rekomendacja: minimal hint cards, nie full tour. Walidacja po beta.*

---

## Appendix A: Project structure (suggested)

```
tripico/
├── apps/
│   ├── api/                     # NestJS app
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── trips/
│   │   │   │   ├── discovery/
│   │   │   │   ├── chat/
│   │   │   │   ├── board/
│   │   │   │   ├── media/
│   │   │   │   ├── notifications/
│   │   │   │   ├── billing/
│   │   │   │   ├── ai/
│   │   │   │   ├── moderation/
│   │   │   │   ├── admin/
│   │   │   │   ├── webhooks/
│   │   │   │   └── shared/      # guards, decorators, pipes
│   │   │   ├── workers/         # BullMQ workers
│   │   │   │   ├── media-processing.worker.ts
│   │   │   │   ├── nsfw-check.worker.ts
│   │   │   │   ├── ai-classify.worker.ts
│   │   │   │   ├── ranking-recompute.worker.ts
│   │   │   │   ├── push-notifications.worker.ts
│   │   │   │   └── email.worker.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── test/
│   ├── web/                     # Angular app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/        # services, guards, interceptors
│   │   │   │   ├── shared/      # UI primitives, pipes, directives
│   │   │   │   ├── features/
│   │   │   │   │   ├── auth/
│   │   │   │   │   ├── discovery/
│   │   │   │   │   ├── trip-detail/
│   │   │   │   │   ├── trip-create/
│   │   │   │   │   ├── chat/
│   │   │   │   │   ├── board/
│   │   │   │   │   ├── profile/
│   │   │   │   │   ├── billing/
│   │   │   │   │   └── admin/
│   │   │   │   ├── layout/
│   │   │   │   └── app.routes.ts
│   │   │   ├── assets/
│   │   │   ├── manifest.webmanifest
│   │   │   ├── sw.ts            # service worker custom logic
│   │   │   └── main.ts
│   │   └── e2e/                 # Playwright tests
│   └── admin/                   # (optional separate admin app, or sub-route in web)
├── packages/
│   ├── shared-types/            # TypeScript types shared FE ↔ BE (DTO contracts)
│   ├── eslint-config/
│   └── tsconfig/
├── .github/
│   └── workflows/
├── docs/                        # ADRs, runbooks, this PRD
├── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## Appendix B: Critical NestJS code patterns

**PrismaService (singleton, lifecycle-aware):**
```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

**Trip member guard:**
```typescript
@Injectable()
export class TripMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}
  
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<TripMemberRole[]>('tripRoles', ctx.getHandler());
    const req = ctx.switchToHttp().getRequest();
    const tripId = req.params.id;
    const userId = req.user.id;
    
    const membership = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    
    if (!membership) return false;
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.includes(membership.role);
  }
}

// Usage:
@TripRole('ORGANIZER')
@UseGuards(JwtAuthGuard, TripMemberGuard)
@Post(':id/cancel')
cancelTrip(...) {}
```

**Idempotent webhook handler skeleton:**
```typescript
@Post('webhooks/stripe')
@HttpCode(200)
async handleStripe(
  @Headers('stripe-signature') sig: string,
  @Req() req: RawBodyRequest<Request>,
) {
  const event = this.stripe.webhooks.constructEvent(req.rawBody, sig, this.config.stripeWebhookSecret);
  
  const alreadyProcessed = await this.redis.set(
    `stripe:event:${event.id}`, '1', 'EX', 60 * 60 * 24 * 7, 'NX'
  );
  if (alreadyProcessed === null) return { received: true, duplicate: true };
  
  await this.billingService.handleStripeEvent(event);
  return { received: true };
}
```

---

**END OF PRD**

> Ten dokument jest źródłem prawdy dla architektury Tripico MVP.  
> Wszelkie zmiany wymagają explicit decision + update tego dokumentu (ADR w `/docs/adr/`).  
> **Nie kopiujemy kawałków do innych dokumentów — linkujemy.**
