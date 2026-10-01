// The popup half of "Abrir", kept free of React so it can be unit-tested.
//
// Browsers only allow window.open() inside the user's click. The launch URL
// needs a server round-trip, and a window opened after that `await` is
// blocked — silently, because nothing checked the return value (B01). So the
// tab is opened FIRST, on the click, pointing at about:blank, and filled in
// once the URL arrives.
//
// Every path ends in a new tab, a visible link, or an error message.

import type { CustomerErrorCode } from '@/lib/errors/customer-errors';
import type { LaunchResult } from '@/lib/engines/launch-flow';

/** The bits of a Window this module touches. */
export interface LaunchWindow {
  location: { href: string };
  opener: unknown;
  close(): void;
}

export type LaunchOutcome =
  | { kind: 'opened' }
  | { kind: 'blocked'; url: string }
  | { kind: 'error'; code: CustomerErrorCode };

/** Call synchronously inside the click handler. Returns null when the browser
 *  blocked the popup. No `noopener` in the features string: with it,
 *  window.open returns null even on success and the tab can't be filled in.
 *  The opener handle is cut in `finishLaunch` instead. */
export function openLaunchWindow(
  open: (url: string, target: string) => unknown,
): LaunchWindow | null {
  try {
    return (open('about:blank', '_blank') as LaunchWindow | null) ?? null;
  } catch {
    return null;
  }
}

export function finishLaunch(win: LaunchWindow | null, result: LaunchResult): LaunchOutcome {
  if (!result.ok) {
    win?.close();
    return { kind: 'error', code: result.code };
  }
  if (!win) return { kind: 'blocked', url: result.url };
  try {
    // The engine must not get a handle back into Chalyb's tab.
    win.opener = null;
    win.location.href = result.url;
    return { kind: 'opened' };
  } catch {
    win.close();
    return { kind: 'blocked', url: result.url };
  }
}
