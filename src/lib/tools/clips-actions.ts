'use server';

// "Crear mis clips" (paso 2 → creando). Access is checked again here, on the
// server, whatever the page showed.

import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { submitClips } from './clips-jobs';
import { checkSourceUrl } from './adapters/run-job';
import { CLIP_COUNTS, CLIP_FORMATS, type ClipCount, type ClipFormat } from './adapters/types';

export async function createClipJob(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/clips', locale });

  const entitlements = await getEntitlements(session);
  if (entitlements.tools.chalybclip?.state !== 'included') {
    return redirect({ href: '/app/engines/chalybclip', locale });
  }

  const link = checkSourceUrl(String(formData.get('link') ?? ''));
  if (!link.ok) return redirect({ href: `/app/clips?error=${link.reason}`, locale });

  const formatRaw = String(formData.get('format') ?? 'vertical');
  const format: ClipFormat = (CLIP_FORMATS as readonly string[]).includes(formatRaw)
    ? (formatRaw as ClipFormat)
    : 'vertical';
  const countRaw = Number(formData.get('count') ?? 6);
  const count: ClipCount = (CLIP_COUNTS as readonly number[]).includes(countRaw)
    ? (countRaw as ClipCount)
    : 6;

  const result = await submitClips({ userId: session.user.id, sourceUrl: link.url, format, count });
  if (!result) return redirect({ href: '/app/clips', locale });
  if (!result.ok) return redirect({ href: `/app/clips?error=${result.reason}`, locale });
  return redirect({ href: `/app/clips/${encodeURIComponent(result.jobId)}`, locale });
}
