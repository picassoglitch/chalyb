// Request parsing for /api/tools/chalybclip/** (WS-11). Pure: whatever the
// client sends is cleaned or dropped here, so the adapter only ever sees
// values a screen could have produced.

import {
  CAPTION_PRESETS,
  CLIP_FORMATS,
  SOCIAL_PLATFORMS,
  type ClipDetail,
  type ClipPatch,
  type ClipsSettings,
  type SocialPlatform,
} from './adapters/types';
import { clampTrim, cleanTitle } from './clips-home';
import { TIER_CAPS } from '@/lib/billing/tiers';
import type { SubscriptionTier } from '@/lib/auth/session';

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}

/** The plan doesn't include connecting social accounts (TIER_CAPS
 *  clipConnectSocials): connect and publish answer 403 NEEDS_PLAN. */
export class NeedsPlanError extends Error {
  readonly code = 'NEEDS_PLAN';
}

/** Whether a plan may connect social accounts and publish to them. */
export function socialsAllowed(plan: SubscriptionTier): boolean {
  return TIER_CAPS[plan]?.clipConnectSocials === true;
}

export function parseClipPatch(
  body: unknown,
  clip: Pick<ClipDetail, 'sourceDurationSec'>,
): ClipPatch {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: ClipPatch = {};
  if (typeof b.title === 'string') {
    const t = cleanTitle(b.title);
    if (t) out.title = t;
  }
  if (typeof b.captionsOn === 'boolean') out.captionsOn = b.captionsOn;
  if (typeof b.format === 'string' && (CLIP_FORMATS as readonly string[]).includes(b.format))
    out.format = b.format as ClipPatch['format'];
  const trim = b.trim as Record<string, unknown> | undefined;
  if (trim && typeof trim.startS === 'number' && typeof trim.endS === 'number')
    out.trim = clampTrim({ startS: trim.startS, endS: trim.endS }, clip.sourceDurationSec);
  return out;
}

export function parseSettings(body: unknown, prev: ClipsSettings): ClipsSettings {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const next = { ...prev };
  if (typeof b.captionsOn === 'boolean') next.captionsOn = b.captionsOn;
  if (b.captionLang === 'es' || b.captionLang === 'en') next.captionLang = b.captionLang;
  if (
    typeof b.captionPreset === 'string' &&
    (CAPTION_PRESETS as readonly string[]).includes(b.captionPreset)
  )
    next.captionPreset = b.captionPreset as ClipsSettings['captionPreset'];
  if (typeof b.watermarkOn === 'boolean') next.watermarkOn = b.watermarkOn;
  if (b.duration === 'auto') next.duration = 'auto';
  else if (
    typeof b.duration === 'number' &&
    Number.isInteger(b.duration) &&
    b.duration >= 15 &&
    b.duration <= 60
  )
    next.duration = b.duration;
  if (b.framing === 'center' || b.framing === 'follow') next.framing = b.framing;
  return next;
}

export function parsePlatform(raw: unknown): SocialPlatform | null {
  return typeof raw === 'string' && (SOCIAL_PLATFORMS as readonly string[]).includes(raw)
    ? (raw as SocialPlatform)
    : null;
}
