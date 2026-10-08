'use client';
// Inside the hub the person is already signed in: when Chalito has no session yet, ask the hub for
// a launch token (/api/tools/chalito/sso, same gates as a launch) and exchange it at the Chalito
// api for this browser's own session. Replaces Chalito's "Entrar con Chalyb" redirect.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useChalito } from '@/lib/chalito/provider';
import { completeSso } from '@/lib/chalito/web/sso';
import { supabase } from '@/lib/chalito/web/supabase';
import { env } from '@/lib/chalito/web/env';

type Failure = 'no_access' | 'failed' | 'rate_limited';

const MAX_ATTEMPTS = 3;

export const HubBridge = ({ children }: { children: ReactNode }) => {
  const { status, session } = useChalito();
  const t = useTranslations('chalito.sso');
  /** A sign-in is running (effects that re-run, or a double render, must not start a second). */
  const running = useRef(false);
  /**
   * Sign-ins this page started. Chalito's session can end again later (a hub account switch, an
   * expired refresh token, "Entrar con Chalyb" after a revoke): each time it signs in again, up to
   * a cap, so a session that keeps being refused can't loop.
   */
  const attempts = useRef(0);
  /**
   * A session landed since the last sign-in started. Chalito's status is already "signed_out" while
   * a sign-in runs, so a session that lands and is dropped again (another account's, refused) never
   * changes it: the session's own signed_in -> signed_out is what says to sign in again. Without it
   * a sign-in that came back stale left "Entrando a Chalito…" up forever.
   */
  const landed = useRef(false);
  /** Bumped when a sign-in finishes, so a session dropped while it was still running is seen. */
  const [finished, setFinished] = useState(0);
  const [failed, setFailed] = useState<Failure | null>(null);

  useEffect(() => {
    if (session.status === 'signed_in') landed.current = true;
  }, [session.status]);

  useEffect(() => {
    if (status !== 'signed_out' || session.status !== 'signed_out' || running.current || failed) return;
    // After the first: only once the last one's session landed (and was dropped), never while the
    // provider is still catching up with a session that just landed.
    if (attempts.current > 0 && !landed.current) return;
    if (attempts.current >= MAX_ATTEMPTS) return setFailed('failed');
    running.current = true;
    landed.current = false;
    attempts.current += 1;
    void (async (): Promise<Failure | null> => {
      const r = await fetch('/api/tools/chalito/sso', {
        method: 'POST',
        credentials: 'same-origin',
      }).catch(() => null);
      const body = r
        ? ((await r.json().catch(() => null)) as { ok?: boolean; token?: string } | null)
        : null;
      if (!r?.ok || !body?.token) return r?.status === 403 ? 'no_access' : 'failed';
      const done = await completeSso(
        { token: body.token, next: null },
        { apiBase: env.apiBase, fetch: window.fetch.bind(window), auth: supabase().auth },
      );
      // No reload: the provider listens to this same Supabase client, so the new session
      // connects in place (a reload cost a whole second page load on the first visit).
      return done.ok ? null : done.reason === 'rate_limited' ? 'rate_limited' : 'failed';
    })()
      // supabase() throws when Chalito isn't configured: say so instead of "Entrando…" forever.
      .catch((): Failure => 'failed')
      .then((f) => {
        running.current = false;
        if (f) setFailed(f);
        else setFinished((n) => n + 1);
      });
  }, [status, session.status, failed, finished]);

  if (failed)
    return (
      <p
        role="alert"
        data-testid="chalito-sso-failed"
        className="ch-card ch-chl-card ch-chl-card--bad"
      >
        {t(failed === 'rate_limited' ? 'rateLimited' : 'failed')}
      </p>
    );
  if (status === 'loading' || status === 'signed_out')
    return (
      <p aria-busy="true" className="ch-muted">
        {t('working')}
      </p>
    );
  return <>{children}</>;
};
