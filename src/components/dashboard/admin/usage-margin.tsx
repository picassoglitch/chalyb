'use client';

// The margin charged on top of real provider cost when usage draws down a
// balance (docs/engines/consumption-contract.md).

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setUsageMargin } from '@/lib/admin/panel-actions';

export function UsageMargin({ initial }: { initial: number }) {
  const t = useTranslations('admin.settings');
  const [value, setValue] = useState(String(initial));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="ch-row">
      <span className="ch-row__tx">
        <b>{t('margin')}</b>
        <small>{t('marginHelp')}</small>
        {msg && <small role="status">{msg}</small>}
      </span>
      <form
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await setUsageMargin(Number(value));
            setMsg(r.ok ? t('saved') : t('saveError'));
          });
        }}
      >
        <input
          type="number"
          min={0}
          max={500}
          step={1}
          inputMode="numeric"
          value={value}
          disabled={pending}
          aria-label={t('margin')}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: 72, textAlign: 'right' }}
        />
        <span>%</span>
        <button
          type="submit"
          className="ch-btn ch-btn--secondary ch-btn--compact"
          disabled={pending}
        >
          {t('marginSave')}
        </button>
      </form>
    </div>
  );
}
