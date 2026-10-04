// WS-8 · FIX-S: refunds and chargebacks (REVISION §S, S.4 #1–#11; Términos
// de Suscripción §7 and §10; aceptacion-ux §10.5).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addMxBusinessDays,
  closeDue,
  contentDownloadAllowed,
  decide,
  disputeStage,
  isBadFaith,
  isRefundReason,
  measuresFor,
  noticeDeadline,
  OVERCHARGE_REFUND_BUSINESS_DAYS,
  REFUND_REASONS,
  restrictionState,
  triage,
  type BadFaithInput,
  type TriageInput,
} from '@/lib/billing/disputes';
import { mxHolidays } from '@/config/holidays-mx';
import { evidenceLines, maskCardNumbers, renderPdf, sha256Hex } from '@/lib/billing/evidence-pdf';
import { billingEmail } from '@/lib/email/billing-templates';
import { resets } from '@/lib/billing/lealtad';
import { chargeFor, lealtadPriceCents } from '@/config/pricing';
import { chargebackMeasuresEnabled, chargebackRefuseNewSubscriptions } from '@/lib/config/flags';
import { chargebackPaymentIds, parseMpNotification } from '@/lib/payments/webhook-notification';
import { isDispute, isReversal, paymentStatusToChargeStatus } from '@/lib/payments/order-charge';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const DISPUTES = src('src/lib/billing/disputes-server.ts');

/** The body of one exported function in a source file. */
function fnBody(file: string, name: string): string {
  const start = file.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const ends = ['\nexport ', '\nasync function ', '\n/**', '\n// ──']
    .map((m) => file.indexOf(m, start + 1))
    .filter((n) => n > 0);
  return file.slice(start, ends.length ? Math.min(...ends) : undefined);
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) yield* walk(rel);
    else if (/\.(ts|tsx)$/.test(name)) yield rel;
  }
}

// ── Refunds ───────────────────────────────────────────────────────────────

test('S.4 #1 · refund_issued never changes loyalty_step, plan, price or account, and never restricts', () => {
  for (const name of ['issueRefund', 'onRefundReported']) {
    const body = fnBody(DISPUTES, name);
    assert.doesNotMatch(body, /from\('(subscriptions|profiles|account_restrictions)'\)/, name);
    assert.doesNotMatch(body, /loyalty_step|tier|trial|prepayment|cancelPreapproval/, name);
  }
  assert.equal(resets('refund'), false, 'a refund keeps the Lealtad month');
  // The old policy revoked the plan on a refund; it is gone everywhere.
  for (const f of walk('src')) assert.doesNotMatch(src(f), /revokeSubscriptionForReversal/, f);
  // Refund paths in the webhook never touch the plan.
  const sync = src('src/lib/payments/subscription-sync.ts');
  const refunded = sync.slice(sync.indexOf("} else if (paymentStatus === 'refunded') {"));
  assert.doesNotMatch(refunded.slice(0, 600), /cancelPreapproval|tier: 'FREE'/);
  const oneOff = src('src/lib/payments/one-off-settlement.ts');
  const refundBlock = oneOff.slice(
    oneOff.indexOf("if (status === 'refunded') {"),
    oneOff.indexOf('// ── Amount + currency gate'),
  );
  assert.doesNotMatch(refundBlock, /tier: 'FREE'/, 'a legacy plan stays after a refund');
  // Refund + cancel = the ordinary cancel path: the refund action never cancels.
  assert.doesNotMatch(fnBody(src('src/lib/admin/people-actions.ts'), 'refundLastCharge'), /cancel/i);
});

test('S.4 #2 · refund reasons are exactly legal_7_2_a … legal_7_2_i; no courtesy', () => {
  assert.deepEqual(
    [...REFUND_REASONS],
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((l) => `legal_7_2_${l}`),
  );
  assert.equal(isRefundReason('courtesy'), false);
  assert.equal(isRefundReason('legal_7_2_d'), true);
  // The admin refund requires one of them.
  assert.match(fnBody(src('src/lib/admin/people-actions.ts'), 'refundLastCharge'), /isRefundReason\(reason\)/);
  // The DB refuses anything else.
  assert.match(src('supabase/migrations/0053_refunds_chargebacks.sql'), /payments_refund_reason_check/);
});

test('S.4 #2 · overcharges refund automatically with legal_7_2_d within 5 business days', () => {
  assert.equal(OVERCHARGE_REFUND_BUSINESS_DAYS, 5);
  const lealtad = src('src/lib/billing/lealtad-server.ts');
  assert.match(lealtad, /issueRefund\(\{[\s\S]*?reason: 'legal_7_2_d'/, 'Lealtad amount gate');
  const oneOff = src('src/lib/payments/one-off-settlement.ts');
  assert.match(oneOff, /issueRefund\(\{[\s\S]*?reason: 'legal_7_2_d'/, 'amount ≠ displayed price');
  // Refunded right away, so inside the 5 business days; and never twice.
  assert.match(fnBody(DISPUTES, 'issueRefund'), /Math\.min\(input\.cents, left\)/);
  // 5 business days from Fri 13 Nov 2026 skip the weekend and Mon 16 Nov:
  // 17, 18, 19, 20, 23.
  assert.equal(
    addMxBusinessDays(new Date('2026-11-13T18:00:00Z'), 5).toISOString(),
    '2026-11-24T05:59:59.999Z', // end of Mon 23 Nov, Mexico City
  );
});

// ── Chargebacks ───────────────────────────────────────────────────────────

test('S.4 #3 · chargeback_opened changes nothing: access, plan, price, loyalty_step, trial', () => {
  const body = fnBody(DISPUTES, 'onChargebackOpened');
  assert.doesNotMatch(body, /from\('(subscriptions|profiles|account_restrictions)'\)/);
  assert.doesNotMatch(body, /cancelPreapproval|clawback|loyalty_step:|tier:/);
  for (const f of [
    'src/app/api/mp/webhook/route.ts',
    'src/lib/payments/subscription-sync.ts',
    'src/lib/payments/one-off-settlement.ts',
  ]) {
    const s = src(f);
    const at = s.indexOf('onChargebackOpened({');
    assert.ok(at > 0, f);
    assert.doesNotMatch(s.slice(at - 400, at + 500), /cancelPreapproval|clawbackTokenPack|tier: 'FREE'/, f);
  }
  assert.equal(resets('chargeback_opened'), false);
  // Both MP dispute statuses count, and the chargebacks topic is handled.
  assert.equal(paymentStatusToChargeStatus('in_mediation'), 'in_mediation');
  assert.equal(isDispute('charged_back'), true);
  assert.equal(isDispute('in_mediation'), true);
  assert.equal(isDispute('refunded'), false);
  assert.equal(isReversal('refunded'), true);
  const n = parseMpNotification('/api/mp/webhook?topic=chargebacks&id=99', '', null);
  assert.equal(n.handled, true);
  assert.equal(n.topic, 'chargebacks');
  assert.deepEqual(chargebackPaymentIds({ payments: [123, { id: '456' }, null] }), ['123', '456']);
  // No P5 code restricts on dispute open (the old §10.2(a)).
  for (const f of walk('src')) {
    if (f.endsWith('disputes-server.ts') || f.endsWith('subscription-store.ts')) continue;
    assert.doesNotMatch(src(f), /from\('account_restrictions'\)/, f);
  }
});

const legit: TriageInput = {
  consentOnRecord: true,
  unauthorizedSignals: false,
  noticeRequired: true,
  noticeDeliveredDaysBefore: 7,
  cancelledBeforeCharge: false,
  amountMismatch: false,
  serviceFailure: false,
};

test('S.4 #4 · triage: §7.2 cases are legal_refund (accept, close, no notice, no measure)', () => {
  assert.deepEqual(triage(legit), { result: 'contest' });
  const cases: [Partial<TriageInput>, string][] = [
    [{ consentOnRecord: false }, 'legal_7_2_a'],
    [{ unauthorizedSignals: true }, 'legal_7_2_a'],
    [{ noticeDeliveredDaysBefore: null }, 'legal_7_2_b'],
    [{ noticeDeliveredDaysBefore: 4 }, 'legal_7_2_b'],
    [{ cancelledBeforeCharge: true }, 'legal_7_2_c'],
    [{ amountMismatch: true }, 'legal_7_2_d'],
    [{ serviceFailure: true }, 'legal_7_2_e'],
  ];
  for (const [patch, reason] of cases)
    assert.deepEqual(triage({ ...legit, ...patch }), { result: 'legal_refund', reason }, reason);
  // A pack bought on the spot needs no prior notice.
  assert.deepEqual(triage({ ...legit, noticeRequired: false, noticeDeliveredDaysBefore: null }), {
    result: 'contest',
  });
  // A legal case is closed at triage and can never reach a notice or a measure.
  assert.equal(disputeStage({ triage: 'legal_refund', resolution: null, notice_sent_at: null, decision: null }), 'legal_closed');
  assert.match(fnBody(DISPUTES, 'sendChargebackNotice'), /cb\.triage !== 'contest'/);
  assert.equal(decide({ ...badFaith, legalCase: true }), 'none');
});

const badFaith: BadFaithInput = {
  consentOnRecord: true,
  legalCase: false,
  usedInPeriod: true,
  cancelledBeforeCharge: false,
  resolution: 'won',
  unpaid: true,
  noticeSentAt: new Date('2026-11-13T18:00:00Z'),
  deadline: noticeDeadline(new Date('2026-11-13T18:00:00Z')),
  now: new Date('2026-12-02T00:00:00Z'),
  paid: false,
  responseAccepted: false,
};

test('S.4 #5 · the bad-faith predicate is true only if EVERY condition holds', () => {
  assert.equal(isBadFaith(badFaith), true);
  assert.equal(isBadFaith({ ...badFaith, resolution: 'lost', unpaid: true }), true);
  const flips: [string, Partial<BadFaithInput>][] = [
    ['no consent', { consentOnRecord: false }],
    ['a §7.2 case', { legalCase: true }],
    ['no usage', { usedInPeriod: false }],
    ['cancelled before', { cancelledBeforeCharge: true }],
    ['unresolved', { resolution: null }],
    ['lost but paid', { resolution: 'lost', unpaid: false }],
    ['no notice', { noticeSentAt: null }],
    ['before the deadline', { now: new Date('2026-11-30T12:00:00Z') }],
    ['paid', { paid: true }],
    ['accepted answer', { responseAccepted: true }],
  ];
  for (const [why, patch] of flips) assert.equal(isBadFaith({ ...badFaith, ...patch }), false, why);
});

test('S.4 #6 · the deadline is 10 business days after the notice, skipping weekends and holidays (pinned)', () => {
  // Fri 13 Nov 2026, 12:00 Mexico City. Mon 16 Nov is the Revolution
  // holiday (third Monday of November): business days run 17–20, 23–27, 30.
  const d = noticeDeadline(new Date('2026-11-13T18:00:00Z'));
  assert.equal(d.toISOString(), '2026-12-01T05:59:59.999Z', 'end of Mon 30 Nov, Mexico City');
  // Without a holiday in the way: Mon 5 Oct 2026 → end of Mon 19 Oct.
  assert.equal(
    noticeDeadline(new Date('2026-10-05T15:00:00Z')).toISOString(),
    '2026-10-20T05:59:59.999Z',
  );
  // A notice sent late on Friday night in Mexico City still counts from that Friday.
  assert.equal(
    noticeDeadline(new Date('2026-11-14T05:30:00Z')).toISOString(),
    '2026-12-01T05:59:59.999Z',
  );
  const h = mxHolidays(2026);
  for (const day of ['2026-01-01', '2026-02-02', '2026-03-16', '2026-05-01', '2026-09-16', '2026-11-16', '2026-12-25'])
    assert.ok(h.has(day), day);
  assert.ok(mxHolidays(2030).has('2030-10-01'), 'transmisión del Poder Ejecutivo');
  assert.ok(!mxHolidays(2026).has('2026-10-01'));
});

test('S.4 #7 · payment or an accepted answer before the deadline → none; payment lifts restrictions', () => {
  const early = new Date('2026-11-20T12:00:00Z');
  assert.equal(decide({ ...badFaith, now: early, paid: true }), 'none');
  assert.equal(decide({ ...badFaith, now: early, responseAccepted: true }), 'none');
  assert.equal(decide({ ...badFaith, now: early }), 'pending', 'still inside the 10 days');
  assert.equal(decide(badFaith), 'bad_faith');
  const paid = fnBody(DISPUTES, 'recordPaid');
  assert.match(paid, /from\('account_restrictions'\)[\s\S]*?update\(\{ lifted_at: now \}\)/);
  assert.match(paid, /'restricted', 'closed'/);
});

test('S.4 #8 · closing needs [30] unpaid days after the restriction, or a repeat; download always stays', () => {
  const base = {
    measuresEnabled: true,
    restrictedAt: new Date('2026-12-01T00:00:00Z'),
    unpaid: true,
    repeatBadFaith: false,
    closeAfterDays: 30,
  };
  assert.equal(closeDue({ ...base, now: new Date('2026-12-30T23:00:00Z') }), false, '29 days');
  assert.equal(closeDue({ ...base, now: new Date('2026-12-31T00:00:00Z') }), true, '30 days');
  assert.equal(closeDue({ ...base, unpaid: false, now: new Date('2027-06-01T00:00:00Z') }), false, 'paid');
  assert.equal(closeDue({ ...base, restrictedAt: null, repeatBadFaith: true, now: new Date() }), true);
  const restricted = restrictionState([{ kind: 'restricted', set_at: '2026-12-01', lifted_at: null }]);
  const closed = restrictionState([{ kind: 'closed', set_at: '2026-12-31', lifted_at: null }]);
  assert.equal(restricted.paidSuspended, true);
  assert.equal(closed.closed, true);
  assert.equal(contentDownloadAllowed(restricted), true);
  assert.equal(contentDownloadAllowed(closed), true);
  // Nothing that serves content reads restrictions; only paid entitlements do.
  for (const f of walk('src/app/api'))
    if (/download|export|clip/i.test(f)) assert.doesNotMatch(src(f), /restriction/i, f);
  assert.match(src('src/lib/billing/entitlement.ts'), /Content download is not gated here/);
  // No fee, interest or penalty anywhere in the measures.
  assert.doesNotMatch(DISPUTES, /penaliza|inter[eé]s|cargo adicional/i);
});

test('S.4 #9 · prepayment_required only after bad_faith; it blocks the trial', () => {
  assert.deepEqual(measuresFor('bad_faith', { measuresEnabled: true, unpaid: false }), ['prepayment_required']);
  assert.deepEqual(measuresFor('bad_faith', { measuresEnabled: true, unpaid: true }), [
    'restricted',
    'prepayment_required',
  ]);
  assert.deepEqual(measuresFor('none', { measuresEnabled: true, unpaid: true }), []);
  assert.deepEqual(measuresFor('pending', { measuresEnabled: true, unpaid: true }), []);
  assert.match(
    src('src/lib/billing/subscription-store.ts'),
    /trialUsed: !!profile\?\.pro_trial_started_at \|\| restriction\.prepaymentRequired/,
  );
  assert.match(fnBody(DISPUTES, 'applyMeasure'), /cb\?\.decision !== 'bad_faith'/);
});

// ── Evidence and copy ─────────────────────────────────────────────────────

test('S.4 #10 · the evidence PDF holds what §10.5 step 2 lists, and never a full card number', () => {
  const lines = evidenceLines({
    generatedAt: new Date('2026-12-01T12:00:00Z'),
    account: { userId: 'u-1', email: 'maria@example.com' },
    charge: {
      mpPaymentId: '182026865254',
      mpPreapprovalId: 'pre-9',
      amountMxn: 997,
      chargedAt: '2026-11-02T18:00:00Z',
      cardBrand: 'visa',
      cardLast4: '4821',
    },
    consents: [
      {
        event_type: 'trial_started',
        consent_id: 'c0ffee00-0000-4000-8000-000000000001',
        timestamp_utc: '2026-10-26T18:00:00Z',
        ip: '201.141.1.2',
        user_agent: 'Mozilla/5.0 (iPhone)',
        disclosure_text: 'Se cobrarán $997 MXN el 2 de noviembre. Tarjeta 4111 1111 1111 1111.',
        checkbox_text: 'Acepto el cobro recurrente',
        checkbox_checked: true,
        button_label: 'Empezar mis 7 días gratis',
        ui_version: 'rebuild-p5',
        event_hash: 'abc123',
        documents: [{ doc: 'suscripcion', version: '1.0', url: 'https://www.chalyb.com/suscripcion/v1-0', sha256: 'f00d' }],
      },
    ],
    notices: [
      { kind: 'trial_7d', template: 'billing.trial_7d', message_id: 'msg-1', sent_at: '2026-10-26T18:00:01Z', delivery_status: 'delivered' },
    ],
    cancellation: { requestedAt: null, folio: null },
    usage: { from: '2026-11-02', to: '2026-12-02', lastSignInAt: '2026-11-20T10:00:00Z', meteredEvents: 42 },
    policyUrls: ['suscripcion v1.0: https://www.chalyb.com/suscripcion/v1-0'],
  });
  const text = lines.join('\n');
  for (const needle of [
    'Acepto el cobro recurrente', // checkbox
    'marcada: sí',
    '2026-10-26T18:00:00Z', // timestamp
    '201.141.1.2', // IP
    'Mozilla/5.0 (iPhone)', // UA
    'suscripcion v1.0', // terms version
    'sha256 f00d', // terms hash
    'trial_7d', // the notice
    'estado delivered',
    '182026865254', // payment id
    'Sin solicitud de cancelación', // cancellation status
    'eventos de uso medidos: 42', // usage
  ])
    assert.ok(text.includes(needle), needle);
  assert.doesNotMatch(text, /4111 1111 1111 1111|4111111111111111/, 'never the full card number');
  assert.equal(maskCardNumbers('4111-1111-1111-1111'), '•••• 1111');
  assert.equal(maskCardNumbers('pago 182026865254'), 'pago 182026865254', 'ids are not cards');
  const pdf = renderPdf(lines);
  const raw = Buffer.from(pdf).toString('latin1');
  assert.ok(raw.startsWith('%PDF-1.4') && raw.trimEnd().endsWith('%%EOF'));
  assert.ok(raw.includes('182026865254'));
  assert.doesNotMatch(raw, /4111 1111 1111 1111/);
  assert.match(sha256Hex(pdf), /^[0-9a-f]{64}$/);
  // Generating it logs chargeback_evidence_submitted with the hash.
  assert.match(fnBody(DISPUTES, 'buildEvidencePackage'), /'chargeback_evidence_submitted'[\s\S]*?pdf_sha256: sha256/);
});

test('S.4 #11 · the dispute notice email, verbatim (aceptacion-ux §10.5 step 3)', () => {
  const mail = billingEmail('chargeback_notice', {
    nombre: 'María',
    plan: 'Pro mensual',
    monto: '$997',
    fecha_cobro: '2 de noviembre de 2026',
    fecha_consentimiento: '26 de octubre de 2026',
    consent_id: 'c0ffee',
    fecha_aviso: '26 de octubre de 2026',
    resumen_uso: '42 usos registrados',
    pendiente: true,
    fecha_limite: '30 de noviembre de 2026',
    pagar_url: 'https://mpago.la/abc',
    responder_url: 'mailto:hola@chalyb.com',
    appUrl: 'https://www.chalyb.com',
  });
  assert.equal(mail.subject, 'Aviso sobre el contracargo del cargo de $997 MXN del 2 de noviembre de 2026');
  for (const needle of [
    'disputaste ante tu banco el cargo de $997 MXN del 2 de noviembre de 2026 por Pro mensual.',
    'El monto de $997 MXN está pendiente de pago.',
    'Tienes 10 días hábiles, hasta el 30 de noviembre de 2026, para: (1) pagar el monto pendiente: https://mpago.la/abc, o (2) responder: mailto:hola@chalyb.com',
    'suspender las funciones de pago de tu cuenta hasta que se pague',
    'Siempre podrás descargar tu contenido.',
    'Pedir un reembolso o disputar un cargo no autorizado nunca tiene consecuencias.',
  ])
    assert.ok(mail.text.includes(needle), needle);
  const won = billingEmail('chargeback_notice', { nombre: 'M', plan: 'Pro', monto: '$997', pendiente: false, appUrl: 'https://x' });
  assert.ok(!won.text.includes('está pendiente de pago'));
});

// ── Extras ────────────────────────────────────────────────────────────────

test('a dispute on Pro Lealtad at step N, won or lost, then refunded, leaves loyalty_step = N', () => {
  for (const N of [0, 3, 6]) {
    for (const c of ['chargeback_opened', 'chargeback_resolved', 'refund'] as const)
      assert.equal(resets(c), false, `${c} at step ${N}`);
    // The next charge is still step N's price.
    assert.equal(chargeFor({ plan_key: 'pro_lealtad', loyalty_step: N }), lealtadPriceCents(N));
  }
  // No dispute or refund code writes the step: only an approved charge does.
  assert.doesNotMatch(DISPUTES, /loyalty_step\s*:/);
  for (const f of walk('src')) {
    if (f.endsWith('lealtad-server.ts') || f.endsWith('start-subscription.ts')) continue;
    assert.doesNotMatch(src(f), /update\(\{[^}]*loyalty_step:/, f);
  }
});

test('with CHARGEBACK_MEASURES_ENABLED=false nothing writes account_restricted, account_closed or prepayment_required', () => {
  delete process.env.CHARGEBACK_MEASURES_ENABLED;
  delete process.env.CHARGEBACK_REFUSE_NEW_SUBSCRIPTIONS;
  assert.equal(chargebackMeasuresEnabled(), false);
  assert.equal(chargebackRefuseNewSubscriptions(), false);
  assert.deepEqual(measuresFor('bad_faith', { measuresEnabled: false, unpaid: true }), []);
  assert.equal(
    closeDue({ measuresEnabled: false, restrictedAt: new Date(0), unpaid: true, repeatBadFaith: true, closeAfterDays: 30, now: new Date() }),
    false,
  );
  // One writer, and its first line is the flag.
  const inserts = [...walk('src')].filter((f) => /from\('account_restrictions'\)\s*\.insert/.test(src(f)));
  assert.deepEqual(inserts, ['src/lib/billing/disputes-server.ts']);
  const apply = fnBody(DISPUTES, 'applyMeasure');
  assert.match(apply.split('\n').slice(0, 3).join('\n'), /if \(!chargebackMeasuresEnabled\(\)\) return false;/);
  // The three events are only ever recorded by applyMeasure.
  for (const f of walk('src')) {
    if (/consent-core\.ts$|disputes(-server)?\.ts$|admin\/data\.ts$/.test(f)) continue;
    assert.doesNotMatch(src(f), /'(account_restricted|account_closed|prepayment_required)'/, f);
  }
  assert.doesNotMatch(
    DISPUTES.replace(apply, ''),
    /recordConsent\(\{\s*event_type: '(account_restricted|account_closed|prepayment_required)'/,
  );
});

test('copy: the §7.3 / §10.2 policy reaches the user; nothing offers a courtesy refund', () => {
  const es = JSON.parse(src('messages/es.json'));
  assert.match(es.help.q.chargeA, /Solo necesitamos tu correo, la fecha y el monto/);
  assert.match(es.help.q.chargeA, /nunca te perjudica/);
  assert.equal(es.help.q.chargeCta, 'Problema con un cobro');
  assert.doesNotMatch(JSON.stringify(es), /cortes[ií]a/i);
  // Writing first is optional: the form needs only email, date and amount.
  const action = src('src/lib/contact/contact-actions.ts');
  assert.match(action, /category === 'cobro'/);
  const form = src('src/components/contact/contact-form.tsx');
  assert.match(form, /required=\{!cobro\}/);
  // Términos carry the new sentences; the hashes were rebuilt.
  const terminos = src('docs/design/app-reimagine/legal/terminos-de-suscripcion.md');
  assert.match(terminos, /Pedir un reembolso nunca te perjudica/);
  assert.match(terminos, /Presentar una disputa no tiene consecuencias por sí solo/);
  assert.doesNotMatch(terminos, /suspender temporalmente[^.]{0,160}mientras se resuelve/i);
});
