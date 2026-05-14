#!/usr/bin/env node
/**
 * Materialise apps/tripico/src/environments/environment.prod.ts from its
 * template, substituting `__TOKEN__` placeholders with process.env values.
 *
 * Why: Angular file-replacement bakes whatever's in environment.prod.ts
 * into the production bundle, but we don't want public-but-key-shaped
 * secrets (PostHog phc_, future analytics keys) in git. This script lets
 * Vercel inject them per-environment via project env vars.
 *
 * Local dev:  unset tokens are kept as empty strings so the bundle just
 *             disables the feature gracefully (AnalyticsService no-ops
 *             on placeholder / empty keys).
 * Vercel:     POSTHOG_API_KEY env var set in Project Settings → values
 *             land in the generated environment.prod.ts during build.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const templatePath = join(
  repoRoot,
  'apps/tripico/src/environments/environment.prod.template.ts',
);
const outputPath = join(
  repoRoot,
  'apps/tripico/src/environments/environment.prod.ts',
);

// Each token maps to a process.env var. When the env var is unset we
// substitute an empty string — AnalyticsService treats empty + the
// `__` prefix sentinel the same way (silent skip).
const TOKENS = {
  __POSTHOG_API_KEY__: process.env.POSTHOG_API_KEY ?? '',
};

let content = readFileSync(templatePath, 'utf-8');
const summary = [];
for (const [token, value] of Object.entries(TOKENS)) {
  const before = content;
  content = content.split(token).join(value);
  if (before !== content) {
    summary.push(
      value
        ? `${token} ← ${value.slice(0, 8)}…`
        : `${token} ← (unset, left empty)`,
    );
  }
}

writeFileSync(outputPath, content, 'utf-8');
console.log(`[build-env] wrote ${outputPath}`);
for (const line of summary) console.log(`  ${line}`);
