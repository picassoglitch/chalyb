import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('termsUpdate.optionsPage');
  return { title: t('title') };
}

// aceptacion-ux §8 · "No acepto, ver opciones": what someone who doesn't
// accept the new Terms can do. None of it is blocked while the modal is
// pending (termsModalExempt covers every link here). Until they accept, the
// new version applies to no charge.
const OPTIONS = [
  { key: 'cancel', href: '/app/billing?cancelar=1' },
  { key: 'refund', href: '/app/messages' },
  { key: 'download', href: '/app/history' },
  { key: 'close', href: '/app/help' },
] as const;

export default async function TermsOptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('termsUpdate.optionsPage');
  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 720 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      <ul style={{ display: 'grid', gap: 14, listStyle: 'none', padding: 0, margin: 0 }}>
        {OPTIONS.map((o) => (
          <li key={o.key} className="ch-card" style={{ display: 'grid', gap: 8 }}>
            <h2 style={{ fontWeight: 700, fontSize: 19 }}>{t(`${o.key}.title`)}</h2>
            <p className="ch-muted">{t(`${o.key}.body`)}</p>
            <div>
              <ButtonLink href={o.href} variant="secondary" size="compact">
                {t(`${o.key}.cta`)}
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
