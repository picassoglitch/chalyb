'use server';

// Team invites from /dashboard/team.
//
// A real invite, end to end: Supabase Auth creates the user and sends the
// "Invite user" email (through the custom SMTP → Resend relay described in
// docs/email/supabase-auth-setup.md, so it arrives as Chalyb). The link in that
// template lands on /auth/callback with a token_hash, which the route verifies
// server-side and turns into a session. The new user's profile row is created
// by the auth.users trigger; we then set the role the admin chose.
//
// Service-role client on purpose: creating auth users and writing `role` are
// both privileged (migration 0032 keeps `role` off the user-writable columns).

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { getSessionUser, type UserRole } from './session';
import { friendlyInviteError, isInvitableRole } from './invites';

export interface InviteResult {
  ok: boolean;
  error?: string;
}

export async function inviteTeamMember(input: {
  email: string;
  role: UserRole;
}): Promise<InviteResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Inicia sesión para continuar.' };
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return { ok: false, error: 'Solo un Admin o Super Admin puede invitar.' };
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Correo inválido.' };
  }
  if (!isInvitableRole(input.role)) {
    return { ok: false, error: 'Ese rol no se puede asignar desde una invitación.' };
  }
  const role = input.role;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      // Lands in auth.users.raw_user_meta_data. The template can show
      // invited_by; pendingInvitesFrom() reads invited_role for the list.
      data: { invited_by: session.user.email ?? null, invited_role: role },
    });
    if (error || !data.user) {
      return { ok: false, error: friendlyInviteError(error?.message ?? 'No se pudo invitar.') };
    }
    const invitedId = data.user.id;

    // The trigger just created the profile as VIEWER; apply the chosen role.
    // Best-effort: the invite email is already out, and a role can always be
    // fixed from the team table.
    if (role !== 'VIEWER') {
      const { error: roleErr } = await admin.from('profiles').update({ role }).eq('id', invitedId);
      if (roleErr) {
        console.error('[invite] role write failed after invite', roleErr);
        await logAudit({
          action: 'team.invite',
          actorId: session.user.id,
          actorEmail: session.user.email ?? null,
          targetUserId: invitedId,
          targetEmail: email,
          after: { role: 'VIEWER' },
          metadata: { via: 'team_page', requested_role: role, role_write_failed: roleErr.message },
        });
        revalidatePath('/[locale]', 'layout');
        return {
          ok: false,
          error: `La invitación salió, pero el rol quedó en Viewer (${roleErr.message}). Ajústalo en la tabla.`,
        };
      }
    }

    await logAudit({
      action: 'team.invite',
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      targetUserId: invitedId,
      targetEmail: email,
      after: { role },
      metadata: { via: 'team_page' },
    });

    // The invited profile now appears in the team table.
    revalidatePath('/[locale]', 'layout');
    return { ok: true };
  } catch (err) {
    console.error('[invite] threw', err);
    const message = err instanceof Error ? err.message : 'No se pudo enviar la invitación.';
    return { ok: false, error: friendlyInviteError(message) };
  }
}
