import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SystemRole } from '../auth/types/authenticated-user';
import { ChatService } from './chat.service';

interface SocketUser {
  id: string;
  email: string;
  role: SystemRole;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: SystemRole;
  isPremium: boolean;
  jti: string;
  iat: number;
  exp: number;
  iss: string;
}

interface JoinTripPayload {
  tripId: string;
}

interface SendMessagePayload {
  tripId: string;
  text: string;
}

function tripRoom(tripId: string): string {
  return `trip:${tripId}`;
}

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      const user: SocketUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      client.data.user = user;
      this.logger.debug(`socket connected: ${client.id} user=${user.id}`);
    } catch {
      client.emit('error', { code: 'INVALID_TOKEN' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_trip')
  async onJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinTripPayload,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) return { ok: false, code: 'UNAUTHENTICATED' };
    if (!payload?.tripId) return { ok: false, code: 'TRIP_ID_REQUIRED' };

    const allowed = await this.chat.canParticipate(payload.tripId, user.id);
    if (!allowed) return { ok: false, code: 'NOT_TRIP_PARTICIPANT' };

    await client.join(tripRoom(payload.tripId));
    return { ok: true };
  }

  @SubscribeMessage('leave_trip')
  async onLeaveTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinTripPayload,
  ) {
    if (!payload?.tripId) return { ok: false, code: 'TRIP_ID_REQUIRED' };
    await client.leave(tripRoom(payload.tripId));
    return { ok: true };
  }

  @SubscribeMessage('send_message')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) return { ok: false, code: 'UNAUTHENTICATED' };
    if (!payload?.tripId || !payload?.text) {
      return { ok: false, code: 'INVALID_PAYLOAD' };
    }

    try {
      const message = await this.chat.sendMessage(
        payload.tripId,
        user.id,
        payload.text,
      );
      this.server.to(tripRoom(payload.tripId)).emit('message_created', message);
      return { ok: true, message };
    } catch (err) {
      const code =
        (err as { message?: string })?.message ?? 'SEND_FAILED';
      return { ok: false, code };
    }
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = (client.handshake.auth as { token?: string } | undefined)
      ?.token;
    if (fromAuth) return fromAuth;
    const fromQuery = client.handshake.query?.['token'];
    if (typeof fromQuery === 'string') return fromQuery;
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return undefined;
  }
}
