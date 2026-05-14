# Database

## Engine

PostgreSQL 16 (Neon for production; local Docker for dev — not yet configured). Per [AGENTS.md §4](../AGENTS.md), Prisma is the only ORM. No raw SQL except for FTS, pgvector, and ranking queries.

## Schema location

- Source: `apps/backend/prisma/schema.prisma`
- Migrations: `apps/backend/prisma/migrations/` (tracked in git)
- Generated client: `node_modules/.prisma/client` (gitignored)

## Migration policy

Per [AGENTS.md §4](../AGENTS.md) + [PRD §15](./PRD.md):

- Every schema change → `npx prisma migrate dev --name descriptive_name`
- Migrations must be **backward-compatible for 1 deploy cycle**
- Breaking changes split into 2-step or 3-step migrations across PRs
- Commit schema + migration files together

## Models

_None yet. Schema currently has only `generator client` + `datasource db`._

When models are added, list them here grouped by domain (User, Trip, Membership, Chat, Media, Billing, Moderation). Mark soft-delete tables with `(soft)`.

## Indexes

_None yet. When adding `WHERE`, `ORDER BY`, `JOIN` columns, document the index here AND in the Prisma schema._

| Table | Column(s) | Purpose |
|---|---|---|
| _tbd_ | _tbd_ | _tbd_ |

## RPCs / Raw SQL

_None yet. When raw SQL is needed (ranking, FTS, pgvector), document why and where._

## Extensions

Planned (not yet enabled):
- `pgvector` — for embedding similarity (AI categorization)
- `pg_trgm` — for fuzzy search / typo tolerance
- `unaccent` — for PL-safe FTS

Update this file when: new model added, new index added, new extension enabled, raw SQL added.