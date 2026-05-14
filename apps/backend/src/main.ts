import * as dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.use(cookieParser());

  // CORS: allow the local Angular dev server + Vercel preview pattern in prod.
  // Production hardening (allowlist via env, tighter methods/headers) tracked
  // in docs/security.md.
  app.enableCors({
    origin:
      process.env['NODE_ENV'] === 'production'
        ? [/\.tripico\.pl$/, /-tripico\.vercel\.app$/]
        : ['http://localhost:4200'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 API running on http://localhost:${port}/api/v1`);
}

bootstrap();
