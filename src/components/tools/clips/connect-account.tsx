'use client';

// "Conectar" → ConnectAccountSheet (TOOLS-SPEC §3; aceptacion-ux §7 copy
// before any OAuth). The button records social_connect and continues in
// the SAME tab to the platform, which returns to `returnTo`.

import { useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Markup } from '@/components/ui/markup';

export interface ConnectCopy {
  open: string;
  title: string;
  body: string;
  cta: string;
  close: string;
  error: string;
}

export function ConnectAccount({
  platform,
  returnTo,
  locale,
  copy,
  className = 'ch-lnk ch-acct__cta',
}: {
  platform: string;
  returnTo: string;
  locale: string;
  copy: ConnectCopy;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function go() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/tools/chalybclip/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, returnTo, locale }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { url: string } };
      if (!json.ok || !json.data?.url) throw new Error(String(res.status));
      window.location.assign(json.data.url);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {copy.open}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={copy.title} closeLabel={copy.close}>
        <div style={{ display: 'grid', gap: 18 }}>
          <p>
            <Markup text={copy.body} />
          </p>
          {error && (
            <p role="alert" style={{ color: 'var(--bad)' }}>
              {copy.error}
            </p>
          )}
          <button type="button" className="ch-btn ch-btn--primary ch-btn--xl" disabled={busy} onClick={go}>
            {copy.cta}
          </button>
        </div>
      </Sheet>
    </>
  );
}
