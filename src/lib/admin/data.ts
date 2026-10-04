// Owner panel readers (P5). Every query here runs with the service role and
// is only called behind the admin gate. A failed read degrades to "sin
// datos" for that block (logged), never a fake zero.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { ENGINE_DISPLAY_NAMES, HIDDEN_FROM_CUSTOMERS } from '@/lib/engines/display-names';
import type { PaymentFact, SubscriptionFact } from './kpis';
import { monthWindow } from './kpis';
import { toolHealth, type AttentionCounts, type ToolHealth } from './attention';
import { personStatus, type PersonRow } from './people';
import type { ActivityEvent } from './activity';

const DAY = 86_400_000;
type Admin = ReturnType<typeof createAdminClient>;

async function safe<T>(
  label: string,
  fallback: T,
  fn: (db: Admin) => Promise<T>,
): Promise<{ data: T; failed: boolean }> {
  try {
    return { data: await fn(createAdminClient()), failed: false };
  } catch (e) {
    console.error(`[admin] ${label} failed`, e instanceof Error ? e.message : e);
    return { data: fallback, failed: true };
  }
}

function rows<T>(r: { data: unknown; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T[];
}

const SUB_COLS =
  'user_id, status, plan_key, tier, mp_preapproval_id, trial_ends_at, started_at, created_at, cancel_at_period_end, cancelled_at, grace_ends_at, access_until, charge_hold_until, reminder_due_at, reminder_delivered_at, last_charge_at';

export type SubRow = SubscriptionFact & {
  grace_ends_at: string | null;
  access_until: string | null;
  charge_hold_until: string | null;
  reminder_due_at: string | null;
  reminder_delivered_at: string | null;
  last_charge_at: string | null;
};

/** Payments since the start of the month six months back (Dinero chart). */
export function loadPayments(now = new Date()) {
  const since = monthWindow(now, -6).start.toISOString();
  return safe('payments', [] as PaymentFact[], async (db) =>
    rows<PaymentFact>(
      await db
        .from('payments')
        .select(
          'id, user_id, amount_cents, currency, status, refunded_cents, kind, plan_key, mp_preapproval_id, created_at',
        )
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000),
    ),
  );
}

export function loadSubscriptions() {
  return safe('subscriptions', [] as SubRow[], async (db) =>
    rows<SubRow>(await db.from('subscriptions').select(SUB_COLS).limit(5000)),
  );
}

export interface ToolHealthRow {
  slug: string;
  name: string;
  status: string;
  health: ToolHealth;
  failures24h: number;
}

/** Customer tools with their health (hidden internal ones left out). */
export async function loadToolHealth(
  now = new Date(),
): Promise<{ data: ToolHealthRow[]; failed: boolean }> {
  return safe('tool health', [] as ToolHealthRow[], async (db) => {
    const engines = rows<{
      id: string;
      slug: string;
      name: string;
      status: string;
      engine_health: { state: string }[] | null;
    }>(await db.from('engines').select('id, slug, name, status, engine_health(state)'));
    const failures = rows<{ metadata: { tool?: string } | null }>(
      await db
        .from('audit_events')
        .select('metadata')
        .eq('action', 'clips.job_failed')
        .gte('created_at', new Date(now.getTime() - DAY).toISOString())
        .limit(1000),
    );
    const failuresBySlug = new Map<string, number>();
    for (const f of failures) {
      const slug = f.metadata?.tool ?? 'chalybclip';
      failuresBySlug.set(slug, (failuresBySlug.get(slug) ?? 0) + 1);
    }
    return engines
      .filter((e) => !HIDDEN_FROM_CUSTOMERS.has(e.slug))
      .map((e) => {
        const failures24h = failuresBySlug.get(e.slug) ?? 0;
        return {
          slug: e.slug,
          name: ENGINE_DISPLAY_NAMES[e.slug] ?? e.name,
          status: e.status,
          health: toolHealth({ engineState: e.engine_health?.[0]?.state ?? null, failures24h }),
          failures24h,
        };
      });
  });
}

export async function loadAttention(
  subs: readonly SubRow[],
  tools: readonly ToolHealthRow[],
  now = new Date(),
) {
  const t = now.getTime();
  const since30 = new Date(t - 30 * DAY).toISOString();
  return safe('attention', null as AttentionCounts | null, async (db) => {
    const soon = new Date(t + 5 * DAY).toISOString();
    const [cobro, ideas, bounced, arco, takedowns] = await Promise.all([
      db
        .from('partner_inquiries')
        .select('id', { count: 'exact', head: true })
        .ilike('message', '[cobro]%')
        .is('read_at_admin', null),
      db
        .from('partner_inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('pane', 'idea')
        .is('read_at_admin', null),
      db
        .from('email_dispatches')
        .select('user_id')
        .not('bounced_at', 'is', null)
        .gte('sent_at', since30)
        .limit(1000),
      db
        .from('arco_requests')
        .select('id', { count: 'exact', head: true })
        .is('responded_at', null)
        .lte('respond_by', soon),
      db
        .from('takedown_notices')
        .select('id', { count: 'exact', head: true })
        .in('status', ['received', 'counter_noticed']),
    ]);
    for (const r of [cobro, ideas, bounced]) if (r.error) throw new Error(r.error.message);
    const bouncedUsers = new Set(
      ((bounced.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
    );
    for (const s of subs)
      if (s.charge_hold_until && Date.parse(s.charge_hold_until) > t) bouncedUsers.add(s.user_id);
    return {
      failedCharges: subs.filter(
        (s) => s.status === 'paused' || (s.grace_ends_at && Date.parse(s.grace_ends_at) > t),
      ).length,
      refundRequests: cobro.count ?? 0,
      slowTools: tools.filter((x) => x.status === 'active' && x.health !== 'ok').length,
      newIdeas: ideas.count ?? 0,
      bouncedNotices: bouncedUsers.size,
      // Legal (0055); before the migration runs these read as 0.
      arcoDue: arco.error ? 0 : (arco.count ?? 0),
      takedownsOpen: takedowns.error ? 0 : (takedowns.count ?? 0),
      // Charged after the notice was due without it ever being delivered
      // (terms §7.3: refundable).
      chargesWithoutNotice: subs.filter(
        (s) =>
          s.last_charge_at &&
          s.reminder_due_at &&
          !s.reminder_delivered_at &&
          Date.parse(s.reminder_due_at) < Date.parse(s.last_charge_at) &&
          Date.parse(s.last_charge_at) > t - 60 * DAY,
      ).length,
    };
  });
}

export interface PeopleData {
  people: PersonRow[];
  /** Last settled charge per user: the refundable one. */
  lastCharge: Map<string, { paymentId: string; cents: number; mpPaymentId: string | null }>;
}

export async function loadPeople(now = new Date()) {
  return safe('people', { people: [], lastCharge: new Map() } as PeopleData, async (db) => {
    const [profiles, subs, pays] = await Promise.all([
      db
        .from('profiles')
        .select('id, email, full_name, role, tier, created_at')
        .order('created_at', { ascending: false })
        .limit(2000),
      db
        .from('subscriptions')
        .select(SUB_COLS)
        .order('created_at', { ascending: false })
        .limit(5000),
      db
        .from('payments')
        .select(
          'id, user_id, amount_cents, currency, status, refunded_cents, mp_payment_id, created_at',
        )
        .in('status', ['approved', 'accredited', 'processed'])
        .order('created_at', { ascending: false })
        .limit(5000),
    ]);
    const prof = rows<{
      id: string;
      email: string | null;
      full_name: string | null;
      role: string;
      tier: string;
      created_at: string;
    }>(profiles);
    const subByUser = new Map<string, SubRow>();
    for (const s of rows<SubRow>(subs)) if (!subByUser.has(s.user_id)) subByUser.set(s.user_id, s);
    const lastCharge: PeopleData['lastCharge'] = new Map();
    for (const p of rows<{
      id: string;
      user_id: string;
      amount_cents: number;
      refunded_cents: number | null;
      mp_payment_id: string | null;
    }>(pays)) {
      if (lastCharge.has(p.user_id)) continue;
      const left = p.amount_cents - (p.refunded_cents ?? 0);
      if (left > 0)
        lastCharge.set(p.user_id, { paymentId: p.id, cents: left, mpPaymentId: p.mp_payment_id });
    }
    const t = now.getTime();
    const people: PersonRow[] = prof
      .filter((p) => p.role !== 'ADMIN' && p.role !== 'SUPER_ADMIN')
      .map((p) => {
        const sub = subByUser.get(p.id) ?? null;
        return {
          id: p.id,
          name: p.full_name || (p.email ?? '').split('@')[0] || '—',
          email: p.email ?? '',
          plan:
            p.tier === 'VIP' ? 'VIP' : p.tier === 'PRO' || p.tier === 'PARTNER' ? 'Pro' : 'Gratis',
          status: personStatus(sub, t),
          since: sub?.started_at ?? sub?.created_at ?? p.created_at ?? '',
          sub,
        };
      });
    return { people, lastCharge };
  });
}

/** Paying users who used this tool in the last 30 days (hide warning). */
export async function payingUsersOfTool(engineId: string, now = new Date()): Promise<number> {
  const { data } = await safe('tool usage', 0, async (db) => {
    const used = rows<{ user_id: string }>(
      await db
        .from('usage_events')
        .select('user_id')
        .eq('engine_id', engineId)
        .gte('created_at', new Date(now.getTime() - 30 * DAY).toISOString())
        .limit(5000),
    );
    const ids = [...new Set(used.map((u) => u.user_id))];
    if (!ids.length) return 0;
    const paying = rows<{ id: string }>(
      await db.from('profiles').select('id').in('id', ids).in('tier', ['PRO', 'VIP', 'PARTNER']),
    );
    return paying.length;
  });
  return data;
}

// ── Actividad ─────────────────────────────────────────────────────────
const AUDIT_TITLES: Record<string, string> = {
  'admin.gift_month': 'Regaló 1 mes gratis',
  'admin.plan_offer': 'Envió un cambio de plan para aceptar',
  'admin.access_email': 'Reenvió el correo de acceso',
  'admin.refund': 'Reembolsó el último cobro',
  'admin.dispute': 'Registró un paso de una disputa',
  'admin.cancel': 'Canceló la suscripción',
  'engine.visibility': 'Cambió la visibilidad de una herramienta',
  'settings.billing_toggle': 'Cambió Mensual/Anual',
  'tier.change': 'Cambió un plan o una herramienta',
  'role.change': 'Cambió un rol',
  'tokens.grant': 'Regaló créditos',
  'tokens.revoke': 'Quitó créditos',
  'team.invite': 'Invitó a alguien',
};

const CONSENT_TITLES: Record<string, string> = {
  trial_started: 'Aceptó la prueba gratis',
  subscription_started: 'Aceptó el cobro recurrente',
  plan_changed: 'Aceptó un cambio de plan',
  risk_ack_accepted: 'Aceptó el aviso de riesgo',
  financial_data_consent: 'Autorizó datos financieros',
  automation_rule_activated: 'Activó una regla de Inversiones',
  autopublish_enabled: 'Activó publicación automática',
  voice_likeness_consent: 'Aceptó el uso de voz/imagen',
  signup_terms_accepted: 'Aceptó términos al registrarse',
  refund_issued: 'Reembolso registrado',
  chargeback_opened: 'Abrió una disputa (la cuenta no cambia)',
  chargeback_triaged: 'Disputa revisada',
  chargeback_evidence_submitted: 'Paquete de evidencia generado',
  chargeback_resolved: 'Disputa resuelta por Mercado Pago',
  chargeback_notice_sent: 'Aviso de 10 días hábiles enviado',
  chargeback_response_received: 'Respondió al aviso de la disputa',
  chargeback_bad_faith_decided: 'Decisión escrita sobre la disputa',
  account_restricted: 'Funciones de pago suspendidas',
  account_closed: 'Cuenta cerrada',
  prepayment_required: 'Pago por adelantado requerido',
};

export async function loadActivity(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  return safe('activity', [] as ActivityEvent[][], async (db) => {
    const [audit, pays, cancels, bounces, consents, profiles] = await Promise.all([
      db
        .from('audit_events')
        .select('id, action, actor_email, target_email, metadata, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300),
      db
        .from('payments')
        .select(
          'id, user_id, amount_cents, currency, status, refunded_cents, kind, plan_key, created_at',
        )
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300),
      db
        .from('cancellation_events')
        .select('folio_cancelacion, user_id, requested_at')
        .gte('requested_at', since)
        .limit(300),
      db
        .from('email_dispatches')
        .select('id, user_id, kind, bounced_at')
        .not('bounced_at', 'is', null)
        .gte('sent_at', since)
        .limit(300),
      db
        .from('consent_events')
        .select('consent_id, user_id, event_type, inserted_at')
        .gte('inserted_at', since)
        .order('inserted_at', { ascending: false })
        .limit(300),
      db.from('profiles').select('id, email').limit(5000),
    ]);
    const emails = new Map(
      rows<{ id: string; email: string | null }>(profiles).map((p) => [p.id, p.email]),
    );
    const who = (id: string | null) => (id ? (emails.get(id) ?? null) : null);
    const money = (c: number) =>
      `$${(c / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

    const auditEvents: ActivityEvent[] = rows<{
      id: string;
      action: string;
      actor_email: string | null;
      target_email: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>(audit).map((a) =>
      a.action === 'clips.job_failed'
        ? {
            id: `a:${a.id}`,
            at: a.created_at,
            type: 'tool',
            tool: 'chalybclip',
            title: 'Clips falló',
            detail: String(a.metadata?.reason ?? ''),
            who: a.target_email,
          }
        : {
            id: `a:${a.id}`,
            at: a.created_at,
            type: 'admin',
            tool: typeof a.metadata?.slug === 'string' ? (a.metadata.slug as string) : null,
            title: AUDIT_TITLES[a.action] ?? a.action,
            detail: a.target_email,
            who: a.actor_email,
          },
    );
    const payEvents: ActivityEvent[] = rows<PaymentFact>(pays).map((p) => {
      const refunded = (p.refunded_cents ?? 0) > 0 || p.status === 'refunded';
      const failed = p.status === 'rejected';
      return {
        id: `p:${p.id}`,
        at: p.created_at,
        type: refunded ? 'refund' : failed ? 'failed' : 'charge',
        tool: null,
        title: refunded ? 'Reembolso' : failed ? 'Cobro fallido' : 'Cobro',
        detail: `${money(p.amount_cents ?? 0)} · ${p.plan_key ?? p.kind ?? ''}`.trim(),
        who: who(p.user_id),
      };
    });
    const cancelEvents: ActivityEvent[] = rows<{
      folio_cancelacion: string;
      user_id: string;
      requested_at: string;
    }>(cancels).map((c) => ({
      id: `c:${c.folio_cancelacion}`,
      at: c.requested_at,
      type: 'cancel',
      tool: null,
      title: 'Canceló su plan',
      detail: `Folio ${c.folio_cancelacion}`,
      who: who(c.user_id),
    }));
    const bounceEvents: ActivityEvent[] = rows<{
      id: string;
      user_id: string;
      kind: string;
      bounced_at: string;
    }>(bounces).map((b) => ({
      id: `b:${b.id}`,
      at: b.bounced_at,
      type: 'notice',
      tool: null,
      title: 'Un aviso de cobro rebotó',
      detail: `${b.kind} · el cobro espera 5 días después de un aviso entregado`,
      who: who(b.user_id),
    }));
    const consentEvents: ActivityEvent[] = rows<{
      consent_id: string;
      user_id: string;
      event_type: string;
      inserted_at: string;
    }>(consents).map((c) => ({
      id: `k:${c.consent_id}`,
      at: c.inserted_at,
      type: 'consent',
      tool: null,
      title: CONSENT_TITLES[c.event_type] ?? c.event_type,
      detail: `Folio ${c.consent_id.slice(0, 8)}`,
      who: who(c.user_id),
    }));
    return [auditEvents, payEvents, cancelEvents, bounceEvents, consentEvents];
  });
}

// ── Disputas (WS-8) ───────────────────────────────────────────────────
export interface DisputeRow {
  id: string;
  user_id: string;
  person: string;
  mp_payment_id: string;
  amount_cents: number;
  charged_at: string | null;
  opened_at: string;
  triage: string | null;
  triage_reason: string | null;
  resolution: string | null;
  evidence_sha256: string | null;
  notice_sent_at: string | null;
  deadline_utc: string | null;
  response_accepted: boolean | null;
  paid_at: string | null;
  decision: string | null;
}

export async function loadDisputes() {
  return safe('disputes', [] as DisputeRow[], async (db) => {
    const list = rows<Omit<DisputeRow, 'person'>>(
      await db
        .from('chargebacks')
        .select(
          'id, user_id, mp_payment_id, amount_cents, charged_at, opened_at, triage, triage_reason, resolution, evidence_sha256, notice_sent_at, deadline_utc, response_accepted, paid_at, decision',
        )
        .order('opened_at', { ascending: false })
        .limit(100),
    );
    const ids = [...new Set(list.map((c) => c.user_id))];
    const people = ids.length
      ? rows<{ id: string; email: string | null; full_name: string | null }>(
          await db.from('profiles').select('id, email, full_name').in('id', ids),
        )
      : [];
    const names = new Map(people.map((p) => [p.id, p.full_name || p.email || p.id]));
    return list.map((c) => ({ ...c, person: names.get(c.user_id) ?? c.user_id }));
  });
}
