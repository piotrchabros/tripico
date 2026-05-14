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

---

## Bug Log

_Append fixes here with root cause, not just symptom. Format:_

```
### BUG: Short title (YYYY-MM)
**Cause**: Root cause.
**Fix**: What was changed.
```

_No entries yet._
