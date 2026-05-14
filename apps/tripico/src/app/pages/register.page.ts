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

interface RegisterForm {
  email: FormControl<string>;
  password: FormControl<string>;
  displayName: FormControl<string>;
  slug: FormControl<string>;
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="min-h-screen flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 class="text-2xl font-semibold mb-1">Załóż konto</h1>
        <p class="text-sm text-stone-500 mb-6">Dołącz do społeczności Tripico.</p>

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
              autocomplete="new-password"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span class="text-xs text-stone-500">Min. 8 znaków.</span>
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Wyświetlana nazwa</span>
            <input
              type="text"
              formControlName="displayName"
              autocomplete="name"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Slug (URL)</span>
            <input
              type="text"
              formControlName="slug"
              placeholder="np. jan-kowalski"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span class="text-xs text-stone-500">Tylko małe litery, cyfry i myślniki.</span>
          </label>

          @if (error()) {
            <p class="text-sm text-red-600">{{ error() }}</p>
          }
          @if (success()) {
            <p class="text-sm text-emerald-600">{{ success() }}</p>
          }

          <button
            type="submit"
            [disabled]="form.invalid || loading()"
            class="w-full bg-teal-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-teal-700 transition"
          >
            @if (loading()) {
              Rejestracja…
            } @else {
              Zarejestruj się
            }
          </button>
        </form>

        <p class="text-sm text-center mt-6 text-stone-600">
          Masz już konto?
          <a routerLink="/login" class="text-teal-600 hover:underline">Zaloguj się</a>
        </p>
      </div>
    </main>
  `,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly form: FormGroup<RegisterForm> = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    displayName: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    slug: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[a-z0-9-]+$/),
      ],
    ],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.success.set('Konto utworzone — logujemy Cię…');
        this.auth
          .login({
            email: this.form.controls.email.value,
            password: this.form.controls.password.value,
          })
          .subscribe({
            next: () => {
              this.loading.set(false);
              this.router.navigateByUrl('/');
            },
            error: () => {
              this.loading.set(false);
              this.router.navigateByUrl('/login');
            },
          });
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail ?? err?.message ?? 'REGISTER_FAILED';
        if (detail === 'EMAIL_TAKEN') {
          this.error.set('Ten email jest już zajęty.');
        } else if (detail === 'SLUG_TAKEN') {
          this.error.set('Ten slug jest już zajęty.');
        } else {
          this.error.set(detail);
        }
      },
    });
  }
}
