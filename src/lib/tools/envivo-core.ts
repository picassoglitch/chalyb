// En vivo's pure helpers (TOOLS-SPEC §6), unit-tested.

/** "1 h 5 min" / "12 min" / "45 s" — "Duró {duracion}". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The stream key is always shown as 8 dots until "Mostrar" (§6.3). The
 *  length never leaks. */
export const MASKED_KEY = '••••••••';

export function maskKey(): string {
  return MASKED_KEY;
}

/** Re-entering the password, or a sign-in this recent, unlocks "Mostrar". */
export const REVEAL_RECENT_SIGNIN_MS = 5 * 60_000;

/** When THIS session authenticated, in ms: the newest `amr` timestamp of
 *  its access token (Supabase JWT), else its `iat`. Null when the token
 *  can't be read. The account's last_sign_in_at is not proof: it moves when
 *  any device signs in. */
export function sessionAuthTimeMs(accessToken: string | null | undefined): number | null {
  const part = accessToken?.split('.')[1];
  if (!part) return null;
  try {
    const json = JSON.parse(
      Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { amr?: { timestamp?: number }[] };
    // Only the sign-in methods' own time proves a recent sign-in: `iat`
    // renews on every token refresh, so without amr the answer is "no".
    // Decoding without verifying is safe only because getSessionUser()
    // verified this same cookie token (getUser) earlier in the request.
    const amr = (json.amr ?? [])
      .map((m) => m.timestamp)
      .filter((x): x is number => typeof x === 'number');
    const sec = amr.length ? Math.max(...amr) : null;
    return typeof sec === 'number' && Number.isFinite(sec) ? sec * 1000 : null;
  } catch {
    return null;
  }
}

export function recentSignIn(authTimeMs: number | null, nowMs: number): boolean {
  return (
    authTimeMs !== null && nowMs - authTimeMs >= 0 && nowMs - authTimeMs <= REVEAL_RECENT_SIGNIN_MS
  );
}

/** Password checks for "Mostrar": at most this many per user per window. */
export const REVEAL_MAX_ATTEMPTS = 5;
export const REVEAL_WINDOW_MS = 15 * 60_000;

export function revealAttemptAllowed(attemptsInWindow: number): boolean {
  return attemptsInWindow < REVEAL_MAX_ATTEMPTS;
}
