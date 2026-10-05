'use server';

// Herramientas show/hide (P5-5), the Mensual/Anual toggle (P5-6) and the
// usage margin (docs/engines/consumption-contract.md).

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { HIDDEN_FROM_CUSTOMERS } from '@/lib/engines/display-names';
import {
  MAX_USAGE_MARGIN_PERCENT,
  SETTING_KEYS,
  packPricing,
  usageMarginPercent,
  writeSetting,
} from '@/lib/config/settings';
import { PACK_IDS, packTotals, parsePackPricing } from '@/config/pack-pricing';
import { packTermsText } from '@/lib/payments/pack-prices';
import { termsShowPrice } from '@/lib/payments/pack-checkout-core';
import { adminName, adminSession } from './guard';
import { payingUsersOfTool } from './data';
import { toolBySlug } from '@/config/tools';
import { setToolIncident } from '@/lib/tools/status';

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
export async function setToolVisible(
  slug: string,
  visible: boolean,
  confirmed = false,
): Promise<ToolVisibilityResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  if (HIDDEN_FROM_CUSTOMERS.has(slug)) return { ok: false, code: 'NOT_FOUND' };
  const db = createAdminClient();
  const { data: engine } = await db
    .from('engines')
    .select('id, slug, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!engine) return { ok: false, code: 'NOT_FOUND' };
  if (!visible && !confirmed) {
    const payingUsers = await payingUsersOfTool(engine.id as string);
    if (payingUsers > 0) return { ok: false, code: 'CONFIRM_REQUIRED', payingUsers };
  }
  const next = visible ? 'active' : 'coming_soon';
  const { error } = await db
    .from('engines')
    .update({ status: next })
    .eq('id', engine.id as string);
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

/** Open or close a tool's incident by hand (TOOLS-SPEC §1.2): while open,
 *  the tool's error screen says "Ya nos avisaron, lo estamos arreglando". */
export async function setToolIncidentAction(slug: string, active: boolean): Promise<{ ok: boolean }> {
  const actor = await adminSession();
  if (!actor || !toolBySlug(slug)) return { ok: false };
  await setToolIncident(slug, active);
  await logAudit({
    action: 'tool.incident',
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    targetUserId: actor.user.id,
    targetEmail: actor.user.email ?? null,
    after: { incident_active: active },
    metadata: { slug, admin_name: adminName(actor) },
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

/** Margin charged on top of real provider cost. Applies to usage written
 *  from now on; events already recorded keep the margin they were priced at. */
export async function setUsageMargin(percent: number): Promise<{ ok: boolean }> {
  const actor = await adminSession();
  if (!actor) return { ok: false };
  if (!Number.isInteger(percent) || percent < 0 || percent > MAX_USAGE_MARGIN_PERCENT) {
    return { ok: false };
  }
  const before = await usageMarginPercent();
  const ok = await writeSetting(SETTING_KEYS.usageMargin, percent, actor.user.id);
  if (!ok) return { ok: false };
  await logAudit({
    action: 'settings.usage_margin',
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    targetUserId: actor.user.id,
    targetEmail: actor.user.email ?? null,
    before: { usage_margin_percent: before },
    after: { usage_margin_percent: percent },
    metadata: { admin_name: adminName(actor) },
  });
  return { ok: true };
}

/**
 * Credit-pack prices (owner, 2026-10-04/05): what each pack costs and whether
 * the typed price already includes IVA or IVA is added on top. Applies to
 * purchases from now on: the store, checkout, Mercado Pago and /legal/packs
 * all read this one value. An invalid value is refused whole; nothing is
 * half-saved. `termsStale` = the published Paquetes text shows other prices,
 * so checkout stays closed until a version with these is published.
 */
export async function setPackPrices(
  input: unknown,
): Promise<{ ok: true; termsStale: boolean } | { ok: false; code: 'FORBIDDEN' | 'INVALID' | 'ERROR' }> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  const next = parsePackPricing(input);
  if (!next) return { ok: false, code: 'INVALID' };
  const before = await packPricing();
  const ok = await writeSetting(SETTING_KEYS.packPrices, next, actor.user.id);
  if (!ok) return { ok: false, code: 'ERROR' };
  const totals = packTotals(next);
  await logAudit({
    action: 'settings.pack_prices',
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    targetUserId: actor.user.id,
    targetEmail: actor.user.email ?? null,
    before: before ? { pack_prices: before, totals_cents: packTotals(before) } : null,
    after: { pack_prices: next, totals_cents: totals },
    metadata: { admin_name: adminName(actor) },
  });
  revalidatePath('/[locale]', 'layout');
  const terms = packTermsText(totals);
  const termsStale = !terms || PACK_IDS.some((id) => !termsShowPrice(terms, totals[id]));
  return { ok: true, termsStale };
}
