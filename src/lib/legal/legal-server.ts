// Legal leftovers of the old P6, the server part: ARCO requests (Aviso de
// privacidad §5), copyright notice-and-takedown with re-upload blocking and
// the repeat-infringer count (Uso aceptable §5), the ≥30-day Terms-change
// email (aceptacion-ux §8) and the 72-month retention purge (Aviso §9.1).
// The pure rules live in arco.ts, takedown.ts and terms-change.ts.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/lib/auth/session';
import { recordConsent, requestContext, UI_VERSION } from '@/lib/billing/consent';
import { addMxBusinessDays } from '@/lib/billing/disputes';
import { formatFechaLarga } from '@/lib/billing/format';
import { getContactInbox, sendEmail } from '@/lib/email/resend';
import { escapeHtml } from '@/lib/email/escape';
import { wrap } from '@/lib/email/templates';
import { addUserNotice, noticeText } from '@/lib/notifications/user';
import { logAudit } from '@/lib/audit/log';
import { legalPublished } from '@/lib/config/flags';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { canonicalOrigin } from '@/lib/site';
import { legalDocuments } from './documents';
import {
  currentVersion,
  legalPath,
  noticeRequired,
  versionMeta,
  versionSlug,
  type LegalDoc,
} from './registry';
import {
  ARCO_DAILY_LIMIT,
  arcoAnswerEmail,
  arcoEffectiveBy,
  arcoError,
  arcoRespondBy,
  type ArcoInput,
  type ArcoOutcome,
} from './arco';
import {
  COUNTER_NOTICE_BUSINESS_DAYS,
  contentFingerprint,
  normalizeContentUrl,
  counterNoticeOutcome,
  isRepeatInfringer,
  strikeCount,
  takedownMissing,
  takedownTooLong,
  type TakedownInput,
} from './takedown';
import {
  TERMS_CHANGE_NOTICE_DAYS,
  inForceFrom,
  noticeIsLate,
  termsChangeDecision,
  termsChangeEmail,
  termsChangePeriodKey,
} from './terms-change';
import { claimNoticeDispatch, finishNoticeDispatch } from './notice-dispatch';
import { removalDoneText, removalPlan } from './removal-plan';
import { REACCEPT_DOCS, type ReacceptDoc } from './reaccept';

/** Where ARCO requests and copyright notices land. TODO(owner): Law's
 *  [CORREO DE PRIVACIDAD] and [CORREO DE DERECHOS DE AUTOR]; until set, the
 *  contact inbox. */
function privacyInbox(): string {
  return process.env.LEGAL_PRIVACY_EMAIL?.trim() || getContactInbox();
}
function copyrightInbox(): string {
  return process.env.LEGAL_COPYRIGHT_EMAIL?.trim() || getContactInbox();
}

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// ── ARCO ────────────────────────────────────────────────────────────────

export async function submitArco(
  session: SessionUser,
  input: ArcoInput,
  locale: string,
): Promise<{ ok: true; respondBy: string } | { ok: false; code: string }> {
  const err = arcoError(input);
  if (err) return { ok: false, code: err };
  const email = session.user.email ?? '';
  const received = new Date();
  const respondBy = arcoRespondBy(received);
  const db = createAdminClient();
  const { data: limit } = await db.rpc('check_contact_rate_limit', {
    p_ip: `arco:${session.user.id}`,
    p_window_seconds: 86_400,
    p_max_attempts: ARCO_DAILY_LIMIT,
  });
  if (limit && (limit as { allowed?: boolean }).allowed === false)
    return { ok: false, code: 'rateLimited' };
  const { data, error } = await db
    .from('arco_requests')
    .insert({
      user_id: session.user.id,
      right_kind: input.right,
      description: input.description.trim(),
      data_location: input.dataLocation?.trim() || null,
      correct_value: input.correctValue?.trim() || null,
      contact_email: email,
      received_at: received.toISOString(),
      respond_by: respondBy.toISOString(),
    })
    .select('id')
    .single();
  if (error) {
    console.error('[arco] insert failed', error.message);
    return { ok: false, code: 'db' };
  }
  // The evidence keeps the right and the folio, never the person's own
  // words (those stay in arco_requests, which is deletable).
  const ctx = await requestContext();
  const consent = await recordConsent({
    event_type: 'arco_request_received',
    user_id: session.user.id,
    account_email: email,
    documents: legalDocuments('privacidad'),
    client_timezone: null,
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
    locale: locale === 'es' ? 'es-MX' : 'en',
    surface: 'arco_form',
    ui_version: UI_VERSION,
    disclosure_text: `Solicitud ARCO (${input.right}) · folio ${String(data.id)}`,
    checkbox_text: null,
    checkbox_checked: null,
    button_label: null,
    plan_id: null,
    amount_mxn: null,
    currency: null,
    tax_included: null,
    billing_interval: null,
    trial_end_utc: null,
    charge_date_utc: null,
    reminder_date_utc: respondBy.toISOString(),
    payment_method: null,
    marketing_opt_in: false,
    details: { right: input.right, request_id: data.id },
  });
  await db.from('arco_requests').update({ consent_id: consent.consent_id }).eq('id', data.id);
  const fecha = formatFechaLarga(respondBy, 'es');
  await sendEmail({
    to: privacyInbox(),
    subject: `Solicitud ARCO (${input.right}): responder antes del ${fecha}`,
    html: wrap({
      title: 'Solicitud ARCO',
      preview: `Responder antes del ${fecha}`,
      body: [
        `<p>Cuenta: ${escapeHtml(email)}</p>`,
        `<p>Derecho: <b>${escapeHtml(input.right)}</b></p>`,
        `<p>${escapeHtml(input.description.trim())}</p>`,
        input.correctValue ? `<p>Dato correcto: ${escapeHtml(input.correctValue)}</p>` : '',
        `<p>Plazo legal (Aviso §5.3): responder antes del <b>${escapeHtml(fecha)}</b>. Folio ${escapeHtml(String(data.id))}.</p>`,
      ].join(''),
    }),
    replyTo: email || undefined,
  });
  await addUserNotice({
    userId: session.user.id,
    kind: 'arcoReceived',
    ...(await noticeText('arcoReceived', { fecha: formatFechaLarga(respondBy, locale) }, locale)),
    href: '/app/settings/arco',
    dedupeKey: `arco:${data.id}`,
  }).catch(() => {});
  void logAudit({
    action: 'legal.arco',
    actorId: session.user.id,
    targetUserId: session.user.id,
    metadata: { id: data.id, right: input.right },
  });
  return { ok: true, respondBy: respondBy.toISOString() };
}

/** Admin: record the answer, then deliver it (email + in-app) and keep the
 *  dispatch as evidence (7a review of #49, MEDIUM 7). */
/** Email one ARCO answer through a claimed dispatch (arco_answer). Used by
 *  the answer itself and by the cron's retry of failed sends. */
async function deliverArcoAnswer(
  db: ReturnType<typeof createAdminClient>,
  row: {
    id: string;
    user_id: string;
    contact_email: string;
    right_kind: string;
    outcome: ArcoOutcome;
    effective_by: string | null;
  },
): Promise<'sent' | 'failed' | 'skipped'> {
  const claimed = await claimNoticeDispatch(db, {
    userId: row.user_id,
    kind: 'arco_answer',
    periodKey: `arco:${row.id}`,
    templateId: 'arco_answer',
    templateVersion: '1',
  }).catch(() => null);
  if (!claimed) return 'skipped';
  const mail = arcoAnswerEmail({
    folio: row.id.slice(0, 8),
    right: row.right_kind,
    outcome: row.outcome,
    effectiveBy: row.effective_by ? formatFechaLarga(row.effective_by, 'es') : null,
  });
  const res = await sendEmail({
    to: row.contact_email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: privacyInbox(),
  });
  return finishNoticeDispatch(db, claimed, res);
}

/** Admin: record the answer, then deliver it (email + in-app) and keep the
 *  dispatch as evidence (7a review of #49, MEDIUM 7). A failed email is
 *  retried by the daily cron (runArcoAnswerRetries). */
export async function answerArco(
  id: string,
  outcome: ArcoOutcome,
  actorId: string,
): Promise<boolean> {
  const now = new Date();
  const effectiveBy =
    outcome === 'granted' || outcome === 'partially_granted' ? arcoEffectiveBy(now) : null;
  const db = createAdminClient();
  const { data, error } = await db
    .from('arco_requests')
    .update({
      responded_at: now.toISOString(),
      outcome,
      effective_by: effectiveBy?.toISOString() ?? null,
    })
    .eq('id', id)
    .is('responded_at', null)
    .select('user_id, contact_email, right_kind')
    .maybeSingle();
  if (error || !data) return false;
  await deliverArcoAnswer(db, {
    id,
    user_id: data.user_id as string,
    contact_email: data.contact_email as string,
    right_kind: data.right_kind as string,
    outcome,
    effective_by: effectiveBy?.toISOString() ?? null,
  });
  await addUserNotice({
    userId: data.user_id as string,
    kind: 'arcoAnswered',
    ...(await noticeText('arcoAnswered', { folio: id.slice(0, 8) })),
    href: '/app/settings/arco',
    dedupeKey: `arco-answer:${id}`,
  }).catch(() => {});
  void logAudit({
    action: 'legal.arco',
    actorId,
    targetUserId: data.user_id as string,
    metadata: { id, outcome },
  });
  return true;
}

/** Cron: resend ARCO answers whose email failed or was interrupted
 *  (claim_notice_dispatch gives up after 5 attempts / 72 h). */
export async function runArcoAnswerRetries(): Promise<{ resent: number; failed: number }> {
  const db = createAdminClient();
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await db
    .from('email_dispatches')
    .select('period_key')
    .eq('kind', 'arco_answer')
    .or(`delivery_status.eq.failed,and(delivery_status.eq.pending,sent_at.lt.${stale})`)
    .limit(100);
  const out = { resent: 0, failed: 0 };
  for (const d of (data ?? []) as { period_key: string }[]) {
    const id = d.period_key.replace(/^arco:/, '');
    const { data: row } = await db
      .from('arco_requests')
      .select('id, user_id, contact_email, right_kind, outcome, effective_by')
      .eq('id', id)
      .not('responded_at', 'is', null)
      .maybeSingle();
    if (!row) continue;
    const r = await deliverArcoAnswer(db, row as Parameters<typeof deliverArcoAnswer>[1]);
    if (r === 'sent') out.resent += 1;
    else if (r === 'failed') out.failed += 1;
  }
  return out;
}

/** Admin: the one extension Aviso §5.3 allows, only on an open request
 *  that isn't extended and isn't overdue. */
export async function extendArco(id: string, actorId: string): Promise<boolean> {
  const db = createAdminClient();
  const now = new Date();
  const { data: row } = await db
    .from('arco_requests')
    .select('received_at')
    .eq('id', id)
    .maybeSingle();
  if (!row) return false;
  const { data } = await db
    .from('arco_requests')
    .update({
      extended_at: now.toISOString(),
      respond_by: arcoRespondBy(new Date(row.received_at as string), true).toISOString(),
    })
    .eq('id', id)
    .is('responded_at', null)
    .is('extended_at', null)
    .gte('respond_by', now.toISOString())
    .select('user_id')
    .maybeSingle();
  if (!data) return false;
  void logAudit({
    action: 'legal.arco',
    actorId,
    targetUserId: data.user_id as string,
    metadata: { id, extended: true },
  });
  return true;
}

// ── Copyright notice-and-takedown ──────────────────────────────────────

export async function submitTakedown(
  input: TakedownInput,
): Promise<{ ok: true; id: string } | { ok: false; code: string; fields?: string[] }> {
  const missing = takedownMissing(input);
  if (missing.length) return { ok: false, code: 'missing', fields: missing };
  if (takedownTooLong(input)) return { ok: false, code: 'tooLong' };
  const { data, error } = await createAdminClient()
    .from('takedown_notices')
    .insert({
      claimant_name: input.claimantName.trim(),
      claimant_contact: input.claimantContact.trim(),
      content_identification: input.contentIdentification.trim(),
      right_statement: input.rightStatement.trim(),
      content_location: input.contentLocation.trim(),
      work_description: input.workDescription?.trim() || null,
      ownership_evidence: input.ownershipEvidence?.trim() || null,
      declared_truthful: input.declaredTruthful === true,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[takedown] insert failed', error.message);
    return { ok: false, code: 'db' };
  }
  await sendEmail({
    to: copyrightInbox(),
    subject: `Aviso de derechos de autor recibido (folio ${String(data.id).slice(0, 8)})`,
    html: wrap({
      title: 'Aviso de derechos de autor',
      preview: 'Retirar de manera expedita (Uso aceptable §5.2)',
      body: [
        `<p>Titular: ${escapeHtml(input.claimantName)} · ${escapeHtml(input.claimantContact)}</p>`,
        `<p>Contenido: ${escapeHtml(input.contentIdentification)}</p>`,
        `<p>Ubicación: ${escapeHtml(input.contentLocation)}</p>`,
        `<p>Derecho: ${escapeHtml(input.rightStatement)}</p>`,
        `<p>Resolver en el panel: Dueño → Legal.</p>`,
      ].join(''),
    }),
  });
  return { ok: true, id: data.id as string };
}

/** Admin, step 1 of a removal: the uploader's account (exact email) and
 *  their clip jobs, each with the normalized source the block would use, so
 *  the admin picks the exact source instead of trusting the notice's text. */
export async function lookupTakedownTarget(email: string): Promise<
  | {
      ok: true;
      userId: string;
      /** null: the hub can't list this person's jobs (no Clips adapter in
       *  production); the admin pastes the exact link instead. */
      jobs:
        | { id: string; sourceUrl: string; normalized: string | null; createdAt: string }[]
        | null;
    }
  | { ok: false; code: 'user' }
> {
  const { data: prof } = await createAdminClient()
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (!prof) return { ok: false, code: 'user' };
  const adapter = getClipsAdapter();
  const jobs = adapter ? await adapter.listJobs(prof.id as string, 200).catch(() => null) : null;
  return {
    ok: true,
    userId: prof.id as string,
    jobs:
      jobs?.map((j) => ({
        id: j.id,
        sourceUrl: j.sourceUrl,
        normalized: normalizeContentUrl(j.sourceUrl),
        createdAt: j.createdAt,
      })) ?? null,
  };
}

/** The normalized form of a source, shown to the admin before confirming. */
export function previewSource(url: string): string | null {
  return normalizeContentUrl(url);
}

/**
 * Admin: remove (Uso aceptable §5.2). The exact source must normalize and
 * match at least one of the uploader's jobs. Every job of theirs with that
 * fingerprint is hidden (content_removals: Mis resultados, the job page,
 * downloads and sharing in Chalyb), the source is blocked for re-upload,
 * and the uploader is told exactly that.
 */
export async function removeTakedown(
  id: string,
  input: { targetEmail: string; sourceUrl: string },
  actor: { id: string; name: string },
): Promise<
  | { ok: true; repeat: boolean; hidden: number; engineMustRemove: boolean; normalized: string }
  | { ok: false; code: string }
> {
  if (input.sourceUrl.trim().length > 2000) return { ok: false, code: 'tooLong' };
  const normalized = normalizeContentUrl(input.sourceUrl);
  const fp = contentFingerprint(input.sourceUrl);
  if (!normalized || !fp) return { ok: false, code: 'source' };
  const db = createAdminClient();
  const target = await lookupTakedownTarget(input.targetEmail);
  if (!target.ok) return { ok: false, code: 'user' };
  // What the hub can hide depends on whether it sees the jobs; the block
  // and the notice go ahead either way (removal-plan.ts).
  const plan = removalPlan(
    target.jobs?.map((j) => ({ id: j.id, fingerprint: contentFingerprint(j.sourceUrl) })) ?? null,
    fp,
  );
  const now = new Date().toISOString();
  // Only a notice still waiting can be removed; read it before writing.
  const { data: pendingNotice } = await db
    .from('takedown_notices')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (!pendingNotice || pendingNotice.status !== 'received') return { ok: false, code: 'state' };
  // 1. The effects first, idempotent: a failure leaves the notice
  //    'received', so the admin can simply retry (7a review of #53).
  if (plan.hideJobIds.length) {
    const { error } = await db.from('content_removals').upsert(
      plan.hideJobIds.map((job) => ({
        takedown_id: id,
        user_id: target.userId,
        job_id: job,
        removed_at: now,
        restored_at: null,
      })),
    );
    if (error) {
      // Never tell the uploader something is hidden when it isn't.
      console.error('[takedown] hiding jobs failed', error.message);
      return { ok: false, code: 'db' };
    }
  }
  const { error: blockErr } = await db
    .from('blocked_content')
    .upsert({ fingerprint: fp, kind: 'url', source: normalized, takedown_id: id, lifted_at: null });
  if (blockErr) {
    console.error('[takedown] blocking failed', blockErr.message);
    return { ok: false, code: 'db' };
  }
  // 2. Then the state change, guarded: only one click wins.
  const { data: n } = await db
    .from('takedown_notices')
    .update({
      status: 'removed',
      target_user_id: target.userId,
      removed_at: now,
      removed_by: actor.name,
      source_url: input.sourceUrl.trim(),
      source_fingerprint: fp,
      removed_job_count: plan.hideJobIds.length,
    })
    .eq('id', id)
    .eq('status', 'received')
    .select('id, content_identification, right_statement')
    .maybeSingle();
  // Someone else moved it first (two admins, a double click): stop. The
  // upserts above were the same rows, so nothing is doubled.
  if (!n) return { ok: false, code: 'state' };

  const { data: prof } = await db
    .from('profiles')
    .select('email')
    .eq('id', target.userId)
    .maybeSingle();
  await addUserNotice({
    userId: target.userId,
    kind: 'contentRemoved',
    ...(await noticeText('contentRemoved', {
      contenido: String(n.content_identification).slice(0, 120),
    })),
    href: '/uso-aceptable#5-3-contra-aviso',
    dedupeKey: `takedown:${id}`,
  }).catch(() => {});
  if (prof?.email) {
    const mailed = await sendEmail({
      to: prof.email as string,
      subject: 'Retiramos contenido por un aviso de derechos de autor',
      html: wrap({
        title: 'Contenido retirado',
        preview: 'Puedes enviar un contra-aviso si fue un error.',
        body: [
          `<p>Recibimos un aviso de derechos de autor sobre este contenido (Política de Uso Aceptable §5.2):</p>`,
          `<p><b>${escapeHtml(n.content_identification as string)}</b><br/>${escapeHtml(normalized)}</p>`,
          `<p>Motivo que nos indicaron: ${escapeHtml(n.right_statement as string)}</p>`,
          `<p>Lo que hicimos: ${escapeHtml(removalDoneText(plan))}</p>`,
          `<p>Si crees que fue un error, responde a este correo con tu <b>contra-aviso</b>: demuestra la titularidad o la autorización que tienes para ese uso, o justifica el uso conforme a la Ley Federal del Derecho de Autor (§5.3). Si procede, quitamos el bloqueo y volvemos a mostrar tus clips.</p>`,
        ].join(''),
      }),
      replyTo: copyrightInbox(),
    });
    // 3. Notified only once the email actually went out.
    if (mailed.ok)
      await db
        .from('takedown_notices')
        .update({ user_notified_at: new Date().toISOString() })
        .eq('id', id);
  }
  const { data: history } = await db
    .from('takedown_notices')
    .select('status, removed_at')
    .eq('target_user_id', target.userId);
  const repeat = isRepeatInfringer(
    strikeCount((history ?? []) as { status: string; removed_at: string | null }[], new Date()),
  );
  void logAudit({
    action: 'legal.takedown',
    actorId: actor.id,
    targetUserId: target.userId,
    metadata: {
      id,
      step: 'removed',
      fingerprint: fp,
      hidden_jobs: plan.hideJobIds,
      engine_must_remove: plan.engineMustRemove,
    },
  });
  if (repeat)
    void logAudit({
      action: 'legal.repeat_infringer',
      actorId: actor.id,
      targetUserId: target.userId,
      metadata: { id },
    });
  return {
    ok: true,
    repeat,
    hidden: plan.hideJobIds.length,
    engineMustRemove: plan.engineMustRemove,
    normalized,
  };
}

/** Admin: the uploader's counter-notice (§5.3). The claimant has 15
 *  business days to show a proceeding; otherwise the cron restores. */
export async function recordCounterNotice(
  id: string,
  text: string,
  actorId: string,
): Promise<boolean> {
  const db = createAdminClient();
  const { data: n } = await db
    .from('takedown_notices')
    .select('status, claimant_contact, target_user_id')
    .eq('id', id)
    .maybeSingle();
  if (!n || n.status !== 'removed' || !text.trim()) return false;
  const now = new Date();
  const deadline = addMxBusinessDays(now, COUNTER_NOTICE_BUSINESS_DAYS);
  const { data: moved, error } = await db
    .from('takedown_notices')
    .update({
      status: 'counter_noticed',
      counter_notice: text.trim().slice(0, 8000),
      counter_noticed_at: now.toISOString(),
      claimant_deadline: deadline.toISOString(),
    })
    .eq('id', id)
    .eq('status', 'removed')
    .select('id')
    .maybeSingle();
  // Another admin got there first: stop (no second email).
  if (error || !moved) return false;
  if (looksLikeEmail(n.claimant_contact as string)) {
    await sendEmail({
      to: (n.claimant_contact as string).trim(),
      subject: 'Recibimos un contra-aviso sobre tu aviso de derechos de autor',
      html: wrap({
        title: 'Contra-aviso',
        preview: `Plazo: ${formatFechaLarga(deadline, 'es')}`,
        body: [
          `<p>La persona que subió el contenido envió un contra-aviso:</p>`,
          `<blockquote>${escapeHtml(text.trim())}</blockquote>`,
          `<p>Restableceremos el contenido salvo que nos acredites haber iniciado un procedimiento judicial o administrativo, una denuncia penal o un mecanismo alterno de solución de controversias a más tardar el <b>${escapeHtml(formatFechaLarga(deadline, 'es'))}</b> (15 días hábiles; Política de Uso Aceptable §5.3).</p>`,
        ].join(''),
      }),
      replyTo: copyrightInbox(),
    });
  }
  void logAudit({
    action: 'legal.takedown',
    actorId,
    targetUserId: (n.target_user_id as string | null) ?? actorId,
    metadata: { id, step: 'counter_noticed', deadline: deadline.toISOString() },
  });
  return true;
}

/** Admin: the claimant showed a proceeding in time; the removal stands. */
export async function upholdTakedown(id: string, actorId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('takedown_notices')
    .update({ status: 'upheld', claimant_proceeding_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'counter_noticed')
    .select('target_user_id')
    .maybeSingle();
  if (error || !data) return false;
  void logAudit({
    action: 'legal.takedown',
    actorId,
    targetUserId: (data.target_user_id as string | null) ?? actorId,
    metadata: { id, step: 'upheld' },
  });
  return true;
}

/** Admin: the notice lacks a minimum field or isn't about our content. */
export async function rejectTakedown(
  id: string,
  reason: string,
  actorId: string,
): Promise<boolean> {
  const { error, data } = await createAdminClient()
    .from('takedown_notices')
    .update({ status: 'rejected', rejected_reason: reason.trim().slice(0, 2000) || null })
    .eq('id', id)
    .eq('status', 'received')
    .select('id')
    .maybeSingle();
  if (error || !data) return false;
  void logAudit({
    action: 'legal.takedown',
    actorId,
    targetUserId: actorId,
    metadata: { id, step: 'rejected' },
  });
  return true;
}

async function restoreTakedown(id: string, targetUserId: string | null): Promise<boolean> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await db
    .from('takedown_notices')
    .update({ status: 'restored', restored_at: now })
    .eq('id', id)
    .eq('status', 'counter_noticed')
    .select('id')
    .maybeSingle();
  // Already restored or upheld by someone else: nothing to undo.
  if (!data) return false;
  // Undo exactly what the removal did: show the jobs again, lift the block.
  await db
    .from('content_removals')
    .update({ restored_at: now })
    .eq('takedown_id', id)
    .is('restored_at', null);
  await db.from('blocked_content').update({ lifted_at: now }).eq('takedown_id', id);
  if (targetUserId) {
    await addUserNotice({
      userId: targetUserId,
      kind: 'contentRestored',
      ...(await noticeText('contentRestored')),
      href: '/app/history',
      dedupeKey: `takedown-restored:${id}`,
    }).catch(() => {});
    void logAudit({ action: 'legal.takedown', targetUserId, metadata: { id, step: 'restored' } });
  }
  return true;
}

/** Admin: lift a re-upload block by hand (a mistaken removal, a licence
 *  shown later). The notice and its history stay; the jobs it hid stay
 *  hidden unless the notice is restored. */
export async function liftBlock(fingerprint: string, actorId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from('blocked_content')
    .update({ lifted_at: new Date().toISOString() })
    .eq('fingerprint', fingerprint)
    .is('lifted_at', null)
    .select('fingerprint, takedown_id')
    .maybeSingle();
  if (!data) return false;
  // Audit against the uploader the block was about (the actor if unknown).
  const { data: notice } = data.takedown_id
    ? await db
        .from('takedown_notices')
        .select('target_user_id')
        .eq('id', data.takedown_id)
        .maybeSingle()
    : { data: null };
  void logAudit({
    action: 'legal.takedown',
    actorId,
    targetUserId: (notice?.target_user_id as string | null) ?? actorId,
    metadata: { step: 'block_lifted', fingerprint, takedown_id: data.takedown_id },
  });
  return true;
}

/** The date a version really applies from, for the legal pages: its
 *  registry date, or later when its change notices finished late; null while
 *  notices are still owed (terms-change.ts inForceFrom). */
export async function versionInForceAt(doc: LegalDoc, version: string): Promise<string | null> {
  const meta = versionMeta(doc, version);
  if (!meta?.effective) return null;
  const required = meta.relevance === 'relevant' && noticeRequired(doc, version);
  if (!required) return meta.effective;
  const { data } = await createAdminClient()
    .from('legal_change_notices')
    .select('complete_at')
    .eq('doc', doc)
    .eq('version', version)
    .maybeSingle()
    .then(
      (r) => r,
      () => ({ data: null }),
    );
  return inForceFrom(meta, {
    noticeRequired: true,
    completeAt: (data?.complete_at as string | null) ?? null,
  });
}

/** Re-upload blocking (§5.2.3): the source of a new job, checked before it
 *  is created. Fails open on a database error (logged), never on a match. */
export async function isContentBlocked(sourceUrl: string): Promise<boolean> {
  const fp = contentFingerprint(sourceUrl);
  if (!fp) return false;
  const { data, error } = await createAdminClient()
    .from('blocked_content')
    .select('fingerprint')
    .eq('fingerprint', fp)
    .is('lifted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[takedown] blocked_content lookup failed', error.message);
    return false;
  }
  return !!data;
}

// ── Daily cron steps (/api/cron/legal) ─────────────────────────────────

export interface LegalCronReport {
  termsChange: {
    doc: string;
    decision: string;
    version: string;
    sent: number;
    skipped: number;
    failed: number;
    late: boolean;
  }[];
  counterNotices: { restored: number };
  arcoAnswers: { resent: number; failed: number };
  retention: Record<string, unknown> | null;
}

/** aceptacion-ux §8: the email ≥ 30 days before a relevant change to any
 *  document people re-accept (Términos, Suscripción, Privacidad). */
/** At most this many notices per cron run; the rest go out the next day. */
export const NOTICE_BATCH = 2000;
/** Pause between sends (~8 a second), under the email provider's rate. */
export const NOTICE_THROTTLE_MS = 125;

interface NoticeBudget {
  /** Epoch ms after which no new send starts. */
  deadline: number;
  /** Sends left in this run, shared by every document. */
  maxSends: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** aceptacion-ux §8: the email ≥ 30 days before a relevant change to any
 *  document people re-accept (Términos, Suscripción, Privacidad). One
 *  document failing is reported and the next one still runs. */
export async function runTermsChangeNotices(
  now = new Date(),
  budget: NoticeBudget = { deadline: Date.now() + 240_000, maxSends: NOTICE_BATCH },
): Promise<LegalCronReport['termsChange']> {
  const left = { ...budget };
  const reports: LegalCronReport['termsChange'] = [];
  for (const doc of REACCEPT_DOCS) {
    try {
      reports.push(await runDocChangeNotices(doc, now, left));
    } catch (e) {
      console.error(`[legal] ${doc} notices failed`, e instanceof Error ? e.message : e);
      reports.push({
        doc,
        decision: 'error',
        version: currentVersion(doc),
        sent: 0,
        skipped: 0,
        failed: 0,
        late: false,
      });
    }
  }
  return reports;
}

async function runDocChangeNotices(doc: ReacceptDoc, now: Date, budget: NoticeBudget) {
  const version = currentVersion(doc);
  const meta = versionMeta(doc, version);
  const db = createAdminClient();
  const required = noticeRequired(doc, version);
  const { data: state } = await db
    .from('legal_change_notices')
    .select('first_send_at, complete_at')
    .eq('doc', doc)
    .eq('version', version)
    .maybeSingle();
  const decision = termsChangeDecision({
    published: legalPublished(),
    meta,
    noticeRequired: required,
    completeAt: (state?.complete_at as string | null) ?? null,
  });
  const report = {
    doc,
    decision: decision as string,
    version,
    sent: 0,
    skipped: 0,
    failed: 0,
    late: false,
  };
  if (decision !== 'send' || !meta?.effective) return report;
  if (!state?.first_send_at) {
    await db
      .from('legal_change_notices')
      .upsert({ doc, version, first_send_at: now.toISOString(), updated_at: now.toISOString() });
  }
  const origin = canonicalOrigin();
  const vars = {
    doc,
    // The earliest it can apply: its date, or 30 days from this notice.
    fecha: formatFechaLarga(
      new Date(
        Math.max(Date.parse(meta.effective), now.getTime() + TERMS_CHANGE_NOTICE_DAYS * 86_400_000),
      ),
      'es',
    ),
    changes: meta.changes,
    changesUrl: `${origin}${legalPath(doc)}/changes/${versionSlug(version)}`,
    docUrl: `${origin}${legalPath(doc)}/${versionSlug(version)}`,
    cancelUrl: `${origin}/app/billing?cancelar=1`,
  };
  const periodKey = termsChangePeriodKey(version, doc);
  // Only the people still owed the notice (no successful or in-flight
  // dispatch, no acceptance of this version), keyset-paginated; claimed one
  // by one so a concurrent run can't send twice; "sent" only with a
  // provider id (notice-dispatch.ts).
  let after: string | null = null;
  for (;;) {
    const { data: page, error } = await db.rpc('legal_change_notice_recipients', {
      p_doc: doc,
      p_version: version,
      p_period_key: periodKey,
      p_after: after,
      p_limit: 200,
    });
    if (error) throw new Error(error.message);
    const people = (page ?? []) as { id: string; email: string; full_name: string | null }[];
    for (const p of people) {
      if (budget.maxSends <= 0 || Date.now() >= budget.deadline) {
        report.decision = 'paused';
        break;
      }
      const mail = termsChangeEmail({
        ...vars,
        nombre: p.full_name?.split(' ')[0] || p.email.split('@')[0]!,
      });
      const claimed = await claimNoticeDispatch(db, {
        userId: p.id,
        kind: 'terms_change',
        periodKey,
        templateId: mail.templateId,
        templateVersion: mail.templateVersion,
      }).catch(() => null);
      if (!claimed) {
        report.skipped += 1;
        continue;
      }
      const res = await sendEmail({
        to: p.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if ((await finishNoticeDispatch(db, claimed, res)) === 'sent') report.sent += 1;
      else report.failed += 1;
      budget.maxSends -= 1;
      await sleep(NOTICE_THROTTLE_MS);
    }
    if (report.decision === 'paused' || people.length < 200) break;
    after = people[people.length - 1]!.id;
  }
  // Out of time or batch: the rest go out on the next run; not complete.
  if (report.decision === 'paused') return report;
  // Complete once nobody is owed the notice any more (failed sends are
  // owed again); the version then applies 30 days later at the earliest.
  const { data: left } = await db.rpc('legal_change_notice_recipients', {
    p_doc: doc,
    p_version: version,
    p_period_key: periodKey,
    p_after: null,
    p_limit: 1,
  });
  // In-flight sends (another run, < 10 min) are still owed: never complete
  // over them.
  const { count: inFlight } = await db
    .from('email_dispatches')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'terms_change')
    .eq('period_key', periodKey)
    .eq('delivery_status', 'pending');
  const remaining = ((left ?? []) as unknown[]).length + (inFlight ?? 0);
  report.late = noticeIsLate(meta, now, remaining);
  if (report.late)
    console.error(
      `[legal] ${doc} ${version}: notices still owed with < 30 days to ${meta.effective}; it will apply later`,
    );
  if (remaining === 0 && report.failed === 0) {
    await db
      .from('legal_change_notices')
      .update({ complete_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('doc', doc)
      .eq('version', version)
      .is('complete_at', null);
    report.decision = 'complete';
  }
  return report;
}

/** §5.3: restore what a counter-notice covered once the claimant's 15
 *  business days pass with no proceeding. */
export async function runCounterNoticeRestores(now = new Date()): Promise<{ restored: number }> {
  const { data } = await createAdminClient()
    .from('takedown_notices')
    .select('id, status, claimant_deadline, claimant_proceeding_at, target_user_id')
    .eq('status', 'counter_noticed');
  let restored = 0;
  for (const n of (data ?? []) as {
    id: string;
    status: string;
    claimant_deadline: string | null;
    claimant_proceeding_at: string | null;
    target_user_id: string | null;
  }[]) {
    if (
      counterNoticeOutcome(n, now) === 'restore' &&
      (await restoreTakedown(n.id, n.target_user_id))
    ) {
      restored += 1;
    }
  }
  return { restored };
}

/** Aviso §9.1: non-compliance marks go 72 months after the incident (the
 *  chargeback's opened_at). `dryRun` counts without deleting. The SQL
 *  function audits every active restriction it lifts. */
export async function runRetention(
  now = new Date(),
  dryRun = false,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await createAdminClient().rpc('legal_retention_purge', {
    p_now: now.toISOString(),
    p_dry_run: dryRun,
  });
  if (error) {
    console.error('[legal] retention purge failed', error.message);
    return null;
  }
  console.info('[legal] retention purge', JSON.stringify(data));
  return data as Record<string, unknown>;
}
