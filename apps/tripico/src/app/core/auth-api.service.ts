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
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(AuthStateService);
  private readonly base = `${APP_ENVIRONMENT.apiBaseUrl}/auth`;

  register(payload: RegisterPayload): Observable<PublicUser> {
    return this.http.post<PublicUser>(`${this.base}/register`, payload);
  }

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${this.base}/login`, payload, {
        withCredentials: true,
      })
      .pipe(tap((session) => this.state.setSession(session)));
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
      .pipe(tap(() => this.state.clear()));
  }
}
