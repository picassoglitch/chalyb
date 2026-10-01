// The error state for a failed or refused Clips job (BUILD-SPEC §7.6, mockup
// 24): what happened in one sentence, "No se usaron créditos." when certain, one primary
// action, and a person to talk to.

import { getLocale, getTranslations } from 'next-intl/server';
import { TriangleAlert } from 'lucide-react';
import { ButtonLink } from '@/components/ui/primitives';
import type { ClipFailureReason } from '@/lib/tools/adapters/types';
import { creditsRenewDate, platformName } from '@/lib/tools/clips-copy';

export async function ClipError({
  reason,
  sourceUrl,
  noCharge,
}: {
  reason: ClipFailureReason;
  sourceUrl?: string;
  /** Show "No se usaron créditos." only when that's certain: the job was
   *  refused before it ran, or the adapter confirms failed jobs are free. */
  noCharge: boolean;
}) {
  const t = await getTranslations('clips.error');
  const locale = await getLocale();

  let title = t('title');
  let body: string;
  let primary = { href: '/app/clips', label: t('retry') };
  switch (reason) {
    case 'link_private':
      title = t('link.title');
      body = t('link.body');
      break;
    case 'link_unsupported':
      body = t('unsupported');
      break;
    case 'video_too_long':
      // TODO(owner) Q13: PRICING.maxVideoHours is undecided, so no limit is stated.
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
    <section role="alert" aria-labelledby="clip-error-title" className="ch-card ch-state">
      <span
        className="ch-state__ic"
        style={{ background: 'var(--bad-tint)', color: 'var(--bad)' }}
        aria-hidden="true"
      >
        <TriangleAlert />
      </span>
      <h1 id="clip-error-title" className="ch-h2">
        {title}
      </h1>
      <p className="ch-muted" style={{ maxWidth: 520 }}>
        {body}
      </p>
      {noCharge && <p style={{ fontWeight: 600 }}>{t('noCharge')}</p>}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 6,
        }}
      >
        <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
        <ButtonLink href="/app/help" variant="ok">
          {t('help')}
        </ButtonLink>
      </div>
    </section>
  );
}
