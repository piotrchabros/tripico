import { CommonModule } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PublicUserProfile,
  UsersApiService,
} from '../core/users-api.service';

@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="bg-white border-b border-stone-200">
      <div class="max-w-3xl mx-auto px-4 py-4">
        <a routerLink="/" class="text-teal-700 hover:underline">
          ← Wszystkie wycieczki
        </a>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-8">
      @if (loading()) {
        <p class="text-stone-500">Ładowanie…</p>
      } @else if (error()) {
        <p class="text-red-600">{{ error() }}</p>
      } @else if (user(); as u) {
        <section class="bg-white rounded-2xl shadow-sm p-6 mb-6 flex items-start gap-4">
          <div class="w-20 h-20 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-2xl font-medium shrink-0">
            @if (u.avatarUrl) {
              <img
                [src]="u.avatarUrl"
                [alt]="u.displayName"
                class="w-full h-full rounded-full object-cover"
              />
            } @else {
              {{ u.displayName.charAt(0) }}
            }
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h1 class="text-2xl font-bold truncate">{{ u.displayName }}</h1>
              @if (u.isVerifiedBadge) {
                <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  ✓ Zweryfikowany
                </span>
              }
            </div>
            <p class="text-sm text-stone-500">{{ '@' + u.slug }}</p>
            @if (u.bio) {
              <p class="text-stone-700 mt-3 whitespace-pre-wrap">{{ u.bio }}</p>
            }
            <p class="text-xs text-stone-400 mt-3">
              Na Tripico od {{ u.createdAt | date: 'MMMM y' }}
            </p>
          </div>
        </section>

        <h2 class="text-xl font-semibold mb-3">
          Wycieczki organizowane przez {{ u.displayName }}
          ({{ u.organizedTrips.length }})
        </h2>

        @if (u.organizedTrips.length === 0) {
          <div class="bg-white rounded-2xl p-8 text-center text-stone-500">
            Brak aktywnych wycieczek.
          </div>
        } @else {
          <ul class="space-y-3">
            @for (trip of u.organizedTrips; track trip.id) {
              <li>
                <a
                  [routerLink]="['/wycieczka', trip.slug]"
                  class="bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-stone-200 p-4 flex items-center gap-4"
                >
                  <div class="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden shrink-0">
                    @if (trip.coverImageUrl) {
                      <img
                        [src]="trip.coverImageUrl"
                        [alt]="trip.title"
                        class="w-full h-full object-cover"
                      />
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold truncate">{{ trip.title }}</h3>
                    <p class="text-sm text-stone-500 truncate">
                      {{ trip.destinationName }}
                    </p>
                    @if (trip.categories?.length) {
                      <div class="flex gap-1 mt-1">
                        @for (entry of trip.categories.slice(0, 3); track entry.category.id) {
                          <span class="text-xs text-stone-600">
                            {{ entry.category.iconEmoji }}
                          </span>
                        }
                      </div>
                    }
                  </div>
                  <div class="text-right text-sm shrink-0">
                    <p class="text-stone-700">
                      {{ trip.startDate | date: 'd MMM y' }}
                    </p>
                    <p class="text-teal-700 font-medium">
                      {{ trip.pricePerPerson }} {{ trip.currency }}
                    </p>
                  </div>
                </a>
              </li>
            }
          </ul>
        }
      }
    </main>
  `,
})
export class UserProfilePage {
  readonly slug = input.required<string>();

  private readonly usersApi = inject(UsersApiService);
  protected readonly user = signal<PublicUserProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    queueMicrotask(() => {
      this.usersApi.getBySlug(this.slug()).subscribe({
        next: (u) => {
          this.user.set(u);
          this.loading.set(false);
        },
        error: (err) => {
          const detail = err?.error?.detail ?? err?.message;
          this.error.set(
            detail === 'USER_NOT_FOUND'
              ? 'Ten użytkownik nie istnieje.'
              : (detail ?? 'Nie udało się załadować profilu.'),
          );
          this.loading.set(false);
        },
      });
    });
  }
}
