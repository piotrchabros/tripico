import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateTripPayload,
  ListEnvelope,
  Membership,
  TripSummary,
  TripsListQuery,
} from './api-types';
import { APP_ENVIRONMENT } from './environment';

@Injectable({ providedIn: 'root' })
export class TripsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_ENVIRONMENT.apiBaseUrl}/trips`;
  private readonly membershipsBase = `${APP_ENVIRONMENT.apiBaseUrl}/memberships`;

  list(query: TripsListQuery = {}): Observable<ListEnvelope<TripSummary>> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return this.http.get<ListEnvelope<TripSummary>>(this.base, { params });
  }

  getBySlug(slug: string): Observable<TripSummary> {
    return this.http.get<TripSummary>(`${this.base}/${slug}`);
  }

  create(payload: CreateTripPayload): Observable<TripSummary> {
    return this.http.post<TripSummary>(this.base, payload);
  }

  publish(id: string): Observable<TripSummary> {
    return this.http.post<TripSummary>(`${this.base}/${id}/publish`, null);
  }

  cancel(id: string): Observable<TripSummary> {
    return this.http.post<TripSummary>(`${this.base}/${id}/cancel`, null);
  }

  join(
    tripId: string,
    requestMessage?: string,
  ): Observable<Membership> {
    return this.http.post<Membership>(`${this.base}/${tripId}/join`, {
      requestMessage,
    });
  }

  leave(tripId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${tripId}/leave`, null);
  }

  listMemberships(tripId: string): Observable<Membership[]> {
    return this.http.get<Membership[]>(`${this.base}/${tripId}/memberships`);
  }

  approveMembership(membershipId: string): Observable<Membership> {
    return this.http.post<Membership>(
      `${this.membershipsBase}/${membershipId}/approve`,
      null,
    );
  }

  rejectMembership(membershipId: string): Observable<void> {
    return this.http.post<void>(
      `${this.membershipsBase}/${membershipId}/reject`,
      null,
    );
  }
}
