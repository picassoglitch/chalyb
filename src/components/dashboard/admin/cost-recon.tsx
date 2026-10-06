// Dinero · what Anthropic billed vs. what our engines recorded (and so
// charged users), this month and last. Server component.

import { getTranslations } from 'next-intl/server';
import { reconcileAnthropic, type AnthropicRecon } from '@/lib/usage/reconciliation';

const usd = (micros: number) => `$${(micros / 1e6).toFixed(2)}`;

function Gap({ pct }: { pct: number | null }) {
  if (pct === null) return <>—</>;
  const tone = Math.abs(pct) <= 5 ? 'var(--ch-ok, inherit)' : 'var(--ch-bad, inherit)';
  return <span style={{ color: tone }}>{`${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}</span>;
}

async function Month({ recon, label }: { recon: AnthropicRecon; label: string }) {
  const t = await getTranslations('admin.money.recon');
  if (!recon.ok) {
    return (
      <p className="ch-card" style={{ padding: 16 }}>
        {label}: {t(`error.${recon.error}`)}
      </p>
    );
  }
  const total = recon.billedMicros > 0 ? ((recon.billedMicros - recon.recordedMicros) / recon.billedMicros) * 100 : null;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <h3 style={{ margin: 0 }}>
        {label}: {t('billed')} {usd(recon.billedMicros)} · {t('recorded')} {usd(recon.recordedMicros)} · <Gap pct={total} />
      </h3>
      <div className="ch-table-wrap">
        <table className="ch-table">
          <thead>
            <tr>
              <th scope="col">{t('model')}</th>
              <th scope="col" className="num">{t('billed')}</th>
              <th scope="col" className="num">{t('recorded')}</th>
              <th scope="col" className="num">{t('gap')}</th>
            </tr>
          </thead>
          <tbody>
            {recon.rows.map((r) => (
              <tr key={r.model}>
                <td>{r.model}</td>
                <td className="num">{usd(r.billedMicros)}</td>
                <td className="num">{usd(r.recordedMicros)}</td>
                <td className="num"><Gap pct={r.gapPct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recon.byWorkspace.length > 1 && (
        <p className="ch-muted">
          {t('workspaces')}: {recon.byWorkspace.map((w) => `${w.workspace} ${usd(w.micros)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

export async function CostRecon({ locale }: { locale: string }) {
  const t = await getTranslations('admin.money.recon');
  const now = new Date();
  const [cur, prev] = await Promise.all([reconcileAnthropic(now, 0), reconcileAnthropic(now, -1)]);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
  const label = (r: AnthropicRecon, fallback: string) => (r.ok ? fmt(r.start) : fallback);
  return (
    <section className="ch-section" aria-labelledby="recon-t">
      <h2 id="recon-t">{t('title')}</h2>
      <p className="ch-muted">{t('note')}</p>
      <Month recon={cur} label={label(cur, t('thisMonth'))} />
      <Month recon={prev} label={label(prev, t('lastMonth'))} />
    </section>
  );
}
