// Pure helpers for the team invite flow. Kept SDK-free so they can be tested.

import type { UserRole } from './session';

/** Roles an admin may hand out from the invite form. SUPER_ADMIN is deliberately
 *  absent: that promotion goes through changeUserRole, which checks that the
 *  caller is a SUPER_ADMIN themselves. */
export const INVITABLE_ROLES: UserRole[] = ['VIEWER', 'EDITOR', 'OPERATOR', 'ADMIN', 'CLIENT'];

export function isInvitableRole(role: string): role is UserRole {
  return (INVITABLE_ROLES as string[]).includes(role);
}

/** Minimal shape of an auth user as returned by auth.admin.listUsers(). */
export interface AuthUserLike {
  id: string;
  email?: string;
  invited_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, unknown>;
}

export interface PendingInvite {
  id: string;
  email: string;
  invitedAt: string;
  /** From user_metadata.invited_role, when the invite set it. */
  role: string | null;
}

/** Invited users who have not signed in yet, newest first. */
export function pendingInvitesFrom(users: AuthUserLike[]): PendingInvite[] {
  return users
    .filter((u) => Boolean(u.invited_at) && !u.last_sign_in_at && Boolean(u.email))
    .map((u) => ({
      id: u.id,
      email: u.email as string,
      invitedAt: u.invited_at as string,
      role:
        typeof u.user_metadata?.invited_role === 'string'
          ? (u.user_metadata.invited_role as string)
          : null,
    }))
    .sort((a, b) => (a.invitedAt < b.invitedAt ? 1 : -1));
}

/** Supabase's own message for a duplicate, mapped to something a human reads. */
export function friendlyInviteError(message: string): string {
  if (/already (been )?registered|already exists/i.test(message)) {
    return 'Ese correo ya tiene cuenta en Chalyb. Cámbiale el rol desde la tabla de arriba.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Supabase limitó el envío de correos por ahora. Inténtalo en unos minutos.';
  }
  return message;
}
