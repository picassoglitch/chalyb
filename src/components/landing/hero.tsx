import type { Route } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { formatMXN } from '@/lib/billing/format';
import { Markup } from '@/components/ui/markup';
import { BrandMark } from './brand-mark';

// 1 · Hero (LANDING-SPEC §3.2, mockup 42). The only h1. The visual is the
// real app: the "Tus clips están listos" screen in a CSS laptop, Inicio in a
// CSS phone (no person's name on either), and the clips notification. Only
// the laptop image has priority (LCP).

export async function Hero({ trialHref, ctaLabel }: { trialHref: Route; ctaLabel: string }) {
  const t = await getTranslations('landing.hero');
  const cero = formatMXN(0);
  return (
    <section id="hero" className="pub-hero2" aria-labelledby="hero-title">
      <div className="pub-hero2__in">
        <div className="pub-hero2__copy">
          <p className="pub-kick">
            <span>{t('eyebrowTag')}</span>
            <span className="pub-only-desk">{t('eyebrow')}</span>
            <span className="pub-only-mob pub-kick__mob">{t('eyebrow')}</span>
          </p>
          <h1 id="hero-title">
            <Markup text={t.markup('title', { em: (c: string) => `<em>${c}</em>` })} />
          </h1>
          <p className="pub-hero2__sub">{t('sub')}</p>
          <Link href={trialHref} className="ch-btn ch-btn--primary pub-hero2__cta" data-cta="hero_trial">
            {ctaLabel}
            <ArrowRight aria-hidden="true" />
          </Link>
          <p className="pub-hero2__note">
            <b>{t('noteStrong')}</b> {t('noteRest', { cero })}
          </p>
          <ul className="pub-trust">
            {(['seal1', 'seal2', 'seal3'] as const).map((k) => (
              <li key={k}>
                <Check aria-hidden="true" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>

        <div className="pub-dev" role="img" aria-label={t('alt')}>
          <div className="pub-dev__halo" aria-hidden="true" />
          <div className="pub-laptop" aria-hidden="true">
            <div className="pub-laptop__screen">
              <Image
                src="/landing/hero-laptop.webp"
                alt=""
                width={1072}
                height={670}
                sizes="(max-width: 767px) 272px, (max-width: 1279px) 456px, 536px"
                priority
              />
            </div>
            <div className="pub-laptop__base" />
          </div>
          <div className="pub-phone" aria-hidden="true">
            <Image
              src="/landing/hero-phone.webp"
              alt=""
              width={400}
              height={866}
              sizes="(max-width: 767px) 108px, (max-width: 1279px) 170px, 200px"
              loading="eager"
            />
          </div>
          <div className="pub-notif" aria-hidden="true">
            <BrandMark size={44} />
            <div>
              <p className="pub-notif__top">
                <span>{t('notifApp')}</span>
                <span>{t('notifWhen')}</span>
              </p>
              <b>{t('notifTitle')}</b>
              <p>{t('notifBody')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
