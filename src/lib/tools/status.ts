// tool_status (migration 0056): read by ToolErrorState for the "ya nos
// avisaron" pill, written by the health check and by failed BFF calls.
// Every read fails safe: an unknown status is "ok, no incident", so the
// app never claims an alert that didn't happen (TOOLS-SPEC §7.1, Q10).

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, getContactInbox } from '@/lib/email/resend';
import { escapeHtml } from '@/lib/email/escape';
import { toolBySlug } from '@/config/tools';
import {
  afterOwnerAlert,
  nextToolStatus,
  okStatus,
  type ToolStatusRow,
} from './bff-core';

interface Row {
  slug: string;
  state: ToolStatusRow['state'];
  down_since: string | null;
  incident_active: boolean;
  incident_since: string | null;
  alerted_at: string | null;
}

const fromRow = (r: Row): ToolStatusRow => ({
  state: r.state,
  downSince: r.down_since,
  incidentActive: r.incident_active,
  incidentSince: r.incident_since,
  alertedAt: r.alerted_at,
});

export async function getToolStatus(slug: string): Promise<ToolStatusRow> {
  try {
    const { data } = await createAdminClient()
      .from('tool_status')
      .select('slug, state, down_since, incident_active, incident_since, alerted_at')
      .eq('slug', slug)
      .maybeSingle();
    return data ? fromRow(data as Row) : okStatus();
  } catch {
    return okStatus();
  }
}

async function save(slug: string, s: ToolStatusRow, reason: string | null, nowIso: string) {
  const { error } = await createAdminClient()
    .from('tool_status')
    .upsert({
      slug,
      state: s.state,
      down_since: s.downSince,
      incident_active: s.incidentActive,
      incident_since: s.incidentSince,
      alerted_at: s.alertedAt,
      last_check_at: nowIso,
      last_reason: reason,
      updated_at: nowIso,
    });
  if (error) console.error('[tool-status] save failed', slug, error.message);
}

/** Who hears that a tool is down (Q10 default: the contact inbox). */
function ownerAlertTo(): string {
  return process.env.TOOL_ALERT_EMAIL || getContactInbox();
}

/**
 * Apply one health observation (a health check, or a failed BFF call with
 * ok=false). Sends the owner alert once the outage passes 5 minutes; only a
 * delivered alert turns incident_active on.
 */
export async function recordToolHealth(
  slug: string,
  check: { ok: boolean; latencyMs: number; reason?: string | null },
  now = new Date(),
): Promise<ToolStatusRow> {
  const nowIso = now.toISOString();
  const prev = await getToolStatus(slug);
  const decision = nextToolStatus(prev, check, nowIso);
  let next = decision.next;
  if (decision.alertOwner) {
    const name = toolBySlug(slug)?.name ?? slug;
    const sent = await sendEmail({
      to: ownerAlertTo(),
      subject: `${name} no responde desde hace más de 5 minutos`,
      html: `<p><b>${escapeHtml(name)}</b> (${escapeHtml(slug)}) no responde desde ${escapeHtml(
        next.downSince ?? nowIso,
      )}.</p><p>Último motivo: ${escapeHtml(check.reason ?? 'sin respuesta')}.</p><p>Las personas ven "Ya nos avisaron, lo estamos arreglando" mientras el incidente siga abierto en /dashboard/herramientas.</p>`,
    }).catch(() => ({ ok: false }));
    if (sent.ok) next = afterOwnerAlert(next, nowIso);
  }
  await save(slug, next, check.ok ? null : (check.reason ?? 'unknown'), nowIso);
  return next;
}

/** The owner opens or closes the incident by hand (/dashboard/herramientas). */
export async function setToolIncident(slug: string, active: boolean): Promise<void> {
  const nowIso = new Date().toISOString();
  const prev = await getToolStatus(slug);
  await save(
    slug,
    { ...prev, incidentActive: active, incidentSince: active ? (prev.incidentSince ?? nowIso) : null },
    null,
    nowIso,
  );
}
