import { CommonModule } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../core/auth-api.service';
import { AuthStateService } from '../core/auth-state.service';

interface TokenForm {
  token: FormControl<string>;
}

@Component({
  selector: 'app-verify-email-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <header class="bg-white border-b border-stone-200">
      <div class="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <a routerLink="/" class="text-xl font-semibold text-teal-700">Tripico</a>
        @if (authState.isAuthenticated()) {
          <span class="text-sm text-stone-600">
            {{ authState.user()?.displayName }}
          </span>
        }
      </div>
    </header>

    <main class="max-w-2xl mx-auto px-4 py-12">
      <h1 class="text-3xl font-bold mb-2">Potwierdź email</h1>
      <p class="text-stone-600 mb-8">
        Potwierdzenie adresu pozwala tworzyć wycieczki i dołączać do innych.
      </p>

      @switch (state()) {
        @case ('verifying') {
          <div class="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p class="text-stone-600">Weryfikuję token…</p>
          </div>
        }
        @case ('verified') {
          <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <h2 class="text-lg font-semibold text-emerald-800 mb-1">
              Email potwierdzony ✓
            </h2>
            <p class="text-sm text-emerald-700">
              Możesz już tworzyć wycieczki i dołączać. Wyloguj się i zaloguj
              ponownie, aby odświeżyć status w aplikacji.
            </p>
            <a
              routerLink="/"
              class="inline-block mt-4 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
            >
              Wróć do listy wycieczek
            </a>
          </div>
        }
        @case ('expired') {
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 class="text-lg font-semibold text-amber-900 mb-1">
              Link wygasł
            </h2>
            <p class="text-sm text-amber-800">
              Token weryfikacyjny ma 24h ważności. Wygeneruj nowy poniżej.
            </p>
          </div>
        }
        @case ('invalid') {
          <div class="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h2 class="text-lg font-semibold text-red-800 mb-1">
              Nieprawidłowy token
            </h2>
            <p class="text-sm text-red-700">
              Skopiuj cały token z maila albo wygeneruj nowy.
            </p>
          </div>
        }
        @case ('already-verified') {
          <div class="bg-stone-50 border border-stone-200 rounded-2xl p-6">
            <p class="text-stone-700">
              Ten email jest już potwierdzony. Możesz spokojnie korzystać z konta.
            </p>
            <a
              routerLink="/"
              class="inline-block mt-4 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
            >
              Wróć do listy
            </a>
          </div>
        }
      }

      <!-- Manual token form -->
      @if (state() !== 'verified' && state() !== 'already-verified') {
        <section class="mt-8 bg-white rounded-2xl shadow-sm p-6">
          <h2 class="text-lg font-semibold mb-3">Wpisz token ręcznie</h2>
          <form [formGroup]="form" (ngSubmit)="submitManual()" class="space-y-3">
            <label class="block">
              <span class="text-sm font-medium text-stone-700">
                Token z maila
              </span>
              <input
                type="text"
                formControlName="token"
                autocomplete="off"
                class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <button
              type="submit"
              [disabled]="form.invalid || actionLoading()"
              class="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-teal-700"
            >
              Potwierdź
            </button>
          </form>
        </section>
      }

      <!-- Request new -->
      @if (authState.isAuthenticated() && state() !== 'verified') {
        <section class="mt-6 bg-white rounded-2xl shadow-sm p-6">
          <h2 class="text-lg font-semibold mb-3">Wyślij nowy link</h2>
          <p class="text-sm text-stone-600 mb-3">
            Wyślemy świeży token weryfikacyjny na adres
            <strong>{{ authState.user()?.email }}</strong>.
          </p>
          <button
            (click)="requestNew()"
            [disabled]="actionLoading()"
            class="border border-teal-600 text-teal-700 px-4 py-2 rounded-lg font-medium hover:bg-teal-50 disabled:opacity-50"
          >
            Wyślij nowy token
          </button>
          @if (devToken(); as t) {
            <div class="mt-4 p-3 bg-stone-100 rounded text-xs font-mono break-all">
              <p class="font-semibold mb-1">Dev token (zostanie zastąpione mailem):</p>
              {{ t }}
            </div>
          }
        </section>
      } @else if (!authState.isAuthenticated() && state() !== 'verified') {
        <p class="mt-6 text-sm text-stone-500 text-center">
          <a routerLink="/login" class="text-teal-600 hover:underline">
            Zaloguj się
          </a>
          , żeby wygenerować nowy token.
        </p>
      }
    </main>
  `,
})
export class VerifyEmailPage {
  readonly token = input<string | undefined>();

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiService);
  protected readonly authState = inject(AuthStateService);

  protected readonly state = signal<
    'idle' | 'verifying' | 'verified' | 'expired' | 'invalid' | 'already-verified'
  >('idle');
  protected readonly actionLoading = signal(false);
  protected readonly devToken = signal<string | null>(null);

  protected readonly form: FormGroup<TokenForm> = this.fb.nonNullable.group({
    token: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {
    this.authState.hydrateFromStorage();
    queueMicrotask(() => this.autoVerifyIfTokenInUrl());
  }

  private autoVerifyIfTokenInUrl(): void {
    const raw = this.token();
    if (!raw) return;
    this.runVerify(raw);
  }

  protected submitManual(): void {
    if (this.form.invalid) return;
    this.runVerify(this.form.controls.token.value);
  }

  private runVerify(token: string): void {
    this.state.set('verifying');
    this.actionLoading.set(true);
    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.state.set('verified');
      },
      error: (err) => {
        this.actionLoading.set(false);
        const detail = err?.error?.detail ?? '';
        if (detail === 'TOKEN_EXPIRED') {
          this.state.set('expired');
        } else if (detail === 'EMAIL_ALREADY_VERIFIED') {
          this.state.set('already-verified');
        } else {
          this.state.set('invalid');
        }
      },
    });
  }

  protected requestNew(): void {
    this.actionLoading.set(true);
    this.devToken.set(null);
    this.auth.requestVerification().subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        if (res.devToken) {
          this.devToken.set(res.devToken);
          this.form.controls.token.setValue(res.devToken);
        }
      },
      error: (err) => {
        this.actionLoading.set(false);
        const detail = err?.error?.detail ?? '';
        if (detail === 'EMAIL_ALREADY_VERIFIED') {
          this.state.set('already-verified');
        }
      },
    });
  }
}
