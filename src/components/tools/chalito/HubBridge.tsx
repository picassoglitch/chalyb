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

export const HubBridge = ({ children }: { children: ReactNode }) => {
  const { status } = useChalito();
  const t = useTranslations('chalito.sso');
  const started = useRef(false);
  const [failed, setFailed] = useState<Failure | null>(null);

  useEffect(() => {
    if (status !== 'signed_out' || started.current) return;
    started.current = true;
    void (async () => {
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
      if (done.ok) window.location.reload();
      else setFailed(done.reason === 'rate_limited' ? 'rate_limited' : 'failed');
    })();
  }, [status]);

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
