import { useTranslations } from 'next-intl';

const STACK = ['AWS', 'Supabase', 'OpenAI', 'Anthropic', 'Mercado Pago'];
const METRIC_VALUES = ['99.9%', '24/7', '< 1 min', 'MX · USA'];

/** Single credibility strip under the hero: four metrics + the stack. */
export function ProofBar() {
  const t = useTranslations('landing.proof');

  return (
    <section className="lp-proof" aria-label={t('label')}>
      <div className="lp-container lp-proof-inner">
        <div className="lp-metrics">
          {METRIC_VALUES.map((value, i) => (
            <div key={value} className="lp-metric">
              <div className="lp-metric-val">{value}</div>
              <div className="lp-metric-label">{t(`metrics.${i + 1}`)}</div>
            </div>
          ))}
        </div>
        <div className="lp-stack">
          <span className="lp-stack-label">{t('stack')}</span>
          {STACK.map((name) => (
            <span key={name} className="lp-chip">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
