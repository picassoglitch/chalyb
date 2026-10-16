import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getCalibration, getMe } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.calibration');
  return { title: t('metaTitle') };
}

// ¿Qué tan bien acierta tu IA? (mode "a"): per platform, how the score the
// AI gives a clip matches the views it really gets (last 30 days).

export default async function ClipsCalibrationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/ajustes/calibracion');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) =>
    Promise.all([getCalibration(e, signal), getMe(e, signal)]),
  );
  if (!res.ok) return <ClipsReadError error={res.error} tab="settings" />;
  const [{ reports }, me] = res.data;
  const t = await getTranslations('clipsEngine.calibration');
  const nf = new Intl.NumberFormat(locale);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const verdict = (r: number | null) =>
    r == null
      ? t('verdict.none')
      : r >= 0.6
        ? t('verdict.good')
        : r >= 0.3
          ? t('verdict.mid')
          : t('verdict.bad');

  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack">
        <SettingsNav current="/app/clips/ajustes/calibracion" admin={me.is_admin} />
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        <div className="ch-ce-kpis">
          {reports.map((r) => (
            <div key={r.platform} className="ch-ce-kpi">
              <small>
                {t(`platform.${r.platform}`)} · {t('paired', { n: r.n_paired })}
              </small>
              <b>
                {r.pearson_r == null
                  ? '—'
                  : `r = ${r.pearson_r >= 0 ? '+' : ''}${r.pearson_r.toFixed(3)}`}
              </b>
              <small>{verdict(r.pearson_r)}</small>
            </div>
          ))}
        </div>
        {reports
          .filter((r) => r.rows.length > 0)
          .map((r) => (
            <section
              key={r.platform}
              className="ch-card ch-ce-card"
              aria-label={t(`platform.${r.platform}`)}
            >
              <h3 className="ch-h3">{t('perClip', { plataforma: t(`platform.${r.platform}`) })}</h3>
              <div className="ch-ce-tablewrap">
                <table className="ch-ce-table">
                  <thead>
                    <tr>
                      <th>{t('col.clip')}</th>
                      <th className="ch-ce-num">{t('col.score')}</th>
                      <th className="ch-ce-num">{t('col.views')}</th>
                      <th className="ch-ce-num">{t('col.likes')}</th>
                      <th>{t('col.when')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((row) => (
                      <tr key={`${row.clip_id}-${row.fetched_at}`}>
                        <td>{row.clip_id}</td>
                        <td className="ch-ce-num">
                          {row.rescore_score == null ? '—' : row.rescore_score.toFixed(3)}
                        </td>
                        <td className="ch-ce-num">
                          {row.views == null ? '—' : nf.format(row.views)}
                        </td>
                        <td className="ch-ce-num">
                          {row.likes == null ? '—' : nf.format(row.likes)}
                        </td>
                        <td>{row.fetched_at ? fmt.format(new Date(row.fetched_at)) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
      </div>
    </ToolShell>
  );
}
