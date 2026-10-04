'use server';

// "Crear mis clips" (paso 2 → creando). Access is checked again here, on the
// server, whatever the page showed.

import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { submitClips } from './clips-jobs';
import { getClipsAdapter } from './adapters/clips';
import { parseClipOptions } from './clips-options';
import { planClipLinks } from './clips-links';
import { isContentBlocked } from '@/lib/legal/legal-server';
import {
  CLIP_COUNTS,
  CLIP_FORMATS,
  manualRetryAllowed,
  type ClipCount,
  type ClipFormat,
} from './adapters/types';
import { logAudit } from '@/lib/audit/log';

export async function createClipJob(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/clips/nuevo', locale });

  const entitlements = await getEntitlements(session);
  if (entitlements.tools.chalybclip?.state !== 'included') {
    return redirect({ href: '/app/clips', locale });
  }

  // Every link, extras included, is checked for the re-upload block before
  // any job starts (clips-links.ts).
  const plan = await planClipLinks(
    String(formData.get('link') ?? ''),
    formData.get('more'),
    isContentBlocked,
  );
  if (!plan.ok) return redirect({ href: `/app/clips/nuevo?error=${plan.reason}`, locale });
  const [first, ...extras] = plan.links;

  const formatRaw = String(formData.get('format') ?? 'vertical');
  const format: ClipFormat = (CLIP_FORMATS as readonly string[]).includes(formatRaw)
    ? (formatRaw as ClipFormat)
    : 'vertical';
  const countRaw = Number(formData.get('count') ?? 6);
  const count: ClipCount = (CLIP_COUNTS as readonly number[]).includes(countRaw)
    ? (countRaw as ClipCount)
    : 6;

  const options = parseClipOptions((k) => formData.get(k));
  const result = await submitClips({
    userId: session.user.id,
    sourceUrl: first!,
    format,
    count,
    options,
  });
  if (!result) return redirect({ href: '/app/clips', locale });
  if (!result.ok) return redirect({ href: `/app/clips/nuevo?error=${result.reason}`, locale });

  // "Subir varios videos a la vez": the same settings for each extra link
  // (already checked: readable and not blocked); the user sees every job in
  // Mis resultados.
  let started = 0;
  for (const url of extras) {
    const r = await submitClips({
      userId: session.user.id,
      sourceUrl: url,
      format,
      count,
      options,
    });
    if (r?.ok) started += 1;
  }
  if (started > 0) return redirect({ href: '/app/history', locale });
  return redirect({ href: `/app/clips/trabajo/${encodeURIComponent(result.jobId)}`, locale });
}

/** "Intentar otra vez" on a failed row of Clips' home (TOOLS-SPEC §4.1):
 *  resubmits the same job in place, then back to the home. */
export async function retryClipJob(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/clips', locale });
  const entitlements = await getEntitlements(session);
  const adapter = getClipsAdapter();
  if (entitlements.tools.chalybclip?.state === 'included' && adapter) {
    const jobId = String(formData.get('jobId') ?? '').slice(0, 120);
    const job = jobId ? await adapter.getJob(session.user.id, jobId) : null;
    if (job && manualRetryAllowed(job)) {
      await adapter.retryJob(session.user.id, job.id, { manual: true });
      await logAudit({
        action: 'clips.job_retry',
        actorId: session.user.id,
        targetUserId: session.user.id,
        metadata: { job_id: job.id, manual_retry: (job.manualRetries ?? 0) + 1 },
      });
    }
  }
  return redirect({ href: '/app/clips', locale });
}
