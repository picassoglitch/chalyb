'use client';

// Dinero → Disputas (WS-8; aceptacion-ux §10.5). One row per disputed
// payment and the next step of the case in a sheet: evidence, Mercado
// Pago's resolution, the 10-business-day notice, the answer, the payment.
// Opening a dispute changed nothing on the account; nothing here does either.

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { Pill } from '@/components/ui/primitives';
import { disputeStage, REFUND_REASONS, type DisputeStage } from '@/lib/billing/disputes';
import { disputeStep, type DisputeStep } from '@/lib/admin/dispute-actions';
import type { DisputeRow } from '@/lib/admin/data';

const PILL: Record<DisputeStage, 'ok' | 'acc' | 'warn' | 'bad' | 'gray'> = {
  legal_closed: 'gray',
  awaiting_resolution: 'acc',
  ready_for_notice: 'warn',
  notice_running: 'warn',
  decided_none: 'ok',
  decided_bad_faith: 'bad',
};

export function DisputesPanel({ rows }: { rows: DisputeRow[] }) {
  const t = useTranslations('admin.disputes');
  const tr = useTranslations('admin.people.refundReason');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState<DisputeRow | null>(null);
  const [reason, setReason] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [medida, setMedida] = useState<'suspender' | 'cerrar'>('suspender');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'America/Mexico_City',
        }).format(new Date(iso))
      : '—';
  const money = (c: number) =>
    `$${(c / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  async function run(step: DisputeStep) {
    if (!open) return;
    setBusy(true);
    const r = await disputeStep(open.id, step);
    setBusy(false);
    setOpen(null);
    setReason('');
    setPayUrl('');
    setMsg(r.ok ? { ok: true, text: t('done') } : { ok: false, text: t(`err.${r.code}`) });
    router.refresh();
  }

  if (rows.length === 0)
    return (
      <p className="ch-card" style={{ padding: 16 }}>
        {t('empty')}
      </p>
    );

  const stage = open ? disputeStage(open) : null;
  const owed = open ? open.resolution === 'lost' && !open.paid_at : false;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {msg && (
        <p
          role={msg.ok ? 'status' : 'alert'}
          className="ch-card"
          style={{ padding: 14, color: msg.ok ? undefined : 'var(--bad)' }}
        >
          {msg.text}
        </p>
      )}
      <div className="ch-table-wrap" role="region" aria-labelledby="disputas-t" tabIndex={0}>
        <table className="ch-table">
          <thead>
            <tr>
              <th scope="col">{t('col.opened')}</th>
              <th scope="col">{t('col.person')}</th>
              <th scope="col" className="num">
                {t('col.amount')}
              </th>
              <th scope="col">{t('col.stage')}</th>
              <th scope="col">{t('col.deadline')}</th>
              <th scope="col">
                <span className="ch-sr">{t('col.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = disputeStage(r);
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{date(r.opened_at)}</td>
                  <td>{r.person}</td>
                  <td className="num">{money(r.amount_cents)}</td>
                  <td>
                    <Pill kind={PILL[s]}>{t(`stage.${s}`)}</Pill>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{date(r.deadline_utc)}</td>
                  <td>
                    <button
                      type="button"
                      className="ch-btn ch-btn--secondary ch-btn--compact"
                      onClick={() => setOpen(r)}
                    >
                      {t('open')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? t('sheetTitle', { pago: open.mp_payment_id }) : ''}
        closeLabel={t('close')}
      >
        {open && stage && (
          <div style={{ display: 'grid', gap: 12 }}>
            <p className="ch-muted">{t('nothingChanges')}</p>
            <p>
              <b>{t(`stage.${stage}`)}</b> · {t(`hint.${stage}`)}
            </p>
            {open.triage_reason && (
              <p className="ch-muted">{tr(open.triage_reason as (typeof REFUND_REASONS)[number])}</p>
            )}

            {stage !== 'legal_closed' && (
              <a
                className="ch-btn ch-btn--secondary"
                href={`/api/admin/disputes/${open.id}/evidence`}
                download
              >
                {t('evidence')}
              </a>
            )}

            {stage === 'awaiting_resolution' && (
              <>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                  <button
                    type="button"
                    className="ch-btn ch-btn--secondary"
                    disabled={busy}
                    onClick={() => run({ kind: 'resolved', resolution: 'won' })}
                  >
                    {t('won')}
                  </button>
                  <button
                    type="button"
                    className="ch-btn ch-btn--secondary"
                    disabled={busy}
                    onClick={() => run({ kind: 'resolved', resolution: 'lost' })}
                  >
                    {t('lost')}
                  </button>
                </div>
                <label className="ch-field">
                  <span>{tr('label')}</span>
                  <select
                    className="ch-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="">{tr('pick')}</option>
                    {REFUND_REASONS.map((k) => (
                      <option key={k} value={k}>
                        {tr(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="ch-btn ch-btn--secondary"
                  disabled={busy || !reason}
                  onClick={() => run({ kind: 'legal', reason })}
                >
                  {t('legal')}
                </button>
              </>
            )}

            {stage === 'ready_for_notice' && (
              <>
                {owed && (
                  <label className="ch-field">
                    <span>{t('payUrl')}</span>
                    <input
                      className="ch-input"
                      type="url"
                      inputMode="url"
                      placeholder="https://mpago.la/…"
                      value={payUrl}
                      onChange={(e) => setPayUrl(e.target.value)}
                    />
                  </label>
                )}
                <label className="ch-field">
                  <span>{t('medida')}</span>
                  <select
                    className="ch-input"
                    value={medida}
                    onChange={(e) => setMedida(e.target.value === 'cerrar' ? 'cerrar' : 'suspender')}
                  >
                    <option value="suspender">{t('medidaSuspender')}</option>
                    <option value="cerrar">{t('medidaCerrar')}</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="ch-btn ch-btn--primary"
                  disabled={busy || (owed && !payUrl)}
                  onClick={() => run({ kind: 'notice', payUrl, medida })}
                >
                  {t('sendNotice')}
                </button>
              </>
            )}

            {stage === 'notice_running' && (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className="ch-btn ch-btn--secondary"
                  disabled={busy}
                  onClick={() => run({ kind: 'response', accepted: true })}
                >
                  {t('responseOk')}
                </button>
                <button
                  type="button"
                  className="ch-btn ch-btn--secondary"
                  disabled={busy}
                  onClick={() => run({ kind: 'response', accepted: false })}
                >
                  {t('responseNo')}
                </button>
              </div>
            )}

            {stage !== 'legal_closed' && stage !== 'decided_none' && !open.paid_at && (
              <button
                type="button"
                className="ch-btn ch-btn--ok"
                disabled={busy}
                onClick={() => run({ kind: 'paid' })}
              >
                {t('paid')}
              </button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
