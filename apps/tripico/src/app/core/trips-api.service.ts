import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ListEnvelope,
  TripSummary,
  TripsListQuery,
} from './api-types';
import { APP_ENVIRONMENT } from './environment';

@Injectable({ providedIn: 'root' })
export class TripsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_ENVIRONMENT.apiBaseUrl}/trips`;

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
}
