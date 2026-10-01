'use server';

// Herramientas show/hide (P5-5) and the Mensual/Anual toggle (P5-6).

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { HIDDEN_FROM_CUSTOMERS } from '@/lib/engines/display-names';
import { SETTING_KEYS, writeSetting } from '@/lib/config/settings';
import { adminName, adminSession } from './guard';
import { payingUsersOfTool } from './data';

export type ToolVisibilityResult =
  | { ok: true }
  | { ok: false; code: 'FORBIDDEN' | 'NOT_FOUND' | 'ERROR' }
  | { ok: false; code: 'CONFIRM_REQUIRED'; payingUsers: number };

/**
 * Show or hide a tool for customers: writes engines.status, the field the
 * whole customer catalog reads (Inicio, Más herramientas, landing, counts).
 * Hiding a tool paying users used in the last 30 days needs the second step
 * (terms §7.3 / REVISION-LEGAL M5: notice and an alternative or refund).
 */
export async function setToolVisible(slug: string, visible: boolean, confirmed = false): Promise<ToolVisibilityResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  if (HIDDEN_FROM_CUSTOMERS.has(slug)) return { ok: false, code: 'NOT_FOUND' };
  const db = createAdminClient();
  const { data: engine } = await db.from('engines').select('id, slug, status').eq('slug', slug).maybeSingle();
  if (!engine) return { ok: false, code: 'NOT_FOUND' };
  if (!visible && !confirmed) {
    const payingUsers = await payingUsersOfTool(engine.id as string);
    if (payingUsers > 0) return { ok: false, code: 'CONFIRM_REQUIRED', payingUsers };
  }
  const next = visible ? 'active' : 'coming_soon';
  const { error } = await db.from('engines').update({ status: next }).eq('id', engine.id as string);
  if (error) return { ok: false, code: 'ERROR' };
  await logAudit({
    action: 'engine.visibility',
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    targetUserId: actor.user.id,
    targetEmail: actor.user.email ?? null,
    before: { status: engine.status },
    after: { status: next },
    metadata: { slug, admin_name: adminName(actor), confirmed_used_tool: confirmed },
  });
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}

export async function setBillingToggle(enabled: boolean): Promise<{ ok: boolean }> {
  const actor = await adminSession();
  if (!actor) return { ok: false };
  const ok = await writeSetting(SETTING_KEYS.billingToggle, enabled, actor.user.id);
  if (!ok) return { ok: false };
  await logAudit({
    action: 'settings.billing_toggle',
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    targetUserId: actor.user.id,
    targetEmail: actor.user.email ?? null,
    after: { billing_toggle_enabled: enabled },
    metadata: { admin_name: adminName(actor) },
  });
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
