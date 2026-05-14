import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Pages that fetch backend data run on the client until the SSR pass can
  // talk to the production backend (currently the API URL is relative for
  // browser context only — see environment.prod.ts and vercel.json
  // rewrites). SEO win to revisit once the SSR pass uses an absolute URL.
  { path: '', renderMode: RenderMode.Client },
  { path: 'wycieczka/:slug', renderMode: RenderMode.Client },
  { path: 'create', renderMode: RenderMode.Client },

  // Static auth pages still prerender — no data dependency.
  { path: '**', renderMode: RenderMode.Prerender },
];
