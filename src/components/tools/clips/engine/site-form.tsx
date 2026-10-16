'use client';

// Clips · Sitio (engine admins): the price strings the Clips landing shows.
// Empty clears back to the landing's default text.

import { useState } from 'react';
import { errorText, toolCall, type ErrorCopy } from './tool-call';

export interface SiteCopy {
  es: string;
  en: string;
  hint: string;
  save: string;
  saved: string;
  working: string;
  errors: ErrorCopy;
}

export function SiteForm({
  initial,
  copy,
}: {
  initial: { price_es: string; price_en: string };
  copy: SiteCopy;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="ch-card ch-ce-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          setV(await toolCall('/admin/site-settings', 'PUT', v));
          setMsg({ ok: true, text: copy.saved });
        } catch (err) {
          setMsg({ ok: false, text: errorText(err, copy.errors) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="ch-ce-note">{copy.hint}</p>
      <div className="ch-ce-grid2">
        <label className="ch-ce-field">
          {copy.es}
          <input
            className="ch-input"
            maxLength={120}
            value={v.price_es}
            onChange={(e) => setV({ ...v, price_es: e.target.value })}
          />
        </label>
        <label className="ch-ce-field">
          {copy.en}
          <input
            className="ch-input"
            maxLength={120}
            value={v.price_en}
            onChange={(e) => setV({ ...v, price_en: e.target.value })}
          />
        </label>
      </div>
      <div className="ch-ce-actions">
        <button type="submit" className="ch-btn ch-btn--primary" disabled={busy}>
          {busy ? copy.working : copy.save}
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? 'ch-ce-ok' : 'ch-ce-err'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
