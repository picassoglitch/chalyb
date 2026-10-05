'use client';

// Ajustes · credit-pack prices and how IVA applies (owner, 2026-10-04/05).
// The owner types pesos per pack and picks "IVA incluido" (the typed price
// is the total) or "agregar IVA" (the rate is added on top). The preview
// shows the total each customer will pay — the same figure the store, the
// checkout, Mercado Pago and /legal/packs use once saved.

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setPackPrices } from '@/lib/admin/panel-actions';
import { formatMXN } from '@/lib/billing/format';
import {
  MAX_IVA_RATE_PERCENT,
  PACK_IDS,
  packTotalCents,
  parsePackPricing,
  pesosToCents,
  type PackIvaMode,
  type PackPricing,
} from '@/config/pack-pricing';
import type { PackId } from '@/config/pricing';

const pesos = (cents: number) => (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);

export function PackPrices({
  initial,
  fallback,
  termsStale,
}: {
  /** The saved value, or null when it can't be read (checkout is closed). */
  initial: PackPricing | null;
  /** What the form starts from when nothing valid is saved. */
  fallback: PackPricing;
  termsStale: boolean;
}) {
  const t = useTranslations('admin.settings');
  const start = initial ?? fallback;
  const [prices, setPrices] = useState<Record<PackId, string>>(
    () => Object.fromEntries(PACK_IDS.map((id) => [id, pesos(start.prices[id])])) as Record<PackId, string>,
  );
  const [mode, setMode] = useState<PackIvaMode>(start.ivaMode);
  const [rate, setRate] = useState(String(start.ivaRatePercent));
  const [msg, setMsg] = useState<string | null>(initial ? null : t('packsMissing'));
  const [stale, setStale] = useState(termsStale);
  const [pending, run] = useTransition();

  const draft = parsePackPricing({
    ivaMode: mode,
    ivaRatePercent: Number(rate),
    prices: Object.fromEntries(PACK_IDS.map((id) => [id, pesosToCents(prices[id]) ?? NaN])),
  });

  return (
    <div className="ch-row" style={{ display: 'grid', gap: 12, alignItems: 'start' }}>
      <span className="ch-row__tx">
        <b>{t('packs')}</b>
        <small>{t('packsHelp')}</small>
        <small>{t('currencyNote')}</small>
      </span>
      <form
        style={{ display: 'grid', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft) {
            setMsg(t('packsInvalid'));
            return;
          }
          run(async () => {
            const r = await setPackPrices(draft);
            if (r.ok) setStale(r.termsStale);
            setMsg(r.ok ? t('saved') : r.code === 'INVALID' ? t('packsInvalid') : t('saveError'));
          });
        }}
      >
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          <legend style={{ fontWeight: 600, marginBottom: 4 }}>{t('ivaLegend')}</legend>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="pack-iva"
              value="included"
              checked={mode === 'included'}
              disabled={pending}
              onChange={() => setMode('included')}
            />
            {t('ivaIncluded')}
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="pack-iva"
              value="add"
              checked={mode === 'add'}
              disabled={pending}
              onChange={() => setMode('add')}
            />
            {t('ivaAdd')}
          </label>
          {mode === 'add' && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 26 }}>
              {t('ivaRate')}
              <input
                type="number"
                min={0}
                max={MAX_IVA_RATE_PERCENT}
                step={1}
                inputMode="numeric"
                value={rate}
                disabled={pending}
                onChange={(e) => setRate(e.target.value)}
                style={{ width: 64, textAlign: 'right' }}
              />
              <span aria-hidden="true">%</span>
            </label>
          )}
        </fieldset>

        {PACK_IDS.map((id) => {
          const cents = pesosToCents(prices[id]);
          const total =
            draft ? packTotalCents(draft, id) : cents !== null && mode === 'included' ? cents : null;
          return (
            <div key={id} style={{ display: 'grid', gap: 4 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ minWidth: 180 }}>{t(`packName.${id}`)}</span>
                <span aria-hidden="true">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={prices[id]}
                  disabled={pending}
                  aria-label={t(`packName.${id}`)}
                  onChange={(e) => setPrices((p) => ({ ...p, [id]: e.target.value }))}
                  style={{ width: 110, textAlign: 'right' }}
                />
                <span>MXN</span>
              </label>
              {total !== null && (
                <small className="ch-muted">{t('packTotal', { monto: formatMXN(total) })}</small>
              )}
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="ch-btn ch-btn--secondary ch-btn--compact" disabled={pending}>
            {t('packsSave')}
          </button>
          {msg && <small role="status">{msg}</small>}
        </div>
        {stale && (
          <small role="alert" style={{ color: 'var(--danger, #b42318)' }}>
            {t('termsStale')}
          </small>
        )}
      </form>
    </div>
  );
}
