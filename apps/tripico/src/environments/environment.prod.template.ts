// TEMPLATE — read by scripts/inject-build-env.mjs.
// Placeholder tokens (the double-underscore strings on the right-hand
// side below) are replaced with values from `process.env` at build
// time on Vercel. The generated file at environment.prod.ts is
// gitignored so secrets never land in source.
// Locally, run `npm run build:frontend` (the script runs first) or
// `node scripts/inject-build-env.mjs` to materialise the file.

export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  wsBaseUrl: 'https://tripico-production.up.railway.app',
  posthogKey: '__POSTHOG_API_KEY__',
  posthogHost: 'https://eu.i.posthog.com',
};
