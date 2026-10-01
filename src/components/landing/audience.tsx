import { getTranslations } from 'next-intl/server';
import { Briefcase, Check, Clapperboard, Radio, TrendingUp, type LucideIcon } from 'lucide-react';
import { supportWhatsappUrl } from '@/lib/config/flags';
import { audienceCards, type AudienceKey, type PublicTool } from '@/lib/tools/public-tools';
import { SectionHead } from './section-head';

// 5 · Para quién. Cards that depend on a tool appear only while it is active;
// the WhatsApp help claim only with SUPPORT_WHATSAPP_URL (P4-5).

const ICONS: Record<AudienceKey, LucideIcon> = {
  streamers: Radio,
  creators: Clapperboard,
  business: Briefcase,
  investors: TrendingUp,
};

export async function Audience({ tools }: { tools: PublicTool[] }) {
  const t = await getTranslations('landing.who');
  const strip = ['strip1', 'strip2', ...(supportWhatsappUrl() ? ['strip3'] : [])] as const;

  return (
    <section className="pub-band" aria-labelledby="who-title">
      <div className="pub-wrap">
        <SectionHead id="who-title" title={t('title')} sub={t('sub')} />
        <ul className="pub-aud">
          {audienceCards(tools).map((key) => {
            const Icon = ICONS[key];
            return (
              <li key={key} className="pub-au">
                <span className="pub-au__ic" aria-hidden="true">
                  <Icon />
                </span>
                <h3>{t(key)}</h3>
                <p>{t(`${key}P`)}</p>
              </li>
            );
          })}
        </ul>
        <ul className="pub-strip">
          {strip.map((k) => (
            <li key={k}>
              <Check aria-hidden="true" />
              {t(k)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
