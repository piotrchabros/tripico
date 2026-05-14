import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { BoardModule } from '../board/board.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [PrismaModule, AuthModule, TripsModule, BoardModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
