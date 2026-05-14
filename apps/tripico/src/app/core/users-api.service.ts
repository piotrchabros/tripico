import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from './environment';
import { CategoryRef } from './api-types';

export interface PublicUserTrip {
  id: string;
  slug: string;
  title: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  currentMembers: number;
  maxMembers: number;
  pricePerPerson: string;
  currency: string;
  coverImageUrl: string | null;
  categories: { category: CategoryRef }[];
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerifiedBadge: boolean;
  createdAt: string;
  organizedTrips: PublicUserTrip[];
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_ENVIRONMENT.apiBaseUrl}/users`;

  getBySlug(slug: string): Observable<PublicUserProfile> {
    return this.http.get<PublicUserProfile>(`${this.base}/${slug}`);
  }
}
