import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { BoardModule } from '../board/board.module';
import { ChatModule } from '../chat/chat.module';
import { EmailModule } from '../email/email.module';
import { HealthModule } from '../health/health.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostHogModule } from '../posthog/posthog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { buildLoggerConfig } from '../shared/logger/logger.config';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [
    LoggerModule.forRoot(buildLoggerConfig()),
    PrismaModule,
    PostHogModule,
    EmailModule,
    AuthModule,
    NotificationsModule,
    TripsModule,
    BoardModule,
    ChatModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
