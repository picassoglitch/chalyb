'use client';

// The risk notice, once per tool and per notice version (TOOLS-SPEC §5.1,
// mockup 53; aceptacion-ux §6). Three plain points, then the notice word for
// word, an UNCHECKED box and one button disabled until it's ticked. It blocks
// the tool, not the app: the sidebar keeps working. Closing it (Esc, the
// scrim, ✕) goes back to Inicio, never to a blank screen. The server refuses
// the tool's data without the acceptance (403) and the acceptance without
// the box (422).

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { Check, X } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Markup } from '@/components/ui/markup';
import { ToolIcon } from '@/components/ui/tool-icon';

export interface RiskAckCopy {
  title: string;
  sub: string;
  points: { title: string; body: string }[];
  legalK: string;
  /** aceptacion-ux §6 with {Herramienta} filled; may carry <b>. */
  legal: string;
  check: string;
  cta: string;
  hint: string;
  error: string;
  close: string;
}

export function RiskAckSheet({
  slug,
  locale,
  copy,
  backHref = '/app',
}: {
  slug: string;
  locale: string;
  copy: RiskAckCopy;
  backHref?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    ref.current?.querySelector<HTMLElement>('input,button')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') router.push(backHref as Route);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router, backHref, done]);

  async function accept() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/tools/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'risk', slug, checked, locale }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  if (done) return null;
  return (
    <div className="ch-risk" data-testid="risk-sheet">
      <div className="ch-risk__scrim" onClick={() => router.push(backHref as Route)} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="risk-title" className="ch-risk__sheet">
        <button
          type="button"
          className="ch-close ch-risk__x"
          aria-label={copy.close}
          onClick={() => router.push(backHref as Route)}
        >
          <X aria-hidden="true" />
        </button>
        <div className="ch-risk__head">
          <ToolIcon slug={slug} filled size="sm" />
          <div>
            <h2 id="risk-title" className="ch-h2">
              {copy.title}
            </h2>
            <p className="ch-muted">{copy.sub}</p>
          </div>
        </div>
        <ol className="ch-risk__points">
          {copy.points.map((p) => (
            <li key={p.title}>
              <span className="ch-risk__ok" aria-hidden="true">
                <Check />
              </span>
              <span>
                <b>{p.title}</b>
                <span className="ch-muted">{p.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="ch-risk__legal">
          <span className="ch-label">{copy.legalK}</span>
          <p>
            <Markup text={copy.legal} />
          </p>
        </div>
        <label className="ch-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{copy.check}</span>
        </label>
        {error && (
          <p role="alert" style={{ color: 'var(--bad)' }}>
            {copy.error}
          </p>
        )}
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--xl"
          disabled={!checked || busy}
          onClick={accept}
        >
          {copy.cta}
        </button>
        <p className="ch-muted ch-risk__hint">{copy.hint}</p>
      </div>
    </div>
  );
}
