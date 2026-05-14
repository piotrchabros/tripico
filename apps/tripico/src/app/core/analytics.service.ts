import { Injectable, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import posthog from 'posthog-js';
import { APP_ENVIRONMENT } from './environment';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private initialized = false;

  /**
   * Initialize PostHog client + wire router-level page_view capture +
   * keep PostHog identity in sync with our auth state. Idempotent —
   * safe to call from APP_INITIALIZER.
   */
  init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return; // SSR no-op
    const env = APP_ENVIRONMENT as {
      posthogKey?: string;
      posthogHost?: string;
    };
    if (!env.posthogKey || env.posthogKey.startsWith('__')) {
      // Empty or placeholder key — don't init, log once for visibility
      // eslint-disable-next-line no-console
      console.info('[posthog] key not configured, analytics disabled');
      this.initialized = true;
      return;
    }

    posthog.init(env.posthogKey, {
      api_host: env.posthogHost ?? 'https://eu.i.posthog.com',
      // Manual pageviews — we capture them on NavigationEnd below so
      // Angular's client routing doesn't get missed.
      capture_pageview: false,
      // Don't create anon profiles for users who never log in — keeps
      // PostHog billing tied to real signups.
      person_profiles: 'identified_only',
    });

    // Page view capture on every successful navigation
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        posthog.capture('$pageview', {
          $current_url: window.location.href,
          path: e.urlAfterRedirects,
        });
      });

    // Keep PostHog identity in sync with our signal-based auth state.
    // When user logs in, identify them; when they log out, reset so
    // subsequent events get a fresh anon id (won't capture without
    // identify thanks to person_profiles: 'identified_only').
    effect(() => {
      const user = this.authState.user();
      if (user) {
        posthog.identify(user.id, {
          email: user.email,
          display_name: user.displayName,
          slug: user.slug,
          email_verified: user.emailVerified ?? false,
        });
      } else if (this.initialized) {
        posthog.reset();
      }
    });

    this.initialized = true;
  }

  /**
   * Capture a user-action event. Silently no-ops when PostHog isn't
   * initialized (missing key, SSR, etc.) so call sites don't need to
   * guard every invocation.
   */
  capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized || typeof window === 'undefined') return;
    if (!posthog.__loaded) return;
    posthog.capture(event, properties);
  }
}
