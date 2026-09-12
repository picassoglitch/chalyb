import { useTranslations } from 'next-intl';
import { CheckIcon } from './mock-bits';
import {
  ClipVisual,
  SignalVisual,
  StreamVisual,
  type ClipVisualData,
  type SignalVisualData,
  type StreamVisualData,
} from './pillar-visuals';

interface Pillar {
  tag: string;
  title: string;
  body: string;
  bullets: string[];
  visual: ClipVisualData | StreamVisualData | SignalVisualData;
}

// Exactly three pillars, alternating copy/visual columns. The visuals are
// matched to the message array by position, so the order in messages/*.json
// (clip, stream, signals) is load-bearing.
export function Pillars() {
  const t = useTranslations('landing.pillars');
  const items = t.raw('items') as Pillar[];
  const [clip, stream, signal] = items;

  const visuals = [
    clip && <ClipVisual v={clip.visual as ClipVisualData} />,
    stream && <StreamVisual v={stream.visual as StreamVisualData} />,
    signal && <SignalVisual v={signal.visual as SignalVisualData} />,
  ];

  return (
    <section className="lp-section" id="engines">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <p className="lp-kicker">{t('kicker')}</p>
          <h2>{t('title')}</h2>
          <p>{t('desc')}</p>
        </div>
        <div className="lp-pillars">
          {items.map((item, i) => (
            <article key={item.tag} className="lp-pillar">
              <div className="lp-pillar-copy">
                <p className="lp-pillar-tag">{item.tag}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <ul className="lp-checks">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>
                      <CheckIcon />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lp-pillar-visual">{visuals[i]}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
