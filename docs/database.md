# Database

## Engine

PostgreSQL 17 (local dev via Homebrew; Neon for production once provisioned). Per [AGENTS.md §4](../AGENTS.md), Prisma 7 + `@prisma/adapter-pg` driver adapter is the only ORM (Rust engine retired — see [ADR-004](./decisions.md)). No raw SQL except FTS, pgvector, and ranking queries (none implemented yet).

## Schema location

- Source: `apps/backend/prisma/schema.prisma`
- Migrations: `apps/backend/prisma/migrations/` (tracked in git)
- Generated client: `apps/backend/src/generated/prisma/` (gitignored, kept in `src/` so TS rootDir resolves)

## Migration policy

Per [AGENTS.md §4](../AGENTS.md) + [PRD §15](./PRD.md):

- Every schema change → `npm run prisma:migrate -- --name descriptive_name`
- Migrations must be **backward-compatible for 1 deploy cycle**
- Breaking changes split into 2-step or 3-step migrations across PRs
- Commit schema + migration files together

Applied migrations (chronological):

| Name | Tables / fields added |
|---|---|
| `20260514011246_initial` | User, OAuthAccount, RefreshToken, PushSubscription, Trip, TripMembership |
| `20260514015112_add_board_posts` | BoardPost (+ BoardPostType enum) |
| `20260514015500_add_chat` | ChatChannel, Message (+ ChatType enum) |
| `20260514015812_add_email_verification` | User.emailVerificationTokenHash + emailVerificationExpiresAt |
| `20260514020454_add_notifications` | Notification (+ NotificationType enum) |

## Models

Grouped by domain. Soft-delete marker `(soft)` = has `deletedAt` column and queries must filter it.

### Users & auth
- **User** `(soft)` — email/passwordHash/displayName/slug + role + premium denorm + email-verification fields
- **OAuthAccount** — provider linkage (one row per provider per user)
- **RefreshToken** — SHA-256 hashed, family-based rotation, userAgent + ip
- **PushSubscription** — Web Push endpoint + keys (not used yet)

### Trips
- **Trip** `(soft)` — slug, organizerId, destination, dates, transport, price, currency, status, denormalized currentMembers
- **TripMembership** — role (ORGANIZER / MEMBER / PENDING), joinedAt, leftAt; unique on (tripId, userId)

### Board
- **BoardPost** `(soft)` — { type, content (Json), pinnedAt }; trip-scoped; member-only access

### Chat
- **ChatChannel** — unique on (tripId, type); TRIP_GROUP used; ORGANIZER_DM scaffolded but unused
- **Message** `(soft)` — channelId, senderId, text, editedAt

### Notifications
- **Notification** — type, payload (Json), readAt; per-user feed

### Deferred (in PRD §7 but not yet modeled)
Category, TripCategory, CategoryOverride, TripRanking, BoardComment, PollVote, MediaUpload, TripEvent, NotificationPreference, Subscription, VerificationRequest, Report.

## Indexes

| Table | Column(s) | Purpose |
|---|---|---|
| User | email | login lookup |
| User | slug | profile URL `/u/:slug` |
| User | deletedAt | soft-delete filter |
| OAuthAccount | (provider, providerAccountId) UNIQUE | de-dup OAuth links |
| OAuthAccount | userId | back-ref |
| RefreshToken | tokenHash UNIQUE | rotation lookup |
| RefreshToken | userId / family / expiresAt | session ops + cleanup |
| PushSubscription | endpoint UNIQUE / userId | push send + per-user list |
| Trip | (status, deletedAt) | discovery default filter |
| Trip | organizerId | "my trips" |
| Trip | startDate | calendar filters |
| Trip | (destinationCountry, startDate) | country-scoped discovery |
| Trip | (transport, pricePerPerson) | filter combination |
| Trip | slug UNIQUE | detail page |
| TripMembership | (tripId, userId) UNIQUE | enforce one role per user per trip |
| TripMembership | (tripId, role) / userId | membership lookups |
| BoardPost | (tripId, createdAt DESC) / authorId | feed + author filter |
| ChatChannel | (tripId, type) UNIQUE / tripId | one channel per type per trip |
| Message | (channelId, createdAt DESC) / senderId | recent messages + sender history |
| Notification | (userId, readAt) / (userId, createdAt DESC) | unread badge + list |

## RPCs / Raw SQL

None yet. Trip.searchVector is declared as `Unsupported("tsvector")?` for future use but the GIN index + trigger to populate it haven't been added — title search currently uses Prisma `contains` (ILIKE-style) as a stopgap.

## Extensions

Available in local dev Postgres but **NOT yet enabled** (`CREATE EXTENSION` not issued):
- `pgvector` (0.8.1) — for embedding similarity (PRD §10 AI categorization)
- `pg_trgm` (1.6) — for fuzzy / typo-tolerant search
- `unaccent` (1.1) — for PL-safe FTS

Update this file when: new model added, new index added, new extension enabled, raw SQL added.
