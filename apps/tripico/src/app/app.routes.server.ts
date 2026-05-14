import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Trip detail is dynamic — render per-request via SSR.
  {
    path: 'wycieczka/:slug',
    renderMode: RenderMode.Server,
  },
  // Create page is auth-gated — render in the browser only (auth state lives
  // in sessionStorage, not transferable to the SSR pass).
  {
    path: 'create',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
