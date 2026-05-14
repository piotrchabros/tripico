import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripSummary } from '../core/api-types';
import { AuthStateService } from '../core/auth-state.service';
import { AuthApiService } from '../core/auth-api.service';
import { TripsApiService } from '../core/trips-api.service';

@Component({
  selector: 'app-trips-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="bg-white border-b border-stone-200">
      <div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <a routerLink="/" class="text-xl font-semibold text-teal-700">Tripico</a>
        <nav class="flex items-center gap-4 text-sm">
          @if (authState.isAuthenticated()) {
            <a
              routerLink="/me/trips"
              class="text-stone-600 hover:text-teal-600"
            >
              Moje wycieczki
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
            <button
              (click)="logout()"
              class="text-stone-500 hover:text-stone-700"
            >
              Wyloguj
            </button>
          } @else {
            <a routerLink="/login" class="text-stone-600 hover:text-teal-600">
              Zaloguj
            </a>
            <a
              routerLink="/register"
              class="bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700"
            >
              Załóż konto
            </a>
          }
        </nav>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-8">
      @if (
        authState.isAuthenticated() &&
        authState.user()?.emailVerified === false
      ) {
        <div class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start justify-between gap-3">
          <div>
            <p class="font-medium text-amber-900">Potwierdź adres email</p>
            <p class="text-sm text-amber-800 mt-0.5">
              Tworzenie wycieczek i dołączanie wymaga zweryfikowanego konta.
            </p>
          </div>
          <a
            routerLink="/verify-email"
            class="shrink-0 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700"
          >
            Potwierdź teraz
          </a>
        </div>
      }
      <h1 class="text-3xl font-bold mb-2">Wycieczki</h1>
      <p class="text-stone-600 mb-8">
        Odkrywaj wyprawy organizowane przez społeczność.
      </p>

      @if (loading()) {
        <p class="text-stone-500">Ładowanie…</p>
      } @else if (error()) {
        <p class="text-red-600">{{ error() }}</p>
      } @else if (trips().length === 0) {
        <div class="bg-white rounded-2xl p-8 text-center text-stone-500">
          Nie ma jeszcze żadnych opublikowanych wycieczek.
        </div>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          @for (trip of trips(); track trip.id) {
            <a
              [routerLink]="['/wycieczka', trip.slug]"
              class="bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden border border-stone-200"
            >
              <div class="aspect-[16/10] bg-stone-100 flex items-center justify-center text-stone-400">
                @if (trip.coverImageUrl) {
                  <img
                    [src]="trip.coverImageUrl"
                    [alt]="trip.title"
                    class="w-full h-full object-cover"
                  />
                } @else {
                  <span class="text-sm">brak zdjęcia</span>
                }
              </div>
              <div class="p-4">
                <h2 class="font-semibold mb-1 line-clamp-1">{{ trip.title }}</h2>
                @if (trip.categories?.length) {
                  <div class="flex flex-wrap gap-1 mb-2">
                    @for (entry of trip.categories.slice(0, 3); track entry.category.id) {
                      <span class="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                        {{ entry.category.iconEmoji }} {{ entry.category.labelPl }}
                      </span>
                    }
                  </div>
                }
                <p class="text-sm text-stone-500 mb-3 line-clamp-1">
                  {{ trip.destinationName }}
                </p>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-stone-600">
                    {{ trip.startDate | date: 'd MMM' }}
                    – {{ trip.endDate | date: 'd MMM y' }}
                  </span>
                  <span class="font-medium text-teal-700">
                    {{ trip.pricePerPerson }} {{ trip.currency }}
                  </span>
                </div>
                <div class="mt-2 text-xs text-stone-500">
                  {{ trip.currentMembers }} / {{ trip.maxMembers }} osób
                </div>
              </div>
            </a>
          }
        </div>
      }
    </main>
  `,
})
export class TripsListPage {
  private readonly tripsApi = inject(TripsApiService);
  private readonly authApi = inject(AuthApiService);
  protected readonly authState = inject(AuthStateService);

  protected readonly trips = signal<TripSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.authState.hydrateFromStorage();
    this.tripsApi.list({ limit: 20 }).subscribe({
      next: (envelope) => {
        this.trips.set(envelope.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Nie udało się załadować wycieczek.');
        this.loading.set(false);
      },
    });
  }

  logout(): void {
    this.authApi.logout().subscribe();
  }
}
