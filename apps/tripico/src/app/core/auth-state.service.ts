import { Injectable, computed, signal } from '@angular/core';
import { PublicUser } from './api-types';

const ACCESS_TOKEN_STORAGE_KEY = '__tripico_access';
const USER_STORAGE_KEY = '__tripico_user';

interface PersistedSession {
  accessToken: string;
  user: PublicUser;
}

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly _accessToken = signal<string | null>(null);
  private readonly _user = signal<PublicUser | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  hydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const token = window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
      const userRaw = window.sessionStorage.getItem(USER_STORAGE_KEY);
      if (token && userRaw) {
        this._accessToken.set(token);
        this._user.set(JSON.parse(userRaw) as PublicUser);
      }
    } catch {
      // ignore corrupted storage
    }
  }

  setSession(session: PersistedSession): void {
    this._accessToken.set(session.accessToken);
    this._user.set(session.user);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        ACCESS_TOKEN_STORAGE_KEY,
        session.accessToken,
      );
      window.sessionStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(session.user),
      );
    }
  }

  clear(): void {
    this._accessToken.set(null);
    this._user.set(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(USER_STORAGE_KEY);
    }
  }
}
