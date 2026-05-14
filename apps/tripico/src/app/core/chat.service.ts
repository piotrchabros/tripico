import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import {
  AckResponse,
  ChatHistoryEnvelope,
  ChatMessage,
} from './chat-types';
import { APP_ENVIRONMENT } from './environment';
import { AuthStateService } from './auth-state.service';

/**
 * Resolves the Socket.io target.
 * - Browser-side prod: `apiBaseUrl` is `/api/v1` (Vercel rewrite handles
 *   HTTP, but WebSocket can't reuse the rewrite, so we need the absolute
 *   backend URL). Configured via `wsBaseUrl` on env.
 * - Dev: same-host `http://localhost:3000`.
 */
function resolveWsBase(): string {
  const env = APP_ENVIRONMENT as { wsBaseUrl?: string; apiBaseUrl: string };
  if (env.wsBaseUrl) return env.wsBaseUrl;
  // dev fallback: trim /api/v1 from apiBaseUrl
  return env.apiBaseUrl.replace(/\/api\/v1$/, '');
}

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);

  private socket: Socket | null = null;
  private currentTripId: string | null = null;

  readonly connected = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly error = signal<string | null>(null);

  loadHistory(tripId: string): Observable<ChatHistoryEnvelope> {
    return this.http.get<ChatHistoryEnvelope>(
      `${APP_ENVIRONMENT.apiBaseUrl}/trips/${tripId}/messages?limit=50`,
    );
  }

  /**
   * Open a Socket.io connection (lazy — only when the first chat UI mounts).
   * The handshake `auth.token` is read straight from AuthStateService and
   * verified by the backend gateway. Existing socket is reused if a second
   * trip-detail page mounts for the same tab.
   */
  connect(): void {
    if (this.socket?.connected) return;
    const token = this.authState.accessToken();
    if (!token) {
      this.error.set('UNAUTHENTICATED');
      return;
    }

    this.socket?.removeAllListeners();
    this.socket?.disconnect();

    const url = `${resolveWsBase()}/chat`;
    this.socket = io(url, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      this.connected.set(true);
      this.error.set(null);
      if (this.currentTripId) {
        this.joinTrip(this.currentTripId);
      }
    });
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('connect_error', (err: Error) => {
      this.error.set(err.message || 'WS_CONNECT_FAILED');
    });
    this.socket.on('message_created', (msg: ChatMessage) => {
      if (msg.channelId && this.currentTripId) {
        this.messages.update((m) => [...m, msg]);
      }
    });
  }

  joinTrip(tripId: string): void {
    this.currentTripId = tripId;
    this.messages.set([]);
    if (!this.socket?.connected) {
      this.connect();
      return;
    }
    this.socket.emit('join_trip', { tripId }, (ack: AckResponse) => {
      if (!ack.ok) this.error.set(ack.code ?? 'JOIN_FAILED');
    });
  }

  leaveTrip(): void {
    const id = this.currentTripId;
    this.currentTripId = null;
    this.messages.set([]);
    if (id && this.socket?.connected) {
      this.socket.emit('leave_trip', { tripId: id });
    }
  }

  sendMessage(text: string): Promise<ChatMessage | null> {
    return new Promise((resolve) => {
      if (!this.socket?.connected || !this.currentTripId) {
        resolve(null);
        return;
      }
      this.socket.emit(
        'send_message',
        { tripId: this.currentTripId, text },
        (ack: AckResponse) => {
          if (ack.ok && ack.message) {
            // Server will also broadcast — but emitter relies on broadcast
            // delivery to its own socket. Already appended via listener.
            resolve(ack.message);
          } else {
            this.error.set(ack.code ?? 'SEND_FAILED');
            resolve(null);
          }
        },
      );
    });
  }

  hydrate(history: ChatMessage[]): void {
    // history comes back newest-first from REST; the chat view shows
    // oldest-first so flip on the way in
    this.messages.set([...history].reverse());
  }

  disconnect(): void {
    this.leaveTrip();
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
