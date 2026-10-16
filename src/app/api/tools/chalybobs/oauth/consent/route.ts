// POST /api/tools/chalybobs/oauth/consent {platform, locale} — the
// "Conectar {plataforma}" button of ConnectAccountSheet (aceptacion-ux §7).
// Records social_connect with the text the sheet showed, then arms the
// sign-in: an httpOnly cookie with this person's state + PKCE verifier that
// oauth/start and oauth/callback require (see envivo-bff.ts). The popup the
// page already opened then goes to oauth/start.

import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { termsAcceptancePending } from '@/lib/legal/reaccept-server';
import { TermsPendingError } from '@/lib/tools/clips-bff';
import { recordToolConsent } from '@/lib/tools/consents';
import { PLATFORM_META, isOAuthPlatform } from '@/lib/tools/envivo-platforms';
import {
  EnVivoBadRequest,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  OAUTH_TTL_S,
  encodePending,
  newOAuthPending,
} from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, body, signal }) => {
  if (await termsAcceptancePending(session.user.id)) throw new TermsPendingError('terms_pending');
  const platform = body.platform;
  if (!isOAuthPlatform(platform) || !a.capabilities().supportsConnect)
    throw new EnVivoBadRequest('platform');
  // The engine must have this platform's app credentials, or the popup
  // would only show an error.
  const state = await a.state(session.user.id, signal);
  if (!state.oauthAvailable[platform]) throw new EnVivoBadRequest('platform_not_configured');
  const locale = body.locale === 'en' ? 'en' : 'es';
  const t = await getTranslations({ locale, namespace: 'consents.connect' });
  const name = PLATFORM_META[platform].name;
  await recordToolConsent(session, {
    type: 'social_connect',
    surface: 'envivo_connect',
    checkboxText: '',
    buttonLabel: t('cta', { plataforma: name }),
    details: { tool: 'chalybobs', platform },
    locale,
    disclosureText: t.markup('body', { plataforma: name, b: (c) => c }),
  });
  const pending = newOAuthPending(session.user.id, platform, Math.floor(Date.now() / 1000), locale);
  (await cookies()).set({
    name: OAUTH_COOKIE,
    value: encodePending(pending),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_TTL_S,
  });
  return { start: `${OAUTH_COOKIE_PATH}/start?platform=${platform}&lang=${locale}` };
});
