export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  slug: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  slug: string;
  emailVerified?: boolean;
}

export interface AuthSession {
  accessToken: string;
  user: PublicUser;
}

export type TripStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'FULL'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'ARCHIVED';

export type TransportType =
  | 'CAR'
  | 'TRAIN'
  | 'BUS'
  | 'PLANE'
  | 'BIKE'
  | 'HIKING'
  | 'MIXED'
  | 'OTHER';

export type CurrencyCode = 'PLN' | 'EUR' | 'USD';

export interface TripSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  destinationCountry: string;
  destinationName: string;
  destinationLat: number | null;
  destinationLng: number | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  transport: TransportType;
  pricePerPerson: string;
  currency: CurrencyCode;
  maxMembers: number;
  currentMembers: number;
  coverImageUrl: string | null;
  galleryUrls: string[];
  status: TripStatus;
  publishedAt: string | null;
  organizerId: string;
  createdAt: string;
}

export interface ListEnvelope<T> {
  data: T[];
  meta: { hasMore: boolean; total?: number };
}

export interface TripsListQuery {
  status?: TripStatus;
  destinationCountry?: string;
  transport?: TransportType;
  startDateFrom?: string;
  startDateTo?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  limit?: number;
}

export interface CreateTripPayload {
  title: string;
  description: string;
  destinationCountry: string;
  destinationName: string;
  destinationLat?: number;
  destinationLng?: number;
  startDate: string;
  endDate: string;
  transport: TransportType;
  pricePerPerson: number;
  currency?: CurrencyCode;
  maxMembers: number;
  coverImageUrl?: string;
}

export type TripMemberRole = 'ORGANIZER' | 'MEMBER' | 'PENDING';

export interface Membership {
  id: string;
  tripId: string;
  userId: string;
  role: TripMemberRole;
  joinedAt: string | null;
  leftAt: string | null;
  requestMessage: string | null;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    slug: string;
    avatarUrl: string | null;
    isVerifiedBadge: boolean;
  };
}
