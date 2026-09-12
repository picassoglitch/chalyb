import { useTranslations } from 'next-intl';

interface Metric {
  value: string;
  label: string;
}

export function ProofBar() {
  const t = useTranslations('landing.proof');
  const metrics = t.raw('metrics') as Metric[];

  return (
    <section className="lp-proof" aria-label={t('label')}>
      <div className="lp-wrap lp-proof-inner">
        <p className="lp-proof-label">
          <i />
          {t('label')}
        </p>
        <ul className="lp-metrics">
          {metrics.map((m) => (
            <li key={m.label} className="lp-metric">
              <b>{m.value}</b>
              <span>{m.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
