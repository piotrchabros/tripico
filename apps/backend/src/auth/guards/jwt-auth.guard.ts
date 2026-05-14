import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser, SystemRole } from '../types/authenticated-user';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: SystemRole;
  isPremium: boolean;
  emailVerified: boolean;
  jti: string;
  iat: number;
  exp: number;
  iss: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const token = authHeader.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        isPremium: payload.isPremium,
        emailVerified: payload.emailVerified,
        jti: payload.jti,
      };
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
  }
}
