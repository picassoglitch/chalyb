// What a launch may carry through to the engine's /auth/sso.
//
// An engine that sends a signed-out person to /auth/launch/<slug> wants them
// back on the screen they started from (`next`), and wants proof that the
// sign-in it receives is one this browser started (`state`, a nonce it keeps
// in its own cookie — login-CSRF protection). Both ride the launch URL as
// query parameters, never the signed token: the engine re-validates `next`
// against its own routes and compares `state` with its cookie.
//
// Anything malformed is dropped, not rejected: the launch still works and the
// engine falls back to its default landing.

import { safeNextPath } from '@/lib/auth/safe-next';

export interface LaunchForward {
  /** Relative path on the ENGINE's origin. */
  next?: string;
  /** Opaque nonce, echoed back unchanged. */
  state?: string;
}

/** base64url, long enough to be a nonce, short enough for a URL. */
const STATE = /^[A-Za-z0-9_-]{16,128}$/;

/** Keeps only the values that are safe to echo. */
export function sanitizeLaunchForward(
  raw:
    | {
        next?: string | null;
        state?: string | null;
      }
    | null
    | undefined,
): LaunchForward {
  const out: LaunchForward = {};
  const next = safeNextPath(raw?.next, '');
  if (next) out.next = next;
  if (raw?.state && STATE.test(raw.state)) out.state = raw.state;
  return out;
}

export function readLaunchForward(params: URLSearchParams): LaunchForward {
  return sanitizeLaunchForward({ next: params.get('next'), state: params.get('state') });
}

/** `?next=…&state=…` (or '') for a URL that has no query yet. */
export function launchForwardQuery(forward: LaunchForward): string {
  const q = new URLSearchParams();
  if (forward.next) q.set('next', forward.next);
  if (forward.state) q.set('state', forward.state);
  const s = q.toString();
  return s ? `?${s}` : '';
}
