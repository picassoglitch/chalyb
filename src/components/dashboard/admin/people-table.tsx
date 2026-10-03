'use client';

// Personas (SCR-28, P5-2): search, chips, the table, and per-row actions.
// Each action opens the action sheet, then "Confirma · paso 2 de 2"; only
// [Sí, …] calls the server, which checks everything again.

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MoreHorizontal, Search } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { filterPeople, type PeopleChip, type PersonStatus } from '@/lib/admin/people';
import {
  cancelForPerson,
  giftMonth,
  offerPlanChange,
  refundLastCharge,
  resendAccessEmail,
  type PeopleActionResult,
} from '@/lib/admin/people-actions';
import { Sheet } from '@/components/ui/sheet';
import { Pill } from '@/components/ui/primitives';
import { ConfirmStep } from './confirm-step';

export interface PersonVM {
  id: string;
  name: string;
  email: string;
  plan: 'Gratis' | 'Pro' | 'VIP';
  status: PersonStatus;
  since: string;
  actions: {
    giftMonth: boolean;
    changePlan: boolean;
    resendAccess: boolean;
    refundLast: boolean;
    cancel: boolean;
  };
  refundCents: number | null;
}

type ActionKey = keyof PersonVM['actions'];
const ACTIONS: ActionKey[] = ['giftMonth', 'changePlan', 'resendAccess', 'refundLast', 'cancel'];
const PLANS = ['pro_month', 'pro_year', 'vip_month', 'vip_year'] as const;
const PILL: Record<PersonStatus, 'ok' | 'acc' | 'bad' | 'warn' | 'gray'> = {
  active: 'ok',
  trial: 'acc',
  past_due: 'bad',
  ending: 'warn',
  cancelled: 'gray',
  free: 'gray',
};

export function PeopleTable({ people }: { people: PersonVM[] }) {
  const t = useTranslations('admin.people');
  const ts = useTranslations('admin.settings.plan');
  const locale = useLocale();
  const router = useRouter();
  const [chip, setChip] = useState<PeopleChip>('all');
  const [q, setQ] = useState('');
  const [row, setRow] = useState<PersonVM | null>(null);
  const [action, setAction] = useState<ActionKey | null>(null);
  const [plan, setPlan] = useState<(typeof PLANS)[number]>('pro_year');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const shown = useMemo(
    () =>
      filterPeople(
        people.map((p) => ({ ...p, sub: null })),
        chip,
        q,
      ).map((r) => people.find((p) => p.id === r.id)!),
    [people, chip, q],
  );
  const date = (iso: string) =>
    iso && !Number.isNaN(Date.parse(iso))
      ? new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date(iso))
      : '—';
  const money = (c: number) =>
    `$${(c / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  async function run() {
    if (!row || !action) return;
    let r: PeopleActionResult;
    if (action === 'giftMonth') r = await giftMonth(row.id);
    else if (action === 'changePlan') r = await offerPlanChange(row.id, plan);
    else if (action === 'resendAccess') r = await resendAccessEmail(row.id);
    else if (action === 'refundLast') r = await refundLastCharge(row.id);
    else r = await cancelForPerson(row.id);
    setAction(null);
    setRow(null);
    setMsg(r.ok ? { ok: true, text: t('done') } : { ok: false, text: t(`err.${r.code}`) });
    router.refresh();
  }

  const confirmVars = row
    ? { nombre: row.name, plan: ts(plan), monto: row.refundCents ? money(row.refundCents) : '' }
    : { nombre: '', plan: '', monto: '' };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="ch-search">
        <Search aria-hidden="true" />
        <label htmlFor="pq" className="ch-sr">
          {t('search')}
        </label>
        <input
          id="pq"
          type="search"
          className="ch-input"
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div
        role="group"
        aria-label={t('title')}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        {(['all', 'trial', 'past_due', 'cancelled'] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={chip === c}
            className={`ch-chip${chip === c ? ' ch-chip--on' : ''}`}
            onClick={() => setChip(c)}
          >
            {t(`chips.${c}`)}
          </button>
        ))}
      </div>
      {msg && (
        <p
          role={msg.ok ? 'status' : 'alert'}
          className="ch-card"
          style={{ padding: 14, color: msg.ok ? undefined : 'var(--bad)' }}
        >
          {msg.text}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="ch-card" style={{ padding: 20 }}>
          {people.length ? t('empty') : t('none')}
        </p>
      ) : (
        <div className="ch-table-wrap" role="region" aria-label={t('title')} tabIndex={0}>
          <table className="ch-table">
            <thead>
              <tr>
                <th scope="col">{t('col.person')}</th>
                <th scope="col">{t('col.plan')}</th>
                <th scope="col">{t('col.status')}</th>
                <th scope="col">{t('col.since')}</th>
                <th scope="col">
                  <span className="ch-sr">{t('col.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <br />
                    <small className="ch-muted" style={{ overflowWrap: 'anywhere' }}>
                      {p.email}
                    </small>
                  </td>
                  <td>{p.plan}</td>
                  <td>
                    <Pill kind={PILL[p.status]}>{t(`status.${p.status}`)}</Pill>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{date(p.since)}</td>
                  <td>
                    <button
                      type="button"
                      className="ch-iconbtn"
                      aria-label={t('actionsFor', { nombre: p.name })}
                      onClick={() => {
                        setMsg(null);
                        setRow(p);
                      }}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={!!row && !action}
        onClose={() => setRow(null)}
        title={row ? t('actionsFor', { nombre: row.name }) : ''}
        closeLabel={t('confirm.no')}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {row &&
            ACTIONS.filter((a) => row.actions[a]).map((a) => (
              <button
                key={a}
                type="button"
                className={`ch-btn ${a === 'cancel' ? 'ch-btn--danger' : 'ch-btn--secondary'}`}
                onClick={() => setAction(a)}
              >
                {t(`act.${a}`)}
              </button>
            ))}
          {row && !row.actions.giftMonth && (
            <p className="ch-muted" style={{ fontSize: 15 }}>
              {t('giftBlocked')}
            </p>
          )}
          {row && (
            <label className="ch-field">
              <span>{t('choosePlan')}</span>
              <select
                className="ch-input"
                value={plan}
                onChange={(e) => setPlan(e.target.value as (typeof PLANS)[number])}
              >
                {PLANS.map((k) => (
                  <option key={k} value={k}>
                    {ts(k)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Sheet>

      {action && row && (
        <ConfirmStep
          open
          title={t(`confirm.${action}.q`, confirmVars)}
          body={t(`confirm.${action}.body`)}
          yesLabel={t(`confirm.${action}.yes`)}
          noLabel={t('confirm.no')}
          danger={action === 'cancel' || action === 'refundLast'}
          onYes={run}
          onNo={() => {
            setAction(null);
            setRow(null);
          }}
        />
      )}
    </div>
  );
}
