'use server';

// "Crear mis clips" (paso 2 → creando). Access is checked again here, on the
// server, whatever the page showed.

import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { submitClips } from './clips-jobs';
import { checkSourceUrl } from './adapters/run-job';
import { extraLinks, parseClipOptions } from './clips-options';
import { CLIP_COUNTS, CLIP_FORMATS, type ClipCount, type ClipFormat } from './adapters/types';

export async function createClipJob(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/clips', locale });

  const entitlements = await getEntitlements(session);
  if (entitlements.tools.chalybclip?.state !== 'included') {
    return redirect({ href: '/app/clips', locale });
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

  const options = parseClipOptions((k) => formData.get(k));
  const result = await submitClips({ userId: session.user.id, sourceUrl: link.url, format, count, options });
  if (!result) return redirect({ href: '/app/clips', locale });
  if (!result.ok) return redirect({ href: `/app/clips?error=${result.reason}`, locale });

  // "Subir varios videos a la vez": the same settings for each extra link.
  // A bad extra link is skipped (the first job already started); the user
  // sees every job in Mis resultados.
  const extras = extraLinks(formData.get('more'), link.url);
  let started = 0;
  for (const raw of extras) {
    const extra = checkSourceUrl(raw);
    if (!extra.ok) continue;
    const r = await submitClips({ userId: session.user.id, sourceUrl: extra.url, format, count, options });
    if (r?.ok) started += 1;
  }
  if (started > 0) return redirect({ href: '/app/history', locale });
  return redirect({ href: `/app/clips/${encodeURIComponent(result.jobId)}`, locale });
}
