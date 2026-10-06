import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { supportSlaConfirmed, supportWhatsappUrl } from '@/lib/config/flags';
import { toolHref } from '@/lib/tools/routes';
import { ButtonLink } from '@/components/ui/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('help');
  return { title: t('metaTitle') };
}

// Ayuda (SCR-25, P3-15; alias /app/ayuda): a person first, then five plain answers.
// The response-time promise is config (Q16, D6); WhatsApp shows only when
// SUPPORT_WHATSAPP_URL is set; a billing problem goes to the contact form
// tagged `cobro`.

const FAQ = ['clips', 'connect', 'credits', 'plan', 'charge'] as const;

export default async function AyudaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('help');
  const session = await getSessionUser();
  if (!session) return null;
  const ent = await getEntitlements(session);
  const wa = supportWhatsappUrl();
  const ctas: Partial<Record<(typeof FAQ)[number], { href: string; label: string }>> = {
    plan: { href: '/app/billing', label: t('q.planCta') },
    charge: { href: '/contacto?categoria=cobro', label: t('q.chargeCta') },
  };
  if (ent.tools.chalybclip?.state === 'included')
    ctas.clips = { href: toolHref('chalybclip'), label: t('q.clipsCta') };

  return (
    <div style={{ display: 'grid', gap: 26, maxWidth: 820 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>

      <section className="ch-human" aria-labelledby="human-t">
        <span className="ch-human__ic" aria-hidden="true">
          <MessageCircle />
        </span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 id="human-t" style={{ fontWeight: 700, fontSize: 20 }}>{t('human.title')}</h2>
          <p className="ch-muted" style={{ fontSize: 17 }}>{supportSlaConfirmed() ? t('human.sub') : t('human.subAlt')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {wa && (
            <a className="ch-btn ch-btn--ok ch-btn--compact" href={wa}>
              {t('human.whatsapp')}
            </a>
          )}
          <ButtonLink href="/app/messages" variant={wa ? 'secondary' : 'ok'} size="compact">
            {t('human.write')}
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="faq-t" style={{ display: 'grid', gap: 12 }}>
        <h2 id="faq-t" className="ch-h2">{t('faq')}</h2>
        {FAQ.map((k) => (
          <details key={k} className="ch-card ch-faq">
            <summary>{t(`q.${k}`)}</summary>
            <p>{t(`q.${k}A`)}</p>
            {ctas[k] && (
              <ButtonLink href={ctas[k]!.href} variant="secondary" size="compact">
                {ctas[k]!.label}
              </ButtonLink>
            )}
          </details>
        ))}
      </section>
    </div>
  );
}
