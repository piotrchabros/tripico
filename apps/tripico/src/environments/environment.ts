/**
 * Development environment — used by `nx serve tripico` and local builds.
 * Replaced at build time with `environment.prod.ts` for production
 * (see `apps/tripico/project.json` → build → configurations.production).
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
};
