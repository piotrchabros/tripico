import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CreateTripPayload,
  CurrencyCode,
  TransportType,
} from '../core/api-types';
import { AnalyticsService } from '../core/analytics.service';
import { TripsApiService } from '../core/trips-api.service';

const TRANSPORT_OPTIONS: { value: TransportType; label: string }[] = [
  { value: 'CAR', label: 'Samochód' },
  { value: 'TRAIN', label: 'Pociąg' },
  { value: 'BUS', label: 'Autobus' },
  { value: 'PLANE', label: 'Samolot' },
  { value: 'BIKE', label: 'Rower' },
  { value: 'HIKING', label: 'Pieszo' },
  { value: 'MIXED', label: 'Mieszany' },
  { value: 'OTHER', label: 'Inny' },
];

const CURRENCY_OPTIONS: CurrencyCode[] = ['PLN', 'EUR', 'USD'];

interface CreateTripForm {
  title: FormControl<string>;
  description: FormControl<string>;
  destinationCountry: FormControl<string>;
  destinationName: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  transport: FormControl<TransportType>;
  pricePerPerson: FormControl<number>;
  currency: FormControl<CurrencyCode>;
  maxMembers: FormControl<number>;
  coverImageUrl: FormControl<string>;
}

@Component({
  selector: 'app-create-trip-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <header class="bg-white border-b border-stone-200">
      <div class="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <a routerLink="/" class="text-xl font-semibold text-teal-700">Tripico</a>
        <a routerLink="/" class="text-sm text-stone-600 hover:text-teal-600">
          Anuluj
        </a>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold mb-2">Nowa wycieczka</h1>
      <p class="text-stone-600 mb-8">
        Zaplanuj wyprawę i znajdź towarzyszy podróży. Po zapisaniu wycieczka
        jest w stanie roboczym — opublikuj ją, gdy będzie gotowa.
      </p>

      @if (emailNotVerified()) {
        <div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-6">
          <p class="font-medium">Potwierdź adres email</p>
          <p class="text-sm mt-1">
            Tworzenie wycieczek wymaga zweryfikowanego konta. Sprawdź skrzynkę
            albo wygeneruj nowy token w ustawieniach profilu.
          </p>
        </div>
      }

      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="bg-white rounded-2xl shadow-sm p-6 space-y-5"
      >
        <label class="block">
          <span class="text-sm font-medium text-stone-700">Tytuł</span>
          <input
            type="text"
            formControlName="title"
            placeholder="np. Wycieczka w Bieszczady"
            class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>

        <label class="block">
          <span class="text-sm font-medium text-stone-700">Opis</span>
          <textarea
            formControlName="description"
            rows="5"
            placeholder="Co planujesz, jaki rytm, co warto zabrać…"
            class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          ></textarea>
        </label>

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Kraj (ISO, np. PL)</span>
            <input
              type="text"
              formControlName="destinationCountry"
              maxlength="2"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Cel</span>
            <input
              type="text"
              formControlName="destinationName"
              placeholder="np. Bieszczady, PL"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Data startu</span>
            <input
              type="date"
              formControlName="startDate"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Data końca</span>
            <input
              type="date"
              formControlName="endDate"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
        </div>

        <div class="grid sm:grid-cols-3 gap-4">
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Transport</span>
            <select
              formControlName="transport"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              @for (opt of transportOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Cena / osoba</span>
            <input
              type="number"
              min="0"
              step="1"
              formControlName="pricePerPerson"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Waluta</span>
            <select
              formControlName="currency"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              @for (code of currencyOptions; track code) {
                <option [value]="code">{{ code }}</option>
              }
            </select>
          </label>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Max uczestników</span>
            <input
              type="number"
              min="2"
              max="100"
              formControlName="maxMembers"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">URL okładki (opcjonalnie)</span>
            <input
              type="url"
              formControlName="coverImageUrl"
              placeholder="https://…"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
        </div>

        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }

        <div class="flex items-center justify-end gap-3 pt-2">
          <a
            routerLink="/"
            class="px-4 py-2 rounded-lg text-stone-600 hover:bg-stone-100"
          >
            Anuluj
          </a>
          <button
            type="submit"
            [disabled]="form.invalid || loading()"
            class="px-5 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            @if (loading()) {
              Zapisywanie…
            } @else {
              Zapisz jako roboczą
            }
          </button>
        </div>
      </form>
    </main>
  `,
})
export class CreateTripPage {
  private readonly fb = inject(FormBuilder);
  private readonly tripsApi = inject(TripsApiService);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);

  protected readonly transportOptions = TRANSPORT_OPTIONS;
  protected readonly currencyOptions = CURRENCY_OPTIONS;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly emailNotVerified = signal(false);

  protected readonly form: FormGroup<CreateTripForm> =
    this.fb.nonNullable.group({
      title: [
        '',
        [Validators.required, Validators.minLength(5), Validators.maxLength(200)],
      ],
      description: [
        '',
        [Validators.required, Validators.minLength(10), Validators.maxLength(5000)],
      ],
      destinationCountry: [
        '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
      ],
      destinationName: [
        '',
        [Validators.required, Validators.maxLength(200)],
      ],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      transport: ['CAR' as TransportType, [Validators.required]],
      pricePerPerson: [
        0,
        [Validators.required, Validators.min(0), Validators.max(50000)],
      ],
      currency: ['PLN' as CurrencyCode, [Validators.required]],
      maxMembers: [
        2,
        [Validators.required, Validators.min(2), Validators.max(100)],
      ],
      coverImageUrl: [''],
    });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.emailNotVerified.set(false);

    const raw = this.form.getRawValue();
    const payload: CreateTripPayload = {
      title: raw.title,
      description: raw.description,
      destinationCountry: raw.destinationCountry.toUpperCase(),
      destinationName: raw.destinationName,
      startDate: raw.startDate,
      endDate: raw.endDate,
      transport: raw.transport,
      pricePerPerson: Number(raw.pricePerPerson),
      currency: raw.currency,
      maxMembers: Number(raw.maxMembers),
      coverImageUrl: raw.coverImageUrl?.trim() || undefined,
    };

    this.tripsApi.create(payload).subscribe({
      next: (trip) => {
        this.loading.set(false);
        this.analytics.capture('trip_created', {
          trip_id: trip.id,
          transport: trip.transport,
          duration_days: trip.durationDays,
          price_per_person: Number(trip.pricePerPerson),
          currency: trip.currency,
          max_members: trip.maxMembers,
        });
        this.router.navigate(['/wycieczka', trip.slug]);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail ?? err?.message ?? 'CREATE_FAILED';
        if (detail === 'EMAIL_NOT_VERIFIED') {
          this.emailNotVerified.set(true);
          this.error.set('Najpierw potwierdź email, aby tworzyć wycieczki.');
        } else if (Array.isArray(err?.error?.errors)) {
          this.error.set(err.error.errors.join(' · '));
        } else {
          this.error.set(detail);
        }
      },
    });
  }
}
