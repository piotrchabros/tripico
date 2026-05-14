import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../core/auth-api.service';

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="min-h-screen flex items-center justify-center px-4">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 class="text-2xl font-semibold mb-1">Zaloguj się</h1>
        <p class="text-sm text-stone-500 mb-6">Witaj z powrotem w Tripico.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Email</span>
            <input
              type="email"
              formControlName="email"
              autocomplete="email"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Hasło</span>
            <input
              type="password"
              formControlName="password"
              autocomplete="current-password"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>

          @if (error()) {
            <p class="text-sm text-red-600">{{ error() }}</p>
          }

          <button
            type="submit"
            [disabled]="form.invalid || loading()"
            class="w-full bg-teal-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-teal-700 transition"
          >
            @if (loading()) {
              Logowanie…
            } @else {
              Zaloguj się
            }
          </button>
        </form>

        <p class="text-sm text-center mt-6 text-stone-600">
          Nie masz konta?
          <a routerLink="/register" class="text-teal-600 hover:underline">Zarejestruj się</a>
        </p>
      </div>
    </main>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form: FormGroup<LoginForm> = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail ?? err?.message ?? 'LOGIN_FAILED';
        this.error.set(
          detail === 'INVALID_CREDENTIALS'
            ? 'Nieprawidłowy email lub hasło.'
            : detail,
        );
      },
    });
  }
}
