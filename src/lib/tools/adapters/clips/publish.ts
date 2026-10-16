// Zernio publishing over the engine's hub API (ChalyClip
// chalybclip/api/routers/hub_publish.py, under /api/hub/v1/publish).
//
// Two consumers:
//   * the ClipsAdapter contract (accounts / connectUrl / publishClip), used by
//     Ajustes and the clip detail's one-tap "Publicar en …";
//   * the Publish Center (/app/clips/publicar), which reaches the same engine
//     routes through the allowlisted BFF (publish-ops.ts, publish-route.ts).
// Every call goes through `engine(userId)` (client.ts): auth, errors and the
// breaker stay shared.

import 'server-only';
import { appUrl } from '@/lib/app-url';
import type { ClipsAdapter, ConnectedAccount, SocialPlatform } from '../types';
import { seg, type ClipsEngine } from './client';

export type PublishMethods = Pick<ClipsAdapter, 'accounts' | 'connectUrl' | 'publishClip'>;

/** Hub platforms Zernio connects and publishes to (Twitch and Kick: no), in
 *  display order. Screens that list connectable networks (Ajustes, home) read
 *  this; accounts/connectUrl/publishClip below are gated by the same list. */
export const CONNECT_PLATFORMS: readonly SocialPlatform[] = ['youtube', 'tiktok', 'facebook'];
const ZERNIO_PLATFORMS: ReadonlySet<SocialPlatform> = new Set(CONNECT_PLATFORMS);

interface AccountsJson {
  ok: boolean;
  accounts?: { platform: string; account_id: string }[];
}

/** Only back to a Clips screen of this app. */
export function safeClipsPath(next: unknown): string | null {
  return typeof next === 'string' && /^\/app\/clips(\/[\w-]*)*$/.test(next) ? next : null;
}

/** The hub page Zernio sends the OAuth window back to (the engine accepts
 *  only this origin). `next` is where a same-tab connect continues. */
export function publishReturnUrl(locale: string, next?: string | null): string {
  const prefix = locale === 'en' ? '/en' : '';
  const url = new URL(`${appUrl()}${prefix}/app/clips/publicar/conectado`);
  const path = safeClipsPath(next);
  if (path) url.searchParams.set('next', path);
  return url.toString();
}

export function publishMethods(engine: (userId: string) => ClipsEngine): PublishMethods {
  return {
    async accounts(userId, signal) {
      const res = await engine(userId).get<AccountsJson>('/publish/accounts.json', { signal });
      const out: ConnectedAccount[] = [];
      for (const a of res.accounts ?? []) {
        const p = String(a.platform).toLowerCase() as SocialPlatform;
        if (ZERNIO_PLATFORMS.has(p) && !out.some((x) => x.platform === p))
          out.push({ platform: p, handle: null, connected: true });
      }
      return out;
    },
    async connectUrl(userId, platform, returnTo, signal) {
      if (!ZERNIO_PLATFORMS.has(platform)) return null;
      const res = await engine(userId).post<{ ok: boolean; auth_url?: string }>(
        '/publish/connect',
        { platform, return_url: publishReturnUrl('es', returnTo) },
        { signal },
      );
      return res.auth_url ?? null;
    },
    async publishClip(userId, clipId, platform, signal) {
      if (!ZERNIO_PLATFORMS.has(platform)) return { ok: false };
      const e = engine(userId);
      // One tap posts what auto-publish would: the engine composes the hook
      // (title) + caption + hashtags + the person's signature.
      const composed = await e.post<{ ok: boolean; title?: string; caption?: string }>(
        `/publish/compose/${seg(clipId)}`,
        undefined,
        { signal },
      );
      const res = await e.post<{ ok: boolean; queued?: string }>(
        `/publish/post/${seg(clipId)}`,
        {
          platforms: [platform],
          mode: 'now',
          title: composed.title ?? '',
          description: composed.caption ?? '',
        },
        { signal },
      );
      return { ok: res.ok === true };
    },
  };
}
