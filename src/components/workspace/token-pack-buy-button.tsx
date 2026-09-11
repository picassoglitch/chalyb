'use client';

// Buy button for a token top-up pack. Mirrors the structure of the
// SubscriptionActions buttons: optimistic transition, MP redirect in same
// tab so the back_urls land on /app/usage cleanly.
//
// Failure visibility — previous version showed only a 2.6s toast on
// checkout error. Easy to miss; "nothing happened" was a common user
// report. Now the button also keeps an inline error pinned below itself
// (sticky until they retry), and logs to console for debugging from
// browser devtools.

import { useState, useTransition } from 'react';
import { useWorkspace } from '@/lib/workspace/store';
import { createTokenPackCheckout } from '@/lib/payments/token-checkout-actions';

interface Props {
  packId: string;
  packLabel: string;
}

export function TokenPackBuyButton({ packId, packLabel }: Props) {
  const [pending, startTransition] = useTransition();
  const [stickyError, setStickyError] = useState<string | null>(null);
  const showToast = useWorkspace((s) => s.showToast);

  function onClick() {
    setStickyError(null);
    startTransition(async () => {
      // Race the server action against a client-side timeout. The MP SDK
      // has a 10s server-side timeout, but if MP hangs OR Vercel kills the
      // function before it responds (10s on Hobby, 60s on Pro), the
      // useTransition would stay pending forever and the button reads
      // "Iniciando checkout…" with no recovery. The timeout below trips
      // at 18s — long enough that a slow-but-working MP call still
      // completes, short enough that the user knows something's wrong
      // BEFORE Vercel's generic 500 page hijacks the tab.
      const CLIENT_TIMEOUT_MS = 18_000;
      let timedOut = false;
      const timeoutPromise = new Promise<{ ok: false; error: string }>((resolve) => {
        setTimeout(() => {
          timedOut = true;
          resolve({
            ok: false,
            error:
              'Mercado Pago no respondió en 18 segundos. Inténtalo de nuevo en ' +
              'un momento. Si vuelve a pasar, escríbenos y lo revisamos.',
          });
        }, CLIENT_TIMEOUT_MS);
      });
      const res = await Promise.race([
        createTokenPackCheckout(packId),
        timeoutPromise,
      ]);
      if (!res.ok || !('url' in res) || !res.url) {
        const msg =
          ('error' in res && res.error) || 'No pudimos abrir el pago';
        showToast(`<b>Error</b> · ${msg}`);
        setStickyError(msg);
        console.error('[token-pack-checkout] failed', {
          packId,
          response: res,
          timedOut,
        });
        return;
      }
      showToast(`Te llevamos a Mercado Pago para <b>${packLabel}</b>…`);
      window.location.href = res.url;
    });
  }

  return (
    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        style={{
          padding: '11px 18px',
          borderRadius: 9,
          border: 'none',
          background: pending ? 'var(--cc-bg-3)' : 'var(--cc-green)',
          color: pending ? 'var(--cc-txt-3)' : '#070809',
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Abriendo el pago…' : `Comprar ${packLabel} →`}
      </button>
      {stickyError && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(255, 93, 93, 0.08)',
            border: '1px solid var(--cc-red, #ff5d5d)',
            borderRadius: 7,
            fontSize: 11.5,
            color: 'var(--cc-red, #ff5d5d)',
            lineHeight: 1.45,
          }}
        >
          ▸ {stickyError}
        </div>
      )}
    </div>
  );
}
