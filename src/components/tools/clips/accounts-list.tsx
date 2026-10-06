// Connected accounts (TOOLS-SPEC §3 ConnectedAccounts): "Conectado ✓" with
// the handle, or "Conectar" — the latter only when the engine can actually
// connect (capabilities.supportsConnect): never a button with no action.

import { getLocale, getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import type { ConnectedAccount, SocialPlatform } from '@/lib/tools/adapters/types';
import { ConnectAccount } from './connect-account';

export const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  tiktok: 'TikTok',
  kick: 'Kick',
  facebook: 'Facebook',
};

/** The rows a screen shows, in mockup order. */
export function accountRows(
  accounts: ConnectedAccount[],
  platforms: SocialPlatform[],
  canConnect: boolean,
): ConnectedAccount[] {
  return platforms
    .map(
      (p) =>
        accounts.find((a) => a.platform === p) ?? { platform: p, handle: null, connected: false },
    )
    .filter((a) => a.connected || canConnect);
}

export async function AccountsList({
  rows,
  returnTo,
  subs = {},
}: {
  rows: ConnectedAccount[];
  returnTo: string;
  /** Per-platform subtitle for unconnected rows ("Para publicar con un toque"). */
  subs?: Partial<Record<SocialPlatform, string>>;
}) {
  const t = await getTranslations('clipsTool.home');
  const tc = await getTranslations('consents.connect');
  const tx = await getTranslations('clipsTool.connect');
  const locale = await getLocale();
  return (
    <ul className="ch-accts">
      {rows.map((a) => {
        const name = PLATFORM_NAMES[a.platform];
        return (
          <li key={a.platform} className="ch-acct">
            <span className={`ch-acct__ic ch-acct__ic--${a.platform}`} aria-hidden="true">
              {name.slice(0, 1)}
            </span>
            <span className="ch-acct__tx">
              <b>{name}</b>
              {a.connected && a.handle ? (
                <span className="ch-muted">{a.handle}</span>
              ) : (
                subs[a.platform] && <span className="ch-muted">{subs[a.platform]}</span>
              )}
            </span>
            {a.connected ? (
              <span className="ch-acct__ok">
                <Check aria-hidden="true" />
                {t('connected')}
              </span>
            ) : (
              <ConnectAccount
                platform={a.platform}
                returnTo={returnTo}
                locale={locale}
                copy={{
                  open: t('connect'),
                  title: tx('title', { plataforma: name }),
                  body: tc.markup('body', { plataforma: name, b: (c) => `<b>${c}</b>` }),
                  cta: tc('cta', { plataforma: name }),
                  close: tx('close'),
                  error: tx('error'),
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
