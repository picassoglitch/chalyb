// Which message namespaces reach the browser (LANDING-SPEC §11: the public
// HTML must not carry other screens' copy). Public pages get only what their
// client components read; the signed-in app and the owner panel wrap their
// own provider with every namespace ((dashboard)/layout.tsx). meta, legal,
// errors, checkout and wizard are read only server-side or under
// (dashboard), so public pages don't ship them.

import type { AbstractIntlMessages } from 'next-intl';

export const PUBLIC_CLIENT_NAMESPACES = [
  'landing',
  'auth',
  'contact',
  'language',
  'plans',
  'billing',
  'seller',
] as const;

export function pickNamespaces(
  messages: AbstractIntlMessages,
  keys: readonly string[],
): AbstractIntlMessages {
  return Object.fromEntries(keys.filter((k) => k in messages).map((k) => [k, messages[k]!]));
}
