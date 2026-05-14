---
name: create-agents-md
description: Creates a minimal AGENTS.md and docs/ skeleton for a new project based on prd.md or project description. Use when bootstrapping a new project, user says "stworz agents.md", or starting work on a repo without AGENTS.md.
---

# Create AGENTS.md

## When to Use

- New project without AGENTS.md
- User says "stworz agents.md", "bootstrap", "create agents"
- Starting work on a repo for the first time

## Workflow

### Step 1 — Gather project info

Check for sources of truth (in order):

1. `prd.md` in repo root — if exists, read it
2. `README.md` — read for project description and setup
3. `package.json` / `pyproject.toml` / `Cargo.toml` — detect stack and scripts
4. If none found, ask the user for a 1-2 sentence project description

### Step 2 — Scan project structure

```bash
# Detect stack
ls package.json pyproject.toml Cargo.toml go.mod 2>/dev/null

# Detect scripts/commands
cat package.json | grep -A 20 '"scripts"' 2>/dev/null

# Detect project layout
ls -d */ 2>/dev/null

# Detect existing docs
ls docs/ *.md 2>/dev/null
```

From the scan, identify:
- **Language/framework** (React, Python, Rust, Go, etc.)
- **Package manager** (npm, pnpm, pip, cargo, etc.)
- **Key commands** (dev, build, test, deploy)
- **Project layout** (monorepo, single app, etc.)
- **Existing docs** to reference

### Step 3 — Generate AGENTS.md

Create `AGENTS.md` at repo root. MUST be under 50 lines. Follow this template:

```markdown
# Project Name

One sentence: what the project does and for whom.

**Key identifiers** (domain, project IDs, etc. — only if relevant)

## Stack

- **Component**: Technology → `directory/`
- (max 6 bullet points)

## Commands

\```bash
command1  # what it does
command2  # what it does
\```

## Docs

For detailed documentation, see `docs/`:

- [docs/file.md](docs/file.md) — short description

## Critical Rules

- Rule 1 (only rules that apply to EVERY task)
- Rule 2
- (max 6 rules)
```

**Rules for AGENTS.md content:**
- ONE sentence project description — acts as role prompt
- Stack as bullet list, NOT table — shorter
- Commands from package.json scripts — only dev/build/deploy
- Links to docs/ — progressive disclosure
- Critical rules — ONLY things relevant to every single task
- NO directory trees, NO full file listings, NO tables of all API endpoints
- NO information that changes frequently (file counts, specific versions)

### Step 3.5 — Always create CLAUDE.md

Always create `CLAUDE.md` in repo root together with `AGENTS.md`.

`CLAUDE.md` should be minimal and must:
- clearly point to `AGENTS.md` as the source of truth
- mention that detailed operational docs live in `docs/`
- include a short consistency rule (`CLAUDE.md` and `AGENTS.md` stay aligned)

### Step 4 — Generate docs/ skeleton

If `docs/` doesn't exist, create it with files appropriate to the detected stack:

**Always create:**
- `docs/architecture.md` — project structure, key directories, how things connect
- `docs/coding-standards.md` — conventions detected from the codebase

**Create if relevant:**
- `docs/database.md` — if SQL/ORM/migrations detected
- `docs/api.md` — if API endpoints detected
- `docs/deployment.md` — if deploy scripts/Docker/CI detected
- `docs/components.md` — if frontend components detected

Each doc file should have:
- A heading matching the filename
- Populated content based on actual project scan (not placeholders)
- Concise, scannable format (tables, bullet points)

If `docs/` already exists, do NOT overwrite — just ensure AGENTS.md links to existing files.

### Step 5 — Validate

Check that:
- [ ] AGENTS.md is under 50 lines
- [ ] AGENTS.md has: description, stack, commands, docs links, critical rules
- [ ] CLAUDE.md exists in repo root and points to AGENTS.md
- [ ] All docs/ links in AGENTS.md point to existing files
- [ ] docs/ files contain real content (not just headings)
- [ ] No duplicate information between AGENTS.md and docs/

### Step 6 — Report

Tell the user:
```
AGENTS.md created (X lines)
CLAUDE.md created
docs/ created with:
  - docs/architecture.md
  - docs/coding-standards.md
  - ...
```

## Key Principles

- **Minimal AGENTS.md** — every token loads on every request; keep it tiny
- **Always pair with CLAUDE.md** — Claude Code entrypoint must redirect to AGENTS.md
- **Progressive disclosure** — details go in docs/, not AGENTS.md
- **Real content** — scan the actual codebase, don't write generic placeholders
- **No stale paths** — describe capabilities, not file paths that will change
- **Under 50 lines** — this is a hard limit for AGENTS.md
