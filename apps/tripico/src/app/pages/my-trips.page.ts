import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripStatus, TripSummary } from '../core/api-types';
import { AuthStateService } from '../core/auth-state.service';
import { TripsApiService } from '../core/trips-api.service';

type FilterTab = 'ALL' | TripStatus;

const TAB_LABELS: Record<FilterTab, string> = {
  ALL: 'Wszystkie',
  DRAFT: 'Robocze',
  PUBLISHED: 'Otwarte',
  FULL: 'Pełne',
  CANCELLED: 'Odwołane',
  COMPLETED: 'Zakończone',
  ARCHIVED: 'Archiwum',
};

const STATUS_BADGE: Record<TripStatus, string> = {
  DRAFT: 'bg-stone-100 text-stone-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  FULL: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-sky-100 text-sky-700',
  ARCHIVED: 'bg-stone-100 text-stone-500',
};

const STATUS_LABEL: Record<TripStatus, string> = {
  DRAFT: 'Roboczy',
  PUBLISHED: 'Otwarta',
  FULL: 'Pełna',
  CANCELLED: 'Odwołana',
  COMPLETED: 'Zakończona',
  ARCHIVED: 'Archiwum',
};

@Component({
  selector: 'app-my-trips-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="bg-white border-b border-stone-200">
      <div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <a routerLink="/" class="text-xl font-semibold text-teal-700">Tripico</a>
        <nav class="flex items-center gap-4 text-sm">
          <a routerLink="/" class="text-stone-600 hover:text-teal-600">
            Odkrywaj
          </a>
          <a
            routerLink="/create"
            class="bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700"
          >
            + Nowa wycieczka
          </a>
          <span class="text-stone-600">
            {{ authState.user()?.displayName }}
          </span>
        </nav>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold mb-2">Moje wycieczki</h1>
      <p class="text-stone-600 mb-6">
        Wszystkie wyprawy, których jesteś organizatorem.
      </p>

      <div class="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4">
        @for (tab of tabs; track tab) {
          <button
            (click)="activeTab.set(tab)"
            class="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition"
            [class]="
              activeTab() === tab
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-stone-700 border-stone-300 hover:border-teal-400'
            "
          >
            {{ tabLabels[tab] }}
            @if (tab !== 'ALL') {
              <span class="ml-1 text-xs opacity-70">
                {{ countByStatus()[tab] ?? 0 }}
              </span>
            }
          </button>
        }
      </div>

      @if (loading()) {
        <p class="text-stone-500">Ładowanie…</p>
      } @else if (error()) {
        <p class="text-red-600">{{ error() }}</p>
      } @else if (filteredTrips().length === 0) {
        <div class="bg-white rounded-2xl p-8 text-center">
          @if (trips().length === 0) {
            <p class="text-stone-600 mb-3">
              Nie organizujesz jeszcze żadnej wycieczki.
            </p>
            <a
              routerLink="/create"
              class="inline-block bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
            >
              Zorganizuj pierwszą
            </a>
          } @else {
            <p class="text-stone-500">
              Brak wycieczek w tej kategorii.
            </p>
          }
        </div>
      } @else {
        <ul class="space-y-3">
          @for (trip of filteredTrips(); track trip.id) {
            <li>
              <a
                [routerLink]="['/wycieczka', trip.slug]"
                class="bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-stone-200 p-4 flex items-center gap-4"
              >
                <div
                  class="w-20 h-20 rounded-xl bg-stone-100 shrink-0 overflow-hidden"
                >
                  @if (trip.coverImageUrl) {
                    <img
                      [src]="trip.coverImageUrl"
                      [alt]="trip.title"
                      class="w-full h-full object-cover"
                    />
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h2 class="font-semibold truncate">{{ trip.title }}</h2>
                    <span
                      class="shrink-0 text-xs px-2 py-0.5 rounded-full"
                      [class]="statusBadge[trip.status]"
                    >
                      {{ statusLabel[trip.status] }}
                    </span>
                  </div>
                  <p class="text-sm text-stone-500 truncate">
                    {{ trip.destinationName }}
                  </p>
                  <div class="flex items-center gap-4 mt-1 text-xs text-stone-600">
                    <span>
                      {{ trip.startDate | date: 'd MMM' }}
                      – {{ trip.endDate | date: 'd MMM y' }}
                    </span>
                    <span>{{ trip.currentMembers }} / {{ trip.maxMembers }} osób</span>
                    <span>{{ trip.pricePerPerson }} {{ trip.currency }}</span>
                  </div>
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </main>
  `,
})
export class MyTripsPage {
  private readonly tripsApi = inject(TripsApiService);
  protected readonly authState = inject(AuthStateService);

  protected readonly tabs: FilterTab[] = [
    'ALL',
    'DRAFT',
    'PUBLISHED',
    'FULL',
    'CANCELLED',
    'COMPLETED',
  ];
  protected readonly tabLabels = TAB_LABELS;
  protected readonly statusBadge = STATUS_BADGE;
  protected readonly statusLabel = STATUS_LABEL;

  protected readonly trips = signal<TripSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activeTab = signal<FilterTab>('ALL');

  protected readonly filteredTrips = computed(() => {
    const tab = this.activeTab();
    if (tab === 'ALL') return this.trips();
    return this.trips().filter((t) => t.status === tab);
  });

  protected readonly countByStatus = computed(() => {
    const acc: Partial<Record<TripStatus, number>> = {};
    for (const t of this.trips()) {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
    }
    return acc;
  });

  constructor() {
    this.authState.hydrateFromStorage();
    this.tripsApi.listMine({ limit: 50 }).subscribe({
      next: (envelope) => {
        this.trips.set(envelope.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.error?.detail ?? err?.message ?? 'Nie udało się załadować.',
        );
        this.loading.set(false);
      },
    });
  }
}
