// En vivo's pure helpers (TOOLS-SPEC §6), unit-tested.

/** Which download the big button offers (§6.1): Mac for macOS, Windows
 *  otherwise (the common case for streamers). */
export function detectOs(userAgent: string | null | undefined): 'windows' | 'mac' {
  const ua = userAgent ?? '';
  // iPhone/iPad report "Mac OS X" too, but can't run the program.
  if (/Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad|iPod/.test(ua)) return 'mac';
  return 'windows';
}

export const otherOs = (os: 'windows' | 'mac') => (os === 'windows' ? 'mac' : 'windows');

/** "00:12:34" — always hh:mm:ss, the live counter (§6.2). */
export function formatElapsed(sinceIso: string, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - Date.parse(sinceIso)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "1 h 5 min" / "12 min" / "45 s" — "Duró {duracion}". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** A pairing code lasts 10 minutes and is used once (§1.3). */
export function codeExpired(expiresAtIso: string, nowMs: number): boolean {
  return nowMs >= Date.parse(expiresAtIso);
}

/** "482913" → ["482", "913"]: two groups of three (mockup 57). */
export function splitCode(code: string): [string, string] {
  const d = code.replace(/\D/g, '').slice(0, 6).padEnd(6, ' ');
  return [d.slice(0, 3), d.slice(3, 6)];
}

/** The stream key is always shown as 8 dots until "Mostrar" (§6.3). The
 *  length never leaks. */
export const MASKED_KEY = '••••••••';

export function maskKey(): string {
  return MASKED_KEY;
}

/** "Hacer clip de este momento" needs a live stream that is being recorded. */
export function clipNowState(input: {
  live: boolean;
  saveRecording: boolean;
}): 'ready' | 'needsRecording' | 'offAir' {
  if (!input.live) return 'offAir';
  return input.saveRecording ? 'ready' : 'needsRecording';
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
    ) as { amr?: { timestamp?: number }[]; iat?: number };
    const amr = (json.amr ?? [])
      .map((m) => m.timestamp)
      .filter((x): x is number => typeof x === 'number');
    const sec = amr.length ? Math.max(...amr) : json.iat;
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
