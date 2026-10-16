import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getLlmCalls } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.admin.calls');
  return { title: t('metaTitle') };
}

// Consumo de IA (engine admins only — the engine answers 404 to anyone
// else, and so does this page): every AI call with its USD cost, and the
// month's projection.

const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;

export default async function ClipsLlmCallsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/ajustes/consumo');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) => getLlmCalls(e, signal));
  if (!res.ok) {
    if (res.error.reason === 'not_found') notFound();
    return <ClipsReadError error={res.error} tab="settings" />;
  }
  const { calls, projection: p, total_usd_micros } = res.data;
  const t = await getTranslations('clipsEngine.admin.calls');
  const nf = new Intl.NumberFormat(locale);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' });

  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack">
        <SettingsNav current="/app/clips/ajustes/consumo" admin />
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        <div className="ch-ce-kpis">
          <div className="ch-ce-kpi">
            <b>{usd(p.today_micros)}</b>
            <small>{t('today')}</small>
          </div>
          <div className="ch-ce-kpi">
            <b>{usd(p.mtd_micros)}</b>
            <small>{t('mtd', { n: p.n_calls_mtd })}</small>
          </div>
          <div className="ch-ce-kpi">
            <b>{usd(p.projected_eom_micros)}</b>
            <small>{t('eom')}</small>
          </div>
          <div className="ch-ce-kpi">
            <b>{p.daily_budget_micros == null ? '—' : usd(p.daily_budget_micros)}</b>
            <small>
              {t('budget')}
              {p.budget_consumed_frac != null && ` · ${Math.round(p.budget_consumed_frac * 100)}%`}
            </small>
          </div>
        </div>
        <section className="ch-card ch-ce-card" aria-labelledby="a-calls">
          <h3 id="a-calls" className="ch-h3">
            {t('last', { n: calls.length, total: usd(total_usd_micros) })}
          </h3>
          <div className="ch-ce-tablewrap">
            <table className="ch-ce-table">
              <thead>
                <tr>
                  <th>{t('col.when')}</th>
                  <th>{t('col.purpose')}</th>
                  <th>{t('col.model')}</th>
                  <th className="ch-ce-num">{t('col.in')}</th>
                  <th className="ch-ce-num">{t('col.out')}</th>
                  <th className="ch-ce-num">{t('col.cost')}</th>
                  <th>{t('col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td>{fmt.format(new Date(c.ts))}</td>
                    <td>{c.purpose}</td>
                    <td>
                      {c.provider} · {c.model} ({c.quality})
                    </td>
                    <td className="ch-ce-num">{nf.format(c.input_tokens)}</td>
                    <td className="ch-ce-num">{nf.format(c.output_tokens)}</td>
                    <td className="ch-ce-num">{usd(c.cost_usd_micros)}</td>
                    <td>
                      {c.status}
                      {c.attempts > 1 ? ` ×${c.attempts}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ToolShell>
  );
}
