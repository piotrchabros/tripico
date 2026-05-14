/**
 * Production environment.
 *
 * `apiBaseUrl` is RELATIVE — `/api/v1`. The frontend assumes that whatever
 * origin serves the app also proxies API requests to the backend. Concrete
 * setup on Vercel: `vercel.json` rewrites `/api/(.*)` → Railway origin.
 * This keeps the browser context same-origin (no CORS preflight, no
 * leakage of the Railway hostname into client bundles).
 *
 * If you switch to a different deployment topology (frontend + backend on
 * the same Railway service, or two-domain setup with CORS), update this
 * value AND the corresponding `enableCors` origin in `apps/backend/src/main.ts`.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  // WebSocket can't reuse the Vercel /api/* rewrite (it's HTTP-only) so
  // the gateway URL is the absolute Railway origin. Update this when the
  // backend hostname changes.
  wsBaseUrl: 'https://tripico-production.up.railway.app',
};
