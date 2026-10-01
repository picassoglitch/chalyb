// The error state for a failed or refused Clips job (BUILD-SPEC §7.6, mockup
// 24): one sentence that says what happened, "No se usaron créditos." when
// nothing was charged, one primary action, and a person to talk to.

import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { ClipFailureReason } from '@/lib/tools/adapters/types';
import { creditsRenewDate, platformName } from '@/lib/tools/clips-copy';

export async function ClipError({
  reason,
  sourceUrl,
}: {
  reason: ClipFailureReason;
  sourceUrl?: string;
}) {
  const t = await getTranslations('clips.error');
  const locale = await getLocale();

  let title = t('title');
  let body: string;
  let primary: { href: string; label: string } = { href: '/app/clips', label: t('retry') };
  switch (reason) {
    case 'link_private':
      title = t('link.title');
      body = t('link.body');
      break;
    case 'link_unsupported':
      body = t('unsupported');
      break;
    case 'video_too_long':
      // TODO(owner) Q13: PRICING.maxVideoHours is undecided, so the limit is
      // not stated.
      body = t('tooLong');
      break;
    case 'no_credits':
      body = t('noCredits', { fecha: creditsRenewDate(new Date(), locale) });
      primary = { href: '/app/billing', label: t('seePlan') };
      break;
    case 'platform_down':
      body = t('platform', { plataforma: platformName(sourceUrl) ?? t('platformFallback') });
      break;
    default:
      body = t('unknown');
  }

  return (
    <section role="alert" aria-labelledby="clip-error-title" style={{ maxWidth: 640 }}>
      <h1 id="clip-error-title" style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
        {title}
      </h1>
      <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--cc-txt-2)' }}>{body}</p>
      <p style={{ fontSize: 16, marginTop: 10, color: 'var(--cc-txt-2)' }}>{t('noCharge')}</p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
        <Link href={primary.href as Route} style={primaryButton}>
          {primary.label}
        </Link>
        <Link href={'/app/help' as Route} style={helpButton}>
          {t('help')}
        </Link>
      </div>
    </section>
  );
}

const primaryButton = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 60,
  padding: '0 28px',
  borderRadius: 16,
  background: 'var(--cc-green)',
  color: '#070809',
  fontWeight: 600,
  fontSize: 18,
  textDecoration: 'none',
} as const;

const helpButton = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 60,
  padding: '0 24px',
  borderRadius: 16,
  border: '1px solid var(--cc-line-2)',
  color: 'var(--cc-txt)',
  fontSize: 17,
  textDecoration: 'none',
} as const;
