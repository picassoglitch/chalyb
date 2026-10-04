import { getTranslations } from 'next-intl/server';
import { Briefcase, Clapperboard, Globe, Heart, Radio, ShieldCheck, CircleCheck, type LucideIcon } from 'lucide-react';
import type { PublicTool } from '@/lib/tools/public-tools';
import { SectionHead } from './section-head';

// 5 · Para quién (LANDING-SPEC §3.6). A card that depends on a tool shows
// only while that tool is active; "Tu mamá también" always does. No photos
// of people.

type Key = 'streamers' | 'creators' | 'business' | 'mom';
const ICONS: Record<Key, LucideIcon> = {
  streamers: Radio,
  creators: Clapperboard,
  business: Briefcase,
  mom: Heart,
};

export function audienceKeys(tools: readonly PublicTool[]): Key[] {
  const has = (s: string) => tools.some((t) => t.slug === s);
  return [
    ...(has('chalybclip') || has('chalybobs') ? (['streamers'] as const) : []),
    ...(has('chalybclip') ? (['creators'] as const) : []),
    ...(has('chalybbot') ? (['business'] as const) : []),
    'mom',
  ];
}

export async function Audience({ tools }: { tools: PublicTool[] }) {
  const t = await getTranslations('landing.who');
  const strip: [LucideIcon, string][] = [
    [Globe, t('strip1')],
    [ShieldCheck, t('strip2')],
    [CircleCheck, t('strip3')],
  ];
  return (
    <section className="pub-band" aria-labelledby="who-title">
      <div className="pub-wrap">
        <SectionHead id="who-title" label={t('label')} title={t('title')} sub={t('sub')} />
        <ul className="pub-aud">
          {audienceKeys(tools).map((k) => {
            const Icon = ICONS[k];
            return (
              <li key={k} className={`pub-aud__c${k === 'mom' ? ' pub-aud__c--mom' : ''}`}>
                <span className="pub-aud__ic" aria-hidden="true">
                  <Icon />
                </span>
                <h3>{t(k)}</h3>
                <p>{t(`${k}P`)}</p>
              </li>
            );
          })}
        </ul>
        <ul className="pub-strip">
          {strip.map(([Icon, label]) => (
            <li key={label}>
              <Icon aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
