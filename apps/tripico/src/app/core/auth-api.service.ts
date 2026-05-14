import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  AuthSession,
  LoginPayload,
  PublicUser,
  RegisterPayload,
} from './api-types';
import { APP_ENVIRONMENT } from './environment';
import { AnalyticsService } from './analytics.service';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(AuthStateService);
  private readonly analytics = inject(AnalyticsService);
  private readonly base = `${APP_ENVIRONMENT.apiBaseUrl}/auth`;

  register(payload: RegisterPayload): Observable<PublicUser> {
    return this.http
      .post<PublicUser>(`${this.base}/register`, payload)
      .pipe(
        tap((user) =>
          this.analytics.capture('user_registered', { user_id: user.id }),
        ),
      );
  }

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${this.base}/login`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((session) => {
          this.state.setSession(session);
          this.analytics.capture('user_logged_in', {
            user_id: session.user.id,
          });
        }),
      );
  }

  refresh(): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${this.base}/refresh`, null, {
        withCredentials: true,
      })
      .pipe(tap((session) => this.state.setSession(session)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.base}/logout`, null, { withCredentials: true })
      .pipe(
        tap(() => {
          this.analytics.capture('user_logged_out');
          this.state.clear();
        }),
      );
  }

  requestVerification(): Observable<{ sent: boolean; expiresAt?: string; devToken?: string }> {
    return this.http.post<{ sent: boolean; expiresAt?: string; devToken?: string }>(
      `${this.base}/request-verification`,
      null,
    );
  }

  verifyEmail(token: string): Observable<{ verified: boolean }> {
    return this.http.post<{ verified: boolean }>(`${this.base}/verify-email`, {
      token,
    });
  }
}
