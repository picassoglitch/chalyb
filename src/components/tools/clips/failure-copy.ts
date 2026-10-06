// The reason sentence for a failed Clips job (BUILD-SPEC §7.6), shared by
// the home's amber row and the wizard's error screen copy.

import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { ClipFailureReason } from '@/lib/tools/adapters/types';
import { creditsRenewDate, platformName } from '@/lib/tools/clips-copy';

export async function failureBody(
  reason: ClipFailureReason,
  sourceUrl: string | undefined,
  locale: string,
): Promise<string> {
  const t = await getTranslations('clips.error');
  switch (reason) {
    case 'link_private':
      return t('link.body');
    case 'link_unsupported':
      return t('unsupported');
    case 'video_too_long':
      return t('tooLong');
    case 'no_credits':
      return t('noCredits', { fecha: creditsRenewDate(new Date(), locale) });
    case 'platform_down':
      return t('platform', { plataforma: platformName(sourceUrl) ?? t('platformFallback') });
    default:
      return t('unknown');
  }
}
