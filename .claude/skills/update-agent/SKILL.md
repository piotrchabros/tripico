---
name: update-agents-md
description: Updates AGENTS.md and docs/ files to reflect recent project changes. Use when user says "zaktualizuj agents", "update agents", "update docs", after major architectural changes, or before a commit that changed the project structure.
---

# Update AGENTS.md & Docs

## When to Use

- User says "zaktualizuj agents", "update agents", "update docs"
- After major changes: new DB tables, new edge functions, stack changes, new features
- Before commits that changed architecture, commands, or conventions
- Periodically to keep docs accurate

## Workflow

### Step 1 — Identify what changed

Check recent changes:

```bash
# Recent changes (last 5 commits or uncommitted)
git diff --name-only HEAD~5..HEAD 2>/dev/null
git diff --name-only HEAD 2>/dev/null
git diff --name-only --cached 2>/dev/null
```

If user specifies a scope (e.g., "just updated the database"), focus on that area.

### Step 2 — Map changes to docs

Use this mapping to determine which docs/ files need updating:

| Changed files | Update |
|---------------|--------|
| `supabase/migrations/*`, schema changes | `docs/database.md` |
| `supabase/functions/*` (new/modified) | `docs/edge-functions.md` |
| `src/components/*` (new/removed) | `docs/components.md` |
| `src/hooks/*` (new/removed) | `docs/components.md` |
| `src/App.tsx` (route changes) | `docs/architecture.md` |
| `website/src/pages/*` (new pages) | `docs/architecture.md` |
| `docker-compose.yml`, `Caddyfile` | `docs/architecture.md` |
| `package.json` (new scripts, deps) | `AGENTS.md` (commands), `docs/architecture.md` |
| `tsconfig.json`, linter config | `docs/coding-standards.md` |
| Security-related changes | `docs/security.md` |
| Architecture decisions, trade-offs | `docs/decisions.md` |
| Bug fixes | `docs/decisions.md` (bug log section) |
| `.env.example` changes | `docs/coding-standards.md` (env vars section) |

### Step 3 — Read current docs

For each doc file identified in Step 2:
1. Read the current content
2. Compare with actual project state
3. Identify what's stale, missing, or incorrect

### Step 4 — Update docs

For each stale doc:
- Update only the sections that changed
- Keep format consistent with existing content
- Add new entries (new functions, components, tables) in the correct section
- Remove entries for deleted items
- Do NOT rewrite accurate content

**For new ADRs** (architecture decisions), append to `docs/decisions.md`:
```markdown
### ADR-NNN: Title (YYYY-MM)

**Decision**: What was decided.
**Rationale**: Why.
**Trade-off**: What we gave up.
```

**For bug fixes**, append to the Bug Fixes section:
```markdown
### BUG: Short title (YYYY-MM)
**Cause**: Root cause.
**Fix**: What was changed.
```

### Step 5 — Validate AGENTS.md

Check if AGENTS.md itself needs changes:
- New command added to package.json? → Update Commands section
- Stack changed (new major dependency)? → Update Stack section
- New doc file created? → Add to Docs section
- Critical rule changed? → Update Critical Rules

**HARD RULE**: AGENTS.md must stay under 50 lines. If adding something, consider removing something less important.

### Step 6 — Report

```
Docs updated:
  Updated — docs/database.md (added new_table, updated RPC list)
  Updated — docs/edge-functions.md (added new-function)
  Skipped — docs/architecture.md (already accurate)
  Skipped — AGENTS.md (no changes needed)
```

## Key Principles

- **Minimal changes** — update only what's stale, don't rewrite everything
- **AGENTS.md stays tiny** — under 50 lines, always
- **Scan before writing** — read the actual code, don't guess
- **Append, don't restructure** — keep existing format consistent
- **Decisions are permanent** — never delete ADRs, only add new ones
- **Bug log is chronological** — newest entries at the bottom of each year section
