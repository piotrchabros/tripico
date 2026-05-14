import { ErrorHandler, Provider } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { APP_ENVIRONMENT } from './environment';

interface SentryEnv {
  sentryDsn?: string;
  production?: boolean;
}

/**
 * Initialize Sentry browser SDK at module load (before Angular
 * bootstrap). Idempotent — calls more than once are no-ops in Sentry's
 * SDK. Silent skip when `sentryDsn` is empty or the placeholder.
 */
export function initSentry(): void {
  if (typeof window === 'undefined') return;
  const env = APP_ENVIRONMENT as SentryEnv;
  if (!env.sentryDsn || env.sentryDsn.startsWith('__')) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.production ? 'production' : 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

/**
 * Returns Angular providers that route uncaught component errors to
 * Sentry. Add to ApplicationConfig.providers after the env is wired.
 * No-op when DSN is missing — Angular still installs the handler but
 * captureException calls into an uninitialised Sentry are dropped.
 */
export function sentryAngularProviders(): Provider[] {
  return [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({ showDialog: false }),
    },
  ];
}
