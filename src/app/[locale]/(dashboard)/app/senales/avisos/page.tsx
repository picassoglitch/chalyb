import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireTool } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { saveSignalPrefs } from '@/lib/tools/senales-actions';
import { WizardShell } from '@/components/ui/wizard-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signals');
  return { title: t('metaTitle') };
}

// Señales · paso 2: channels (only the ones the engine supports) and the
// advanced "Temporalidad y horario de avisos" — nothing about money.

export default async function SenalesStep2({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ coins?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, adapter, riskPending } = await requireTool(locale, 'chalybcrypto', '/app/senales', getSenales);
  if (riskPending) return redirect({ href: '/app/senales', locale });
  const { coins = '', error } = await searchParams;
  if (!coins) return redirect({ href: '/app/senales', locale });
  const t = await getTranslations('signals');
  const tw = await getTranslations('wizard');
  const [channels, prefs] = await Promise.all([adapter.channels(), adapter.getPrefs(session.user.id)]);
  const chosen = new Set(prefs?.channels ?? ['app']);
  return (
    <WizardShell slug="chalybcrypto" toolName="Señales" step={2} stepLabel={tw('step', { n: 2 })} backHref={`/app/senales`} backLabel={tw('back')} closeLabel={tw('close')} narrow>
      <form action={saveSignalPrefs} className="ch-center-col">
        <input type="hidden" name="coins" value={coins} />
        <fieldset className="ch-fieldset">
          <legend className="ch-h1">{t('s2.title')}</legend>
          <div style={{ display: 'grid', gap: 12, width: '100%' }}>
            {channels.map((c) => (
              <label key={c} className="ch-plan-opt">
                <input type="checkbox" name="channel" value={c} defaultChecked={chosen.has(c)} />
                <b style={{ fontSize: 19 }}>{t(`s2.${c}`)}</b>
              </label>
            ))}
          </div>
        </fieldset>
        {error === 'channels' && <p role="alert" style={{ color: 'var(--bad)' }}>{t('s2.none')}</p>}
        <details className="ch-card" style={{ padding: '14px 18px', width: '100%', textAlign: 'left' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>{t('adv.title')}</summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {t('adv.timeframe')}
              <select name="timeframe" className="ch-select" defaultValue={prefs?.timeframe ?? 'day'}>
                <option value="day">{t('adv.day')}</option>
                <option value="week">{t('adv.week')}</option>
              </select>
            </label>
            <label className="ch-check">
              <input type="checkbox" name="quiet" defaultChecked={prefs?.quietHours ?? false} />
              <span>{t('adv.quiet')}</span>
            </label>
          </div>
        </details>
        <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">
          {tw('continue')}
        </button>
      </form>
    </WizardShell>
  );
}
