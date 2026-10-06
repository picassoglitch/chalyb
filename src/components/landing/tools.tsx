import type { Route } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Check, Info } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { PublicTool, ToolSlug } from '@/lib/tools/public-tools';
import { ToolTile } from './tool-tile';
import { claimKey } from './claims';
import { SectionHead } from './section-head';

// 2 · "Todo en un solo plan" (#herramientas, LANDING-SPEC §3.3). A bento of
// the ACTIVE tools only: a hidden tool's card disappears and the "todo
// incluido" card takes the rest of its row. En vivo and Asistente share one
// card when both are active. Señales, Pronósticos and Inversiones carry
// their notice as visible text, never a tooltip.

const FIN = new Set<ToolSlug>(['chalybcrypto', 'chalybtrade']);
const BETS = new Set<ToolSlug>(['chalybpicks']);

// Decorative AI-generated art (public/landing/tool-*.webp) on the cards
// without screenshots; Clips keeps its three stills.
const ART: Partial<Record<ToolSlug, string>> = {
  chalybcrypto: 'senales',
  chalybobs: 'envivo',
  chalybbot: 'envivo',
  chalybpicks: 'pronosticos',
  chalybtrade: 'inversiones',
};

function CardArt({ slug }: { slug: ToolSlug }) {
  const name = ART[slug];
  if (!name) return null;
  return (
    <span className="pub-bc__art" aria-hidden="true">
      <Image
        src={`/landing/tool-${name}.webp`}
        alt=""
        fill
        sizes="(max-width: 767px) 100vw, (max-width: 1099px) 50vw, 360px"
        loading="lazy"
      />
    </span>
  );
}

type Card =
  | { kind: 'tool'; tool: PublicTool }
  | { kind: 'pair'; tools: [PublicTool, PublicTool] };

/** Cards in the spec's order; En vivo + Asistente merge when both exist. */
export function bentoCards(tools: readonly PublicTool[]): Card[] {
  const has = (s: ToolSlug) => tools.find((t) => t.slug === s);
  const live = has('chalybobs');
  const bot = has('chalybbot');
  const cards: Card[] = [];
  for (const tool of tools) {
    if (tool.slug === 'chalybobs' && bot) {
      cards.push({ kind: 'pair', tools: [tool, bot] });
      continue;
    }
    if (tool.slug === 'chalybbot' && live) continue;
    cards.push({ kind: 'tool', tool });
  }
  return cards;
}

/** Columns the "todo incluido" card spans: whatever its row has left
 *  (Clips takes 2 of the first row's 3). */
export function allCardSpan(cards: readonly Card[]): number {
  let used = 0;
  cards.forEach((c, i) => {
    used += i === 0 && c.kind === 'tool' && c.tool.slug === 'chalybclip' ? 2 : 1;
  });
  const left = 3 - (used % 3);
  return left === 1 ? 1 : left === 3 ? 3 : 2;
}

export async function ToolsSection({
  tools,
  claimAll,
  trialHref,
  ctaLabel,
}: {
  tools: PublicTool[];
  claimAll: boolean;
  trialHref: Route;
  ctaLabel: string;
}) {
  const t = await getTranslations('landing.tools');
  const cards = bentoCards(tools);
  const span = allCardSpan(cards);

  const legal = (slug: ToolSlug) =>
    FIN.has(slug) ? t('legalFin') : BETS.has(slug) ? t('legalBets') : null;
  const included = claimAll && (
    <span className="pub-bc__inc">
      <Check aria-hidden="true" />
      {t('included')}
    </span>
  );

  return (
    <section id="herramientas" className="pub-band pub-band--white" aria-labelledby="tools-title">
      <div className="pub-wrap">
        <SectionHead
          id="tools-title"
          label={t('label')}
          title={t(claimKey('toolsTitle', claimAll))}
          sub={t(claimKey('toolsSub', claimAll))}
        />
        <ul className="pub-bento">
          {cards.map((c, i) => {
            // Without the "todo incluido" card, the last card fills its row.
            const fill =
              !claimAll && i === cards.length - 1 && span < 3
                ? { className: ' pub-bc--fill', style: { ['--span' as string]: span + 1 } }
                : { className: '', style: undefined };
            if (c.kind === 'pair') {
              return (
                <li key="pair" className={`pub-bc${fill.className}`} style={fill.style}>
                  <CardArt slug={c.tools[0].slug} />
                  <span className="pub-bc__pair">
                    <ToolTile slug={c.tools[0].slug} color={c.tools[0].color} size={60} />
                    <ToolTile slug={c.tools[1].slug} color={c.tools[1].color} size={60} />
                  </span>
                  <h3>{t('liveBot')}</h3>
                  <p>{t('desc.liveBot')}</p>
                  {included}
                </li>
              );
            }
            const { tool } = c;
            const clips = tool.slug === 'chalybclip';
            const note = legal(tool.slug);
            return (
              <li
                key={tool.slug}
                className={`pub-bc${clips ? ' pub-bc--clips' : ''}${fill.className}`}
                style={fill.style}
              >
                {!clips && <CardArt slug={tool.slug} />}
                <div className="pub-bc__tx">
                  <ToolTile slug={tool.slug} color={tool.color} size={60} />
                  <h3>{tool.name}</h3>
                  <p>{t(`desc.${tool.slug}`)}</p>
                  {note && (
                    <p className="pub-bc__legal">
                      <Info aria-hidden="true" />
                      {note}
                    </p>
                  )}
                  {included}
                </div>
                {clips && (
                  <div className="pub-bc__thumbs" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={`pub-bc__thumb pub-bc__thumb--${n}`}>
                        <Image src={`/landing/clip-${n}.webp`} alt="" width={120} height={213} loading="lazy" />
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {claimAll && (
            <li className="pub-bc pub-bc--all" style={{ ['--span' as string]: span }}>
              <div>
                <h3>{t('allTitle')}</h3>
                <p>
                  <span className="pub-only-desk">{t('allBody')}</span>
                  <span className="pub-only-mob">{t('allBodyMobile')}</span>
                </p>
                <span className="pub-bc__icons" aria-hidden="true">
                  {tools.map((tool) => (
                    <ToolTile key={tool.slug} slug={tool.slug} color={tool.color} size={38} />
                  ))}
                </span>
              </div>
              <Link href={trialHref} className="ch-btn ch-btn--white" data-cta="tools_trial">
                {ctaLabel}
              </Link>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
