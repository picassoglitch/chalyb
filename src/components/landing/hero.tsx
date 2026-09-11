'use client';

import { useTranslations } from 'next-intl';
import { usePath, type Path } from './use-path';

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

const TECH_CHIPS = [
  'AWS',
  'OpenAI',
  'Anthropic',
  'Stripe',
  'Supabase',
  'Next.js',
  'PostgreSQL',
  'LangChain',
];

export function Hero() {
  const tHero = useTranslations('hero');
  const tTrust = useTranslations('trust');
  const tDoor = useTranslations('door');
  const tPath = useTranslations('path');
  const tNeutral = useTranslations('neutral');
  const { path, setPath } = usePath();

  const kicker = path ? tPath(`${path}.kicker`) : tHero('kicker');
  const h1Lines = path ? (tPath.raw(`${path}.h1`) as string[]) : (tNeutral.raw('h1') as string[]);
  const lead = path ? tPath(`${path}.lead`) : tNeutral('lead');

  return (
    <header className="hero">
      <div className="hero-glow" />
      <div className="hero-kicker">
        <span>{kicker}</span>
      </div>
      <h1>
        {h1Lines.map((line, i) => (
          <span key={i} className="line">
            <span dangerouslySetInnerHTML={{ __html: line }} />
          </span>
        ))}
      </h1>
      <p className="hero-lead">{lead}</p>
      <div className="hero-ctas">
        <button type="button" className="btn-primary" onClick={() => scrollToId('contact')}>
          <span>{tHero('cta.primary')}</span>
          <span className="arrow">→</span>
        </button>
        <a
          className="btn-ghost"
          href="#proof"
          onClick={(e) => {
            e.preventDefault();
            scrollToId('proof');
          }}
        >
          <span>{tHero('cta.secondary')}</span>
        </a>
      </div>
      <div className="trust-strip">
        <span className="ts-label">{tTrust('label')}</span>
        {TECH_CHIPS.map((chip) => (
          <span key={chip} className="ts-chip">
            {chip}
          </span>
        ))}
      </div>
      <div className="doors">
        {(['client', 'partner', 'earn'] as Path[]).map((key) => (
          <button
            type="button"
            key={key}
            className="door"
            data-path={key}
            onClick={() => setPath(key, { scroll: true })}
          >
            <div className="d-num">{tDoor(`${key}.num`)}</div>
            <h3>{tDoor(`${key}.title`)}</h3>
            <p>{tDoor(`${key}.body`)}</p>
            <div className="d-go">
              <span>{tDoor(`${key}.go`)}</span> <span>→</span>
            </div>
          </button>
        ))}
      </div>
      <div className="scroll-hint">
        <div className="bar" />
        <span>{tHero('scroll')}</span>
      </div>
    </header>
  );
}
