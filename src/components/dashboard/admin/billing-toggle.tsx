'use client';

// P5-6 · the one pricing control that saves: Mensual next to Anual.

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setBillingToggle } from '@/lib/admin/panel-actions';
import { Switch } from '@/components/ui/switch';

export function BillingToggle({ initial }: { initial: boolean }) {
  const t = useTranslations('admin.settings');
  const [on, setOn] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="ch-row">
      <span className="ch-row__tx">
        <b>{t('toggle')}</b>
        <small>{t('toggleHelp')}</small>
        {msg && <small role="status">{msg}</small>}
      </span>
      <Switch
        checked={on}
        disabled={pending}
        label={t('toggle')}
        onChange={(next) =>
          start(async () => {
            const r = await setBillingToggle(next);
            if (r.ok) setOn(next);
            setMsg(r.ok ? t('saved') : t('saveError'));
          })
        }
      />
    </div>
  );
}
