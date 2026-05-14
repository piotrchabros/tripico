import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  errors?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ProblemDetails = {
      type: `https://tripico.pl/errors/${status}`,
      title:
        exception instanceof HttpException
          ? exception.name
          : 'InternalServerError',
      status,
      instance: request.url,
    };

    if (exception instanceof HttpException) {
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        body.detail = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const r = exResponse as Record<string, unknown>;
        const message = r['message'];
        if (typeof message === 'string') {
          body.detail = message;
        } else if (Array.isArray(message)) {
          body.errors = message;
        }
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // Capture 5xx in Sentry. 4xx are expected client mistakes and
      // would just be noise. No-op when SENTRY_DSN is unset.
      if (exception instanceof Error) {
        Sentry.captureException(exception);
      }
    }

    response.status(status).type('application/problem+json').json(body);
  }
}
