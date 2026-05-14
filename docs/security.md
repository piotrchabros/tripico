# Security

## Engineering rules

The canonical security rules are in [AGENTS.md §8](../AGENTS.md) — Helmet, CORS allowlist, rate limiting, input validation, webhook signatures, etc. This file complements those with **runbook-style** info: known surfaces, threat model notes, incident history.

## Threat model — MVP scope

_To be filled in. Cover at minimum:_
- Auth surface (registration, login, refresh rotation, password reset)
- Webhook surface (Stripe, R2, Cloudflare)
- File upload surface (R2 presigned URLs, NSFW pipeline)
- Admin surface (`/admin` endpoints + IP allowlist)
- WebSocket surface (`WsJwtAuthGuard` + room membership checks)

## Known surfaces requiring extra review

| Area | Why | Mitigation owner |
|---|---|---|
| Stripe webhooks | Idempotency + signature verification critical | _tbd_ |
| R2 presigned URLs | TTL + content-type + size limits enforced server-side | _tbd_ |
| Trip join flow | Race condition on `currentMembers` increment | _tbd (transaction)_ |
| Chat broadcasts | User must be in room before send | `TripMemberGuard` |

## Secrets management

- Local: `.env.local` (gitignored)
- Production: Railway/Vercel env vars
- Validation: Zod schema in `apps/backend/src/config/` (TBD)
- Failed validation → crash on boot (do NOT run with bad config)

## .env.example

Authoritative list of required env vars lives in `.env.example` at repo root. Every new env var added to code → update `.env.example` in the same PR.

## Incident history

_No incidents yet. Document Sentry alerts that required code changes here, format:_

```
### INCIDENT: Short title (YYYY-MM-DD)
**Detection**: How spotted (Sentry, user report, monitoring).
**Impact**: Scope (users affected, data exposed).
**Root cause**: What broke.
**Fix**: What changed.
**Prevention**: Test added / rule added / monitoring added.
```
