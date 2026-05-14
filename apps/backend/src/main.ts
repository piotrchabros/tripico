import * as dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });

import { bootstrapSentry } from './shared/sentry/sentry.bootstrap';
bootstrapSentry();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.setGlobalPrefix('api/v1');

  app.use(helmet());
  app.use(cookieParser());

  // CORS allowlist. Production: read comma-separated origins from
  // CORS_ALLOWED_ORIGINS env var (set in Railway). Dev: localhost Angular.
  const corsOrigin = parseCorsOrigin(process.env['CORS_ALLOWED_ORIGINS']);
  app.enableCors({
    origin: corsOrigin ?? ['http://localhost:4200'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(app.get(PinoLogger)));

  const port = process.env.PORT || 3000;
  // Listen on 0.0.0.0 explicitly so the container is reachable from the
  // Railway/Vercel router, not just the loopback interface (which is the
  // NestJS default and causes 502 "Application failed to respond").
  await app.listen(port, '0.0.0.0');
  app.get(PinoLogger).log(`🚀 API running on port ${port}/api/v1`);
}

function parseCorsOrigin(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

bootstrap();
