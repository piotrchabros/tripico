import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Trip detail is dynamic — render per-request via SSR (no prerender list yet;
  // would need to fetch the trip catalog at build time once that's stable).
  {
    path: 'wycieczka/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
