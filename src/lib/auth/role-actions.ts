'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { getSessionUser, isSuperAdminEmail, type UserRole } from './session';

const VALID_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EDITOR', 'VIEWER', 'CLIENT'];

export async function changeUserRole(
  targetUserId: string,
  newRole: UserRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!VALID_ROLES.includes(newRole)) {
    return { ok: false, error: 'That role does not exist.' };
  }

  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'You need to sign in first.' };
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return { ok: false, error: 'Only an ADMIN or SUPER_ADMIN can change roles.' };
  }

  // Read target with the user-scoped client (RLS allows admins to SELECT all
  // via the policy in migration 0003 — this works once the user is DB-admin).
  // If the caller is env-locked only, this read might be filtered, so we fall
  // through to the admin client as a backup.
  const supabase = await createClient();
  let target = (
    await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', targetUserId)
      .maybeSingle()
  ).data;
  if (!target) {
    const admin = createAdminClient();
    target = (
      await admin
        .from('profiles')
        .select('id, email, role')
        .eq('id', targetUserId)
        .maybeSingle()
    ).data as typeof target;
  }
  if (!target) return { ok: false, error: 'We could not find that user.' };

  // Allowlisted SUPER_ADMIN emails can't be demoted via the UI — they're forced
  // back by getSessionUser() on the next request anyway. Show an honest error.
  if (isSuperAdminEmail(target.email as string | null) && newRole !== 'SUPER_ADMIN') {
    return {
      ok: false,
      error: 'Este usuario está en SUPER_ADMIN_EMAILS — su rol se restaura solo desde la configuración.',
    };
  }

  // Only SUPER_ADMIN can promote anyone to SUPER_ADMIN.
  if (newRole === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    return { ok: false, error: 'Solo un Super Admin puede promover a Super Admin' };
  }

  // Service-role write bypasses RLS — required for env-locked admins whose
  // stored DB role doesn't grant them admin access at the Postgres level.
  const admin = createAdminClient();
  const prevRole = target.role as UserRole | undefined;

  const { data, error: updateErr } = await admin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)
    .select('id, role');

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'No se actualizó nada — revisa que el ID sea correcto.' };
  }

  // Audit log — capture the BEFORE state read above. Promotions to admin tiers
  // are the highest-risk events; a quick scan for these in the audit page
  // surfaces any unexpected privilege escalation.
  await logAudit({
    action: 'role.change',
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId,
    targetEmail: (target.email as string | null) ?? null,
    before: { role: prevRole ?? null },
    after: { role: newRole },
    metadata: { via: 'team_page' },
  });

  // See note in tier-actions.ts: needs the bracketed file path. Layout-level
  // revalidation covers /dashboard/team AND any /app/* page that reads the role.
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
