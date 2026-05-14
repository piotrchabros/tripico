import { Route } from '@angular/router';
import { authMatchGuard } from './core/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/trips-list.page').then((m) => m.TripsListPage),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'create',
    canMatch: [authMatchGuard],
    loadComponent: () =>
      import('./pages/create-trip.page').then((m) => m.CreateTripPage),
  },
  {
    path: 'wycieczka/:slug',
    loadComponent: () =>
      import('./pages/trip-detail.page').then((m) => m.TripDetailPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
