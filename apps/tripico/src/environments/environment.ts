/**
 * Development environment — used by `nx serve tripico` and local builds.
 * Replaced at build time with `environment.prod.ts` for production
 * (see `apps/tripico/project.json` → build → configurations.production).
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
  wsBaseUrl: 'http://localhost:3000',
  // Empty key disables PostHog locally. Drop your dev project's
  // `phc_...` here if you want to send events from `nx serve`.
  posthogKey: '',
  posthogHost: 'https://eu.i.posthog.com',
  // Empty disables Sentry locally — matches PostHog pattern.
  sentryDsn: '',
  // Mapbox public access token (pk.ey...). Empty = map block hidden
  // on trip detail. Drop a token here for local map preview.
  mapboxPublicToken: '',
};
