import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';

export const authMatchGuard: CanMatchFn = () => {
  const state = inject(AuthStateService);
  const router = inject(Router);
  state.hydrateFromStorage();
  if (state.isAuthenticated()) return true;
  return router.parseUrl('/login');
};
