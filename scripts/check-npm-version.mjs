#!/usr/bin/env node
/**
 * Preinstall guard: abort if the npm currently running doesn't match the
 * `packageManager` field in package.json. Saves us from regenerating the
 * lockfile under the wrong npm and watching Railway `npm ci` fail with
 * "Missing: <transitive> from lock file" 30 minutes later.
 *
 * To use the right npm:
 *   corepack enable
 *   corepack prepare npm@<expected> --activate
 *
 * Skipped automatically when SKIP_NPM_VERSION_CHECK=1 (e.g. CI step that
 * intentionally uses a different npm).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

if (process.env.SKIP_NPM_VERSION_CHECK === '1') process.exit(0);

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
);

const expectedSpec = pkg.packageManager;
if (!expectedSpec || !expectedSpec.startsWith('npm@')) process.exit(0);

const expected = expectedSpec.replace('npm@', '').trim();
const actual = process.versions?.npm;
if (!actual || actual === expected) process.exit(0);

console.error('\n  npm version mismatch');
console.error(`     expected: ${expected} (from packageManager)`);
console.error(`     running : ${actual}`);
console.error('\n   Fix once per machine:');
console.error(`     corepack enable`);
console.error(`     corepack prepare ${expectedSpec} --activate`);
console.error('\n   Then re-run your install. Skip this check with');
console.error('   SKIP_NPM_VERSION_CHECK=1 if you really need to.\n');
process.exit(1);
