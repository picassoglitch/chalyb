import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Info } from 'lucide-react';
import { requireTool } from '@/lib/tools/access';
import { getPronosticos } from '@/lib/tools/registry';
import { WizardShell } from '@/components/ui/wizard-shell';
import { RiskGate } from '@/components/app/tools/risk-gate';
import { Pill } from '@/components/ui/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forecasts');
  return { title: t('metaTitle') };
}

// Pronósticos (P3-9): today's picks, explained simply. Informative only — no
// odds, no stakes, no links to betting sites; the footer is fixed.

export default async function PronosticosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { adapter, riskPending } = await requireTool(locale, 'chalybpicks', '/app/herramientas/pronosticos', getPronosticos);
  const t = await getTranslations('forecasts');
  const tw = await getTranslations('wizard');
  const list = riskPending ? [] : await adapter.today();
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  return (
    <WizardShell slug="chalybpicks" toolName="Pronósticos" backHref="/app/herramientas" backLabel={tw('back')} closeLabel={tw('close')}>
      {riskPending && <RiskGate slug="chalybpicks" toolName="Pronósticos" />}
      <div style={{ display: 'grid', gap: 22 }}>
        <header>
          <h1 className="ch-h1">{t('title')}</h1>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        {list.length === 0 ? (
          <p className="ch-card" style={{ padding: 20 }}>{t('empty')}</p>
        ) : (
          <ul className="ch-clips" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {list.map((f) => (
              <li key={f.id} className="ch-card" style={{ padding: 18, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontSize: 19 }}>{f.match}</b>
                  <span className="ch-muted" style={{ fontSize: 15 }}>{time(f.at)}</span>
                </div>
                <p style={{ fontSize: 18 }}>{f.forecast}</p>
                <Pill kind={f.confidence === 'high' ? 'acc' : 'gray'}>{t(`confidence.${f.confidence}`)}</Pill>
                <details>
                  <summary className="ch-lnk" style={{ cursor: 'pointer' }}>{t('why')}</summary>
                  <p style={{ marginTop: 6 }}>{f.why}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
        <div className="ch-disc" role="note">
          <span className="ch-disc__ic" aria-hidden="true"><Info /></span>
          <p>{t('footer')}</p>
        </div>
      </div>
    </WizardShell>
  );
}
