'use client';

// Herramientas (P5-5): one switch per tool. Hiding a tool paying users used
// in the last 30 days asks first (ConfirmStep, terms §7.3).

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { setToolIncidentAction, setToolVisible } from '@/lib/admin/panel-actions';
import { Switch } from '@/components/ui/switch';
import { Pill } from '@/components/ui/primitives';
import { ConfirmStep } from './confirm-step';

export interface ToolSwitchVM {
  slug: string;
  name: string;
  visible: boolean;
  health: 'ok' | 'slow' | 'down';
  failures24h: number;
  /** Tools inside the app only: whether an incident is open (WS-11). */
  incident?: boolean;
}

export function ToolSwitches({ tools }: { tools: ToolSwitchVM[] }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<{ slug: string; name: string; n: number } | null>(null);
  const [error, setError] = useState(false);

  const flip = (tool: ToolSwitchVM, confirmed = false) =>
    start(async () => {
      setError(false);
      const r = await setToolVisible(tool.slug, !tool.visible, confirmed);
      if (r.ok) {
        setAsk(null);
        router.refresh();
      } else if (r.code === 'CONFIRM_REQUIRED') setAsk({ slug: tool.slug, name: tool.name, n: r.payingUsers });
      else setError(true);
    });

  return (
    <>
      {error && <p role="alert" className="ch-card" style={{ padding: 14, color: 'var(--bad)' }}>{t('tools.err')}</p>}
      <ul className="ch-group" style={{ listStyle: 'none', margin: 0 }}>
        {tools.map((x) => (
          <li key={x.slug} className="ch-row">
            <span className="ch-row__tx">
              <b>
                {x.name} <span className="ch-muted">({x.slug})</span>
              </b>
              <small>
                {x.visible ? t('tools.visible') : t('tools.hidden')}
                {x.failures24h > 0 && ` · ${t('tools.failures', { n: x.failures24h })}`}
              </small>
            </span>
            {x.visible && <Pill kind={x.health === 'ok' ? 'ok' : x.health === 'slow' ? 'warn' : 'bad'}>{t(`home.health.${x.health}`)}</Pill>}
            {x.incident !== undefined && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                {t('tools.incident')}
                <Switch
                  checked={x.incident}
                  label={t('tools.incidentToggle', { herramienta: x.name })}
                  onChange={(next) =>
                    !pending &&
                    start(async () => {
                      const r = await setToolIncidentAction(x.slug, next);
                      if (r.ok) router.refresh();
                      else setError(true);
                    })
                  }
                />
              </label>
            )}
            <Switch checked={x.visible} label={t('tools.toggle', { herramienta: x.name })} onChange={() => !pending && flip(x)} />
          </li>
        ))}
      </ul>
      {ask && (
        <ConfirmStep
          open
          danger
          title={t('tools.confirm.q', { herramienta: ask.name })}
          body={t('tools.confirm.body', { n: ask.n })}
          yesLabel={t('tools.confirm.yes')}
          noLabel={t('tools.confirm.no')}
          onYes={() => flip(tools.find((x) => x.slug === ask.slug)!, true)}
          onNo={() => setAsk(null)}
        />
      )}
    </>
  );
}
