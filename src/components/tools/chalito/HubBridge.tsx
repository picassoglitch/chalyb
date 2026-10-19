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
import { ssoFailureView, type SsoFailure } from '@/lib/chalito/web/plan-gate';
import { ButtonLink } from '@/components/ui/primitives';

export const HubBridge = ({ children }: { children: ReactNode }) => {
  const { status } = useChalito();
  const t = useTranslations('chalito.sso');
  /** Sign-ins this page load: a session dropped later (e.g. by another account's) signs in again. */
  const attempts = useRef(0);
  const running = useRef(false);
  const [failed, setFailed] = useState<SsoFailure | null>(null);

  useEffect(() => {
    if (status !== 'signed_out' || running.current || failed) return;
    // A few at most, so a session that keeps dropping ends on the error instead of looping.
    if (attempts.current >= 3) return setFailed('failed');
    attempts.current += 1;
    running.current = true;
    void (async () => {
      try {
        const r = await fetch('/api/tools/chalito/sso', {
          method: 'POST',
          credentials: 'same-origin',
        }).catch(() => null);
        const body = r
          ? ((await r.json().catch(() => null)) as { ok?: boolean; token?: string } | null)
          : null;
        if (!r?.ok || !body?.token) return setFailed(r?.status === 403 ? 'no_access' : 'failed');
        const done = await completeSso(
          { token: body.token, next: null },
          { apiBase: env.apiBase, fetch: window.fetch.bind(window), auth: supabase().auth },
        );
        // No reload: the provider listens to this same Supabase client, so the new session
        // connects in place (a reload cost a whole second page load on the first visit).
        if (!done.ok) setFailed(done.reason === 'rate_limited' ? 'rate_limited' : 'failed');
      } finally {
        running.current = false;
      }
    })();
  }, [status, failed]);

  if (failed) {
    const view = ssoFailureView(failed);
    return (
      <div
        role="alert"
        data-testid="chalito-sso-failed"
        data-reason={failed}
        className="ch-card ch-chl-card ch-chl-card--bad"
      >
        <p>{t(view.key)}</p>
        {view.plansHref && (
          <ButtonLink href={view.plansHref} size="compact">
            {t('seePlans')}
          </ButtonLink>
        )}
      </div>
    );
  }
  if (status === 'loading' || status === 'signed_out')
    return (
      <p aria-busy="true" className="ch-muted">
        {t('working')}
      </p>
    );
  return <>{children}</>;
};
