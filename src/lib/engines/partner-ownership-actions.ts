'use server';

// Admin-only: assign / unassign which engine a partner owns.
//
// The owned engine is the partner's "always-live" slot — separate from
// the selected_engine_id PRO mechanic. Setting it adds a partial-unique
// constraint hit (one partner = one engine), so this action is "set"
// rather than "create". Clearing it (engineId = null) detaches the
// ownership without deleting the engine row itself.
//
// Audit: every change is logged so the partner program has a paper trail.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';

interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function setPartnerOwnedEngine(
  targetUserId: string,
  engineId: string | null,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins pueden asignar engine propio' };
  }
  if (!targetUserId) return { ok: false, error: 'Usuario inválido' };

  const admin = createAdminClient();

  // Step 1: detach any existing engine pointing at this user (so we never
  // leave two engines owned by the same partner if the assignment changes).
  const { error: clearError } = await admin
    .from('engines')
    .update({ owner_user_id: null })
    .eq('owner_user_id', targetUserId);
  if (clearError) {
    return { ok: false, error: `clear failed: ${clearError.message}` };
  }

  // Step 2: if a new engine was provided, set it as owned. If null, we're
  // done — they just unassigned ownership.
  let newEngineSlug: string | null = null;
  if (engineId) {
    const { data, error } = await admin
      .from('engines')
      .update({ owner_user_id: targetUserId })
      .eq('id', engineId)
      .select('id, slug')
      .maybeSingle();
    if (error) {
      return { ok: false, error: `assign failed: ${error.message}` };
    }
    if (!data) return { ok: false, error: 'Engine no encontrado' };
    newEngineSlug = (data.slug as string) ?? null;
  }

  // Best-effort audit. logAudit swallows its own DB errors.
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', targetUserId)
    .maybeSingle();
  await logAudit({
    action: 'partner.engine_assign',
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId,
    targetEmail: (targetProfile?.email as string | null) ?? null,
    before: {}, // we cleared anyway; previous engine_id is in the audit timeline
    after: { engine_id: engineId, engine_slug: newEngineSlug },
    metadata: { via: 'team_page' },
  });

  // Both the team page (admin) and the partner's /app surfaces depend on
  // the engine row's owner_user_id. Layout-level revalidate keeps both
  // groups fresh.
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
