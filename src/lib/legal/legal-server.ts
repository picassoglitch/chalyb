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
import { canonicalOrigin } from '@/lib/site';
import { legalDocuments } from './documents';
import { currentVersion, legalPath, noticeRequired, versionMeta, versionSlug } from './registry';
import { arcoEffectiveBy, arcoError, arcoRespondBy, type ArcoInput } from './arco';
import {
  COUNTER_NOTICE_BUSINESS_DAYS,
  contentFingerprint,
  counterNoticeOutcome,
  isRepeatInfringer,
  strikeCount,
  takedownMissing,
  takedownTooLong,
  type TakedownInput,
} from './takedown';
import {
  noticeIsLate,
  termsChangeDecision,
  termsChangeEmail,
  termsChangePeriodKey,
} from './terms-change';
import { claimNoticeDispatch, finishNoticeDispatch } from './notice-dispatch';
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
  const ctx = await requestContext();
  const disclosure = `Solicitud ARCO (${input.right}): ${input.description.trim()}`;
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
    disclosure_text: disclosure,
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
    details: { right: input.right },
  });
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
      consent_id: consent.consent_id,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[arco] insert failed', error.message);
    return { ok: false, code: 'db' };
  }
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

export async function answerArco(
  id: string,
  outcome: 'granted' | 'partially_granted' | 'denied' | 'incomplete',
  actorId: string,
): Promise<boolean> {
  const now = new Date();
  const { data, error } = await createAdminClient()
    .from('arco_requests')
    .update({
      responded_at: now.toISOString(),
      outcome,
      effective_by:
        outcome === 'granted' || outcome === 'partially_granted'
          ? arcoEffectiveBy(now).toISOString()
          : null,
    })
    .eq('id', id)
    .is('responded_at', null)
    .select('user_id')
    .maybeSingle();
  if (error || !data) return false;
  void logAudit({
    action: 'legal.arco',
    actorId,
    targetUserId: data.user_id as string,
    metadata: { id, outcome },
  });
  return true;
}

export async function extendArco(id: string, actorId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from('arco_requests')
    .select('received_at, extended_at, user_id')
    .eq('id', id)
    .maybeSingle();
  if (!data || data.extended_at) return false;
  const { error } = await db
    .from('arco_requests')
    .update({
      extended_at: new Date().toISOString(),
      respond_by: arcoRespondBy(new Date(data.received_at as string), true).toISOString(),
    })
    .eq('id', id);
  if (error) return false;
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

/** Admin: remove the content, block its re-upload, tell the uploader. */
export async function removeTakedown(
  id: string,
  targetEmail: string,
  actor: { id: string; name: string },
): Promise<{ ok: true; repeat: boolean } | { ok: false; code: string }> {
  const db = createAdminClient();
  const { data: n } = await db.from('takedown_notices').select('*').eq('id', id).maybeSingle();
  if (!n || n.status !== 'received') return { ok: false, code: 'state' };
  const { data: prof } = await db
    .from('profiles')
    .select('id, email')
    .ilike('email', targetEmail.trim())
    .maybeSingle();
  if (!prof) return { ok: false, code: 'user' };
  const now = new Date().toISOString();
  const { error } = await db
    .from('takedown_notices')
    .update({
      status: 'removed',
      target_user_id: prof.id,
      removed_at: now,
      removed_by: actor.name,
      user_notified_at: now,
    })
    .eq('id', id)
    .eq('status', 'received');
  if (error) return { ok: false, code: 'db' };
  const fp = contentFingerprint(n.content_location as string);
  if (fp) {
    await db.from('blocked_content').upsert({
      fingerprint: fp,
      kind: 'url',
      source: n.content_location,
      takedown_id: id,
      lifted_at: null,
    });
  }
  // §5.2.4: tell the uploader, with a copy of the notice and no claimant
  // data beyond what's needed.
  await addUserNotice({
    userId: prof.id as string,
    kind: 'contentRemoved',
    ...(await noticeText('contentRemoved', {
      contenido: String(n.content_identification).slice(0, 120),
    })),
    href: '/uso-aceptable#5-3-contra-aviso',
    dedupeKey: `takedown:${id}`,
  }).catch(() => {});
  if (prof.email) {
    await sendEmail({
      to: prof.email as string,
      subject: 'Retiramos contenido por un aviso de derechos de autor',
      html: wrap({
        title: 'Contenido retirado',
        preview: 'Puedes enviar un contra-aviso si fue un error.',
        body: [
          `<p>Recibimos un aviso de derechos de autor sobre este contenido y lo retiramos (Política de Uso Aceptable §5.2):</p>`,
          `<p><b>${escapeHtml(n.content_identification as string)}</b><br/>${escapeHtml(n.content_location as string)}</p>`,
          `<p>Motivo que nos indicaron: ${escapeHtml(n.right_statement as string)}</p>`,
          `<p>Si crees que fue un error, responde a este correo con tu <b>contra-aviso</b>: demuestra la titularidad o la autorización que tienes para ese uso, o justifica el uso conforme a la Ley Federal del Derecho de Autor (§5.3).</p>`,
        ].join(''),
      }),
      replyTo: copyrightInbox(),
    });
  }
  const { data: history } = await db
    .from('takedown_notices')
    .select('status, removed_at')
    .eq('target_user_id', prof.id);
  const repeat = isRepeatInfringer(
    strikeCount((history ?? []) as { status: string; removed_at: string | null }[], new Date()),
  );
  void logAudit({
    action: 'legal.takedown',
    actorId: actor.id,
    targetUserId: prof.id as string,
    metadata: { id, step: 'removed', fingerprint: fp },
  });
  if (repeat)
    void logAudit({
      action: 'legal.repeat_infringer',
      actorId: actor.id,
      targetUserId: prof.id as string,
      metadata: { id },
    });
  return { ok: true, repeat };
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
  const { error } = await db
    .from('takedown_notices')
    .update({
      status: 'counter_noticed',
      counter_notice: text.trim().slice(0, 8000),
      counter_noticed_at: now.toISOString(),
      claimant_deadline: deadline.toISOString(),
    })
    .eq('id', id)
    .eq('status', 'removed');
  if (error) return false;
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

async function restoreTakedown(id: string, targetUserId: string | null): Promise<void> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  await db
    .from('takedown_notices')
    .update({ status: 'restored', restored_at: now })
    .eq('id', id)
    .eq('status', 'counter_noticed');
  await db.from('blocked_content').update({ lifted_at: now }).eq('takedown_id', id);
  if (targetUserId) {
    await addUserNotice({
      userId: targetUserId,
      kind: 'contentRestored',
      ...(await noticeText('contentRestored')),
      dedupeKey: `takedown-restored:${id}`,
    }).catch(() => {});
  }
  if (targetUserId)
    void logAudit({ action: 'legal.takedown', targetUserId, metadata: { id, step: 'restored' } });
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
  retention: Record<string, unknown> | null;
}

/** aceptacion-ux §8: the email ≥ 30 days before a relevant change to any
 *  document people re-accept (Términos, Suscripción, Privacidad). */
export async function runTermsChangeNotices(
  now = new Date(),
): Promise<LegalCronReport['termsChange']> {
  const reports = [];
  for (const doc of REACCEPT_DOCS) reports.push(await runDocChangeNotices(doc, now));
  return reports;
}

async function runDocChangeNotices(doc: ReacceptDoc, now: Date) {
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
    fecha: formatFechaLarga(meta.effective, 'es'),
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
    }
    if (people.length < 200) break;
    after = people[people.length - 1]!.id;
  }
  // Complete once nobody is owed the notice any more (failed sends are
  // owed again); the version then applies 30 days later at the earliest.
  const { data: left } = await db.rpc('legal_change_notice_recipients', {
    p_doc: doc,
    p_version: version,
    p_period_key: periodKey,
    p_after: null,
    p_limit: 1,
  });
  const remaining = ((left ?? []) as unknown[]).length;
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
    if (counterNoticeOutcome(n, now) === 'restore') {
      await restoreTakedown(n.id, n.target_user_id);
      restored += 1;
    }
  }
  return { restored };
}

/** Aviso §9.1: non-compliance marks go 72 months after the incident. */
export async function runRetention(now = new Date()): Promise<Record<string, unknown> | null> {
  const { data, error } = await createAdminClient().rpc('legal_retention_purge', {
    p_now: now.toISOString(),
  });
  if (error) {
    console.error('[legal] retention purge failed', error.message);
    return null;
  }
  console.info('[legal] retention purge', JSON.stringify(data));
  return data as Record<string, unknown>;
}
