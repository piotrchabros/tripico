export type SystemRole = 'USER' | 'MODERATOR' | 'ADMIN';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: SystemRole;
  isPremium: boolean;
  jti: string;
}
