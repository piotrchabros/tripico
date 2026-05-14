import type { Params } from 'nestjs-pino';

/**
 * Pino setup per AGENTS.md §1: never log PII — redact email, phone,
 * passwordHash, Authorization headers. userId (UUID) is the only safe
 * identifier in logs.
 *
 * The redact paths use Pino's wildcard syntax: `*.email` catches every
 * `email` key at any nesting depth, `req.headers.authorization`
 * targets a specific HTTP context path.
 */
export function buildLoggerConfig(): Params {
  const isProd = process.env['NODE_ENV'] === 'production';
  return {
    pinoHttp: {
      level: isProd ? 'info' : 'debug',
      autoLogging: true,
      genReqId: (req) => {
        const incoming = req.headers['x-request-id'];
        return typeof incoming === 'string' ? incoming : crypto.randomUUID();
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["set-cookie"]',
          'res.headers["set-cookie"]',
          '*.email',
          '*.phone',
          '*.passwordHash',
          '*.password',
          '*.token',
          '*.refreshToken',
          '*.accessToken',
          '*.tokenHash',
          '*.passwordResetTokenHash',
          '*.emailVerificationTokenHash',
        ],
        censor: '[REDACTED]',
      },
      customLogLevel: (_req, res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,req.id,req.headers,res.headers',
              singleLine: true,
            },
          },
    },
  };
}
