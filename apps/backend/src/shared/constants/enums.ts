// Domain enum values mirrored from prisma/schema.prisma so that DTOs and
// services can validate against them without importing generated Prisma code
// (which is gitignored and not always available at test time).
// Keep these in sync with the schema — when schema enum changes, update here.

export const TRANSPORT_TYPES = [
  'CAR',
  'TRAIN',
  'BUS',
  'PLANE',
  'BIKE',
  'HIKING',
  'MIXED',
  'OTHER',
] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const TRIP_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'FULL',
  'CANCELLED',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_MEMBER_ROLES = ['ORGANIZER', 'MEMBER', 'PENDING'] as const;
export type TripMemberRole = (typeof TRIP_MEMBER_ROLES)[number];

export const CURRENCY_CODES = ['PLN', 'EUR', 'USD'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const BOARD_POST_TYPES = [
  'TEXT',
  'PHOTO',
  'VIDEO',
  'POLL',
  'MIXED',
] as const;
export type BoardPostType = (typeof BOARD_POST_TYPES)[number];
