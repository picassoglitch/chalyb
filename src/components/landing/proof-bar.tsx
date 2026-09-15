import { useTranslations } from 'next-intl';
import { KIT_TOOLS } from '@/lib/kit/tools';
import type { PublicFleet } from '@/lib/data/public-engines';

const STACK = ['Vercel', 'Supabase', 'Google Cloud', 'Anthropic', 'Mercado Pago'];

/** Single credibility strip under the hero: how the kit works, in numbers
 *  that are true today (one subscription, N tools, zero bought separately),
 *  plus the stack. No uptime or speed claims the app cannot back. */
export function ProofBar({ fleet }: { fleet: PublicFleet }) {
  const t = useTranslations('landing.proof');
  const toolCount = fleet.engines.length > 0 ? fleet.engines.length : KIT_TOOLS.length;
  const metrics = ['1', String(toolCount), '0', 'MX · USA'];

  return (
    <section className="lp-proof" aria-label={t('label')}>
      <div className="lp-container lp-proof-inner">
        <div className="lp-metrics">
          {metrics.map((value, i) => (
            <div key={`${i}-${value}`} className="lp-metric">
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
