import { CommonModule } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripSummary } from '../core/api-types';
import { TripsApiService } from '../core/trips-api.service';

@Component({
  selector: 'app-trip-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="bg-white border-b border-stone-200">
      <div class="max-w-3xl mx-auto px-4 py-4">
        <a routerLink="/" class="text-teal-700 hover:underline">← Wszystkie wycieczki</a>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-8">
      @if (loading()) {
        <p class="text-stone-500">Ładowanie…</p>
      } @else if (error()) {
        <p class="text-red-600">{{ error() }}</p>
      } @else if (trip(); as t) {
        @if (t.coverImageUrl) {
          <img
            [src]="t.coverImageUrl"
            [alt]="t.title"
            class="w-full aspect-[16/9] object-cover rounded-2xl mb-6"
          />
        }
        <h1 class="text-3xl font-bold mb-2">{{ t.title }}</h1>
        <p class="text-stone-600 mb-6">{{ t.destinationName }}</p>

        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 text-sm">
          <div>
            <dt class="text-stone-500">Termin</dt>
            <dd class="font-medium">
              {{ t.startDate | date: 'd MMM' }} – {{ t.endDate | date: 'd MMM y' }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Długość</dt>
            <dd class="font-medium">{{ t.durationDays }} dni</dd>
          </div>
          <div>
            <dt class="text-stone-500">Transport</dt>
            <dd class="font-medium">{{ t.transport }}</dd>
          </div>
          <div>
            <dt class="text-stone-500">Cena / osoba</dt>
            <dd class="font-medium text-teal-700">
              {{ t.pricePerPerson }} {{ t.currency }}
            </dd>
          </div>
          <div class="col-span-2 sm:col-span-4">
            <dt class="text-stone-500">Uczestnicy</dt>
            <dd class="font-medium">{{ t.currentMembers }} / {{ t.maxMembers }}</dd>
          </div>
        </dl>

        <section class="bg-white rounded-2xl p-6 prose prose-stone max-w-none">
          <h2 class="text-xl font-semibold mb-3">O wycieczce</h2>
          <p class="whitespace-pre-wrap">{{ t.description }}</p>
        </section>
      } @else {
        <p class="text-stone-500">Nie znaleziono wycieczki.</p>
      }
    </main>
  `,
})
export class TripDetailPage {
  readonly slug = input.required<string>();

  private readonly tripsApi = inject(TripsApiService);

  protected readonly trip = signal<TripSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.tripsApi.getBySlug(this.slug()).subscribe({
      next: (t) => {
        this.trip.set(t);
        this.loading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.detail ?? err?.message;
        this.error.set(
          detail === 'TRIP_NOT_FOUND'
            ? 'Ta wycieczka nie istnieje lub została usunięta.'
            : (detail ?? 'Nie udało się załadować wycieczki.'),
        );
        this.loading.set(false);
      },
    });
  }
}
