import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry as early as possible — must run BEFORE NestFactory
 * so async stack capture wraps the framework init. Silent no-op when
 * SENTRY_DSN is unset (dev / CI).
 */
export function bootstrapSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release: process.env['SENTRY_RELEASE'],
    tracesSampleRate: parseFloat(
      process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1',
    ),
    // Per AGENTS.md §1 we redact PII at the log layer; Sentry's
    // `beforeSend` is a second belt: strip Authorization headers and
    // email-looking strings from request payloads before they leave
    // the process. PII would otherwise sit in Sentry indefinitely.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
}

export { Sentry };
