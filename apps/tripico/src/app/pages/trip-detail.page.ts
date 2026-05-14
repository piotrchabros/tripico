import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Membership, TripSummary } from '../core/api-types';
import { APP_ENVIRONMENT } from '../core/environment';
import { AuthStateService } from '../core/auth-state.service';
import { TripsApiService } from '../core/trips-api.service';
import { TripChatComponent } from '../components/trip-chat.component';

@Component({
  selector: 'app-trip-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TripChatComponent],
  template: `
    <header class="bg-white border-b border-stone-200">
      <div class="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <a routerLink="/" class="text-teal-700 hover:underline">
          ← Wszystkie wycieczki
        </a>
        @if (!authState.isAuthenticated()) {
          <div class="text-sm flex items-center gap-3">
            <a routerLink="/login" class="text-stone-600 hover:text-teal-600">
              Zaloguj
            </a>
            <a
              routerLink="/register"
              class="bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700"
            >
              Załóż konto
            </a>
          </div>
        }
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

        <div class="flex items-start justify-between gap-4 mb-2">
          <h1 class="text-3xl font-bold">{{ t.title }}</h1>
          <span
            class="px-3 py-1 rounded-full text-xs font-medium"
            [class]="statusBadgeClass(t.status)"
          >
            {{ statusLabel(t.status) }}
          </span>
        </div>
        <p class="text-stone-600 mb-6">{{ t.destinationName }}</p>

        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-sm">
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

        @if (t.categories?.length) {
          <div class="flex flex-wrap gap-2 mb-6">
            @for (entry of t.categories; track entry.category.id) {
              <span
                class="text-sm px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100"
                [title]="'Pewność: ' + (entry.confidence * 100 | number: '1.0-0') + '%'"
              >
                {{ entry.category.iconEmoji }} {{ entry.category.labelPl }}
              </span>
            }
          </div>
        }

        @if (mapImageUrl(t); as mapUrl) {
          <a
            [href]="'https://www.google.com/maps/search/?api=1&query=' + t.destinationLat + ',' + t.destinationLng"
            target="_blank"
            rel="noopener"
            class="block rounded-2xl overflow-hidden mb-6 border border-stone-200 hover:shadow-md transition"
          >
            <img
              [src]="mapUrl"
              [alt]="'Mapa: ' + t.destinationName"
              class="w-full h-auto"
              loading="lazy"
            />
          </a>
        }

        @if (authState.isAuthenticated()) {
          <section class="bg-white rounded-2xl p-6 mb-6">
            @switch (myRole()) {
              @case ('ORGANIZER') {
                <p class="text-sm font-medium text-teal-700 mb-3">
                  Jesteś organizatorem tej wycieczki.
                </p>
                @if (t.status === 'DRAFT') {
                  <button
                    (click)="publish(t.id)"
                    [disabled]="actionLoading()"
                    class="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    Opublikuj wycieczkę
                  </button>
                }
                @if (t.status === 'PUBLISHED' || t.status === 'FULL') {
                  <button
                    (click)="cancel(t.id)"
                    [disabled]="actionLoading()"
                    class="text-red-600 hover:underline text-sm"
                  >
                    Odwołaj wycieczkę
                  </button>
                }
              }
              @case ('MEMBER') {
                <p class="text-sm font-medium text-emerald-700 mb-3">
                  Jesteś uczestnikiem tej wycieczki.
                </p>
                <button
                  (click)="leave(t.id)"
                  [disabled]="actionLoading()"
                  class="text-stone-600 hover:text-red-600 text-sm"
                >
                  Opuść wycieczkę
                </button>
              }
              @case ('PENDING') {
                <p class="text-sm font-medium text-amber-700 mb-3">
                  Czekasz na decyzję organizatora.
                </p>
                <button
                  (click)="leave(t.id)"
                  [disabled]="actionLoading()"
                  class="text-stone-600 hover:text-red-600 text-sm"
                >
                  Wycofaj zgłoszenie
                </button>
              }
              @default {
                @if (t.status === 'PUBLISHED' && t.currentMembers < t.maxMembers) {
                  <form (ngSubmit)="join()" class="space-y-3">
                    <label class="block">
                      <span class="text-sm font-medium text-stone-700">
                        Wiadomość do organizatora (opcjonalnie)
                      </span>
                      <textarea
                        [(ngModel)]="joinMessage"
                        name="message"
                        rows="3"
                        maxlength="500"
                        placeholder="Czemu chcesz dołączyć?"
                        class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      ></textarea>
                    </label>
                    <button
                      type="submit"
                      [disabled]="actionLoading()"
                      class="bg-teal-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
                    >
                      Dołącz do wycieczki
                    </button>
                  </form>
                } @else {
                  <p class="text-stone-500 text-sm">
                    @if (t.status !== 'PUBLISHED') {
                      Ta wycieczka nie przyjmuje zgłoszeń ({{ statusLabel(t.status) }}).
                    } @else {
                      Wycieczka pełna — brak wolnych miejsc.
                    }
                  </p>
                }
              }
            }
            @if (actionError()) {
              <p class="text-sm text-red-600 mt-3">{{ actionError() }}</p>
            }
          </section>
        } @else {
          @if (t.status === 'PUBLISHED') {
            <section class="bg-teal-50 border border-teal-200 rounded-2xl p-6 mb-6 text-sm">
              <a routerLink="/login" class="font-medium text-teal-700 hover:underline">
                Zaloguj się
              </a>
              , aby dołączyć do tej wycieczki.
            </section>
          }
        }

        <section class="bg-white rounded-2xl p-6 mb-6">
          <h2 class="text-xl font-semibold mb-3">O wycieczce</h2>
          <p class="whitespace-pre-wrap text-stone-700">{{ t.description }}</p>
        </section>

        @if (myRole() === 'ORGANIZER' && pendingMemberships().length > 0) {
          <section class="bg-white rounded-2xl p-6 mb-6">
            <h2 class="text-xl font-semibold mb-3">
              Zgłoszenia ({{ pendingMemberships().length }})
            </h2>
            <ul class="divide-y divide-stone-200">
              @for (m of pendingMemberships(); track m.id) {
                <li class="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p class="font-medium">{{ m.user.displayName }}</p>
                    <p class="text-xs text-stone-500">{{ '@' + m.user.slug }}</p>
                    @if (m.requestMessage) {
                      <p class="text-sm text-stone-700 mt-1">
                        "{{ m.requestMessage }}"
                      </p>
                    }
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button
                      (click)="approve(m.id)"
                      [disabled]="actionLoading()"
                      class="bg-teal-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                    >
                      Akceptuj
                    </button>
                    <button
                      (click)="reject(m.id)"
                      [disabled]="actionLoading()"
                      class="text-stone-600 hover:text-red-600 text-sm px-3 py-1"
                    >
                      Odrzuć
                    </button>
                  </div>
                </li>
              }
            </ul>
          </section>
        }

        @if (myRole() === 'ORGANIZER' || myRole() === 'MEMBER') {
          <app-trip-chat [tripId]="t.id" class="block mb-6"></app-trip-chat>
        }

        @if (activeMembers().length > 0) {
          <section class="bg-white rounded-2xl p-6">
            <h2 class="text-xl font-semibold mb-3">
              Uczestnicy ({{ activeMembers().length }})
            </h2>
            <ul class="grid sm:grid-cols-2 gap-3">
              @for (m of activeMembers(); track m.id) {
                <li class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-sm font-medium"
                  >
                    {{ m.user.displayName.charAt(0) }}
                  </div>
                  <div>
                    <p class="font-medium text-sm">{{ m.user.displayName }}</p>
                    <p class="text-xs text-stone-500">
                      {{ m.role === 'ORGANIZER' ? 'Organizator' : 'Uczestnik' }}
                    </p>
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      } @else {
        <p class="text-stone-500">Nie znaleziono wycieczki.</p>
      }
    </main>
  `,
})
export class TripDetailPage {
  readonly slug = input.required<string>();

  private readonly tripsApi = inject(TripsApiService);
  protected readonly authState = inject(AuthStateService);

  protected readonly trip = signal<TripSummary | null>(null);
  protected readonly memberships = signal<Membership[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionLoading = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected joinMessage = '';

  protected readonly myRole = computed(() => {
    const t = this.trip();
    const user = this.authState.user();
    if (!t || !user) return null;
    if (t.organizerId === user.id) return 'ORGANIZER' as const;
    const mine = this.memberships().find(
      (m) => m.userId === user.id && !m.leftAt,
    );
    return mine?.role ?? null;
  });

  protected readonly pendingMemberships = computed(() =>
    this.memberships().filter((m) => m.role === 'PENDING' && !m.leftAt),
  );

  protected readonly activeMembers = computed(() =>
    this.memberships()
      .filter((m) => m.role !== 'PENDING' && !m.leftAt)
      .sort((a) => (a.role === 'ORGANIZER' ? -1 : 1)),
  );

  constructor() {
    this.authState.hydrateFromStorage();
    queueMicrotask(() => this.load());
  }

  protected statusLabel(status: TripSummary['status']): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected statusBadgeClass(status: TripSummary['status']): string {
    return STATUS_BADGE[status] ?? 'bg-stone-100 text-stone-700';
  }

  /**
   * Build a Mapbox Static Images API URL for the trip's destination.
   * Returns null when coordinates are missing OR the Mapbox token is
   * unset (so the block disappears entirely in dev).
   */
  protected mapImageUrl(t: TripSummary): string | null {
    const env = APP_ENVIRONMENT as { mapboxPublicToken?: string };
    const token = env.mapboxPublicToken;
    if (!token || token.startsWith('__')) return null;
    if (t.destinationLat == null || t.destinationLng == null) return null;
    const lng = t.destinationLng;
    const lat = t.destinationLat;
    const zoom = 9;
    const width = 1024;
    const height = 360;
    const marker = `pin-l+0d9488(${lng},${lat})`;
    return (
      `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/` +
      `${marker}/${lng},${lat},${zoom},0/${width}x${height}@2x` +
      `?access_token=${token}`
    );
  }

  private load(): void {
    const slug = this.slug();
    const authed = this.authState.isAuthenticated();
    this.loading.set(true);
    this.error.set(null);

    this.tripsApi.getBySlug(slug).subscribe({
      next: (t) => {
        this.trip.set(t);
        if (authed) {
          this.tripsApi.listMemberships(t.id).subscribe({
            next: (ms) => {
              this.memberships.set(ms);
              this.loading.set(false);
            },
            error: () => {
              // 403 if user has no role yet — that's normal, leave empty
              this.memberships.set([]);
              this.loading.set(false);
            },
          });
        } else {
          this.loading.set(false);
        }
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

  private refreshMemberships(): void {
    const t = this.trip();
    if (!t) return;
    this.tripsApi.listMemberships(t.id).subscribe({
      next: (ms) => this.memberships.set(ms),
      error: () => this.memberships.set([]),
    });
  }

  private refreshTrip(): void {
    const slug = this.slug();
    this.tripsApi.getBySlug(slug).subscribe({
      next: (t) => this.trip.set(t),
    });
  }

  protected join(): void {
    const t = this.trip();
    if (!t) return;
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.tripsApi.join(t.id, this.joinMessage || undefined).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.joinMessage = '';
        this.refreshMemberships();
      },
      error: (err) => this.handleActionError(err),
    });
  }

  protected leave(tripId: string): void {
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.tripsApi.leave(tripId).subscribe({
      next: () => {
        this.actionLoading.set(false);
        forkJoin([
          this.tripsApi.getBySlug(this.slug()),
          this.tripsApi.listMemberships(tripId),
        ]).subscribe({
          next: ([t, ms]) => {
            this.trip.set(t);
            this.memberships.set(ms);
          },
        });
      },
      error: (err) => this.handleActionError(err),
    });
  }

  protected approve(membershipId: string): void {
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.tripsApi.approveMembership(membershipId).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.refreshMemberships();
        this.refreshTrip();
      },
      error: (err) => this.handleActionError(err),
    });
  }

  protected reject(membershipId: string): void {
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.tripsApi.rejectMembership(membershipId).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.refreshMemberships();
      },
      error: (err) => this.handleActionError(err),
    });
  }

  protected publish(tripId: string): void {
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.tripsApi.publish(tripId).subscribe({
      next: (t) => {
        this.actionLoading.set(false);
        this.trip.set(t);
      },
      error: (err) => this.handleActionError(err),
    });
  }

  protected cancel(tripId: string): void {
    if (!window.confirm('Odwołać tę wycieczkę? Akcji nie da się cofnąć.'))
      return;
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.tripsApi.cancel(tripId).subscribe({
      next: (t) => {
        this.actionLoading.set(false);
        this.trip.set(t);
      },
      error: (err) => this.handleActionError(err),
    });
  }

  private handleActionError(err: {
    error?: { detail?: string };
    message?: string;
  }): void {
    this.actionLoading.set(false);
    const detail =
      err?.error?.detail ?? err?.message ?? 'Operacja nie powiodła się.';
    this.actionError.set(ACTION_ERROR_LABELS[detail] ?? detail);
  }
}

const STATUS_LABELS: Record<TripSummary['status'], string> = {
  DRAFT: 'Roboczy',
  PUBLISHED: 'Otwarta',
  FULL: 'Pełna',
  CANCELLED: 'Odwołana',
  COMPLETED: 'Zakończona',
  ARCHIVED: 'Archiwum',
};

const STATUS_BADGE: Record<TripSummary['status'], string> = {
  DRAFT: 'bg-stone-100 text-stone-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  FULL: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-sky-100 text-sky-700',
  ARCHIVED: 'bg-stone-100 text-stone-500',
};

const ACTION_ERROR_LABELS: Record<string, string> = {
  EMAIL_NOT_VERIFIED: 'Najpierw potwierdź email, aby brać udział.',
  ALREADY_PENDING: 'Twoje zgłoszenie już czeka na decyzję.',
  ALREADY_MEMBER: 'Już jesteś uczestnikiem tej wycieczki.',
  ALREADY_ORGANIZER: 'Jesteś organizatorem.',
  TRIP_NOT_OPEN_FOR_JOIN: 'Ta wycieczka nie przyjmuje teraz zgłoszeń.',
  TRIP_FULL: 'Wycieczka pełna.',
  ORGANIZER_CANNOT_LEAVE: 'Organizator nie może opuścić — odwołaj wycieczkę.',
  NOT_ORGANIZER: 'Tę akcję może wykonać tylko organizator.',
  NOT_PENDING: 'To zgłoszenie nie czeka już na decyzję.',
};
