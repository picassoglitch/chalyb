// POST /api/tools/chalybclip/connect {platform, returnTo, locale} — the
// "Conectar {plataforma}" button of ConnectAccountSheet (aceptacion-ux §7).
// Records social_connect with the text the sheet showed, then hands back
// the engine's OAuth URL for a SAME-TAB redirect that returns to returnTo.

import { getTranslations } from 'next-intl/server';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { NotFoundError, parsePlatform } from '@/lib/tools/clips-bff';
import { recordToolConsent } from '@/lib/tools/consents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NAMES = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  tiktok: 'TikTok',
  kick: 'Kick',
  facebook: 'Facebook',
};

export const POST = toolRoute('chalybclip', getClipsAdapter, async (a, { req, session }) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const platform = parsePlatform(body.platform);
  if (!platform || !a.capabilities().supportsConnect) throw new NotFoundError('platform');
  // Only back to a Clips screen of this app.
  const returnTo =
    typeof body.returnTo === 'string' && /^\/app\/clips(\/[\w-]*)*$/.test(body.returnTo)
      ? body.returnTo
      : '/app/clips/ajustes';
  const url = await a.connectUrl(session.user.id, platform, returnTo);
  if (!url) throw new NotFoundError('connect');
  const locale = body.locale === 'en' ? 'en' : 'es';
  const t = await getTranslations({ locale, namespace: 'consents.connect' });
  const name = NAMES[platform];
  await recordToolConsent(session, {
    type: 'social_connect',
    surface: 'clips_connect',
    checkboxText: '',
    buttonLabel: t('cta', { plataforma: name }),
    details: { tool: 'chalybclip', platform },
    locale,
    disclosureText: t('body', { plataforma: name }).replace(/<\/?b>/g, ''),
  });
  return { url };
});
