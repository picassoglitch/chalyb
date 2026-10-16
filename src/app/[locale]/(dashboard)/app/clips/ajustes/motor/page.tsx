import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getLlmSettings } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.admin.llm');
  return { title: t('metaTitle') };
}

// Cómo trabaja tu IA (engine admins): read-only view of the engine's
// config/llm.yaml — providers and which model does what.

export default async function ClipsLlmSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/ajustes/motor');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) => getLlmSettings(e, signal));
  if (!res.ok) {
    if (res.error.reason === 'not_found') notFound();
    return <ClipsReadError error={res.error} tab="settings" />;
  }
  const { providers, routing } = res.data;
  const t = await getTranslations('clipsEngine.admin.llm');
  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack">
        <SettingsNav current="/app/clips/ajustes/motor" admin />
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        <section className="ch-card ch-ce-card" aria-labelledby="m-prov">
          <h3 id="m-prov" className="ch-h3">
            {t('providers')}
          </h3>
          <div className="ch-ce-tablewrap">
            <table className="ch-ce-table">
              <thead>
                <tr>
                  <th>{t('col.service')}</th>
                  <th>{t('col.standard')}</th>
                  <th>{t('col.premium')}</th>
                  <th className="ch-ce-num">{t('col.timeout')}</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <b>{p.name}</b> <span className="ch-muted">({p.kind})</span>
                    </td>
                    <td>{p.standard}</td>
                    <td>{p.premium ?? '—'}</td>
                    <td className="ch-ce-num">{p.timeout_s == null ? '—' : `${p.timeout_s} s`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="ch-card ch-ce-card" aria-labelledby="m-route">
          <h3 id="m-route" className="ch-h3">
            {t('routing')}
          </h3>
          <div className="ch-ce-tablewrap">
            <table className="ch-ce-table">
              <thead>
                <tr>
                  <th>{t('col.purpose')}</th>
                  <th>{t('col.quality')}</th>
                  <th>{t('col.primary')}</th>
                  <th>{t('col.fallbacks')}</th>
                </tr>
              </thead>
              <tbody>
                {routing.map((r) => (
                  <tr key={r.purpose}>
                    <td>{r.purpose}</td>
                    <td>{r.default_quality}</td>
                    <td>{r.primary}</td>
                    <td>{r.fallbacks.join(', ') || '—'}</td>
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
