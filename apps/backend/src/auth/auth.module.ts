import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { throttlerConfig } from '../shared/throttle/throttle.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot(throttlerConfig),
    JwtModule.registerAsync({
      useFactory: () => {
        const privateKey = process.env['JWT_PRIVATE_KEY'];
        const publicKey = process.env['JWT_PUBLIC_KEY'];
        if (!privateKey || !publicKey) {
          throw new Error(
            'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in environment',
          );
        }
        return {
          privateKey,
          publicKey,
          signOptions: {
            algorithm: 'RS256',
            expiresIn: '15m',
            issuer: 'tripico',
          },
          verifyOptions: {
            algorithms: ['RS256'],
            issuer: 'tripico',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
