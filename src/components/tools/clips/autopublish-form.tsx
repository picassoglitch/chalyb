'use client';

// "Publicar automáticamente en mis redes" (TOOLS-SPEC §4.3; aceptacion-ux §7):
// an UNCHECKED responsibility box for the chosen connected account and one
// button. The server records autopublish_enabled, refuses without the box
// (422) and re-checks the plan and the engine's support.

import { useState } from 'react';
import { Markup } from '@/components/ui/markup';

export function AutopublishForm({
  accounts,
  locale,
  copy,
}: {
  accounts: string[];
  locale: string;
  copy: { title: string; account: string; check: string; cta: string; done: string; error: string };
}) {
  const [account, setAccount] = useState(accounts[0] ?? '');
  const [checked, setChecked] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function go() {
    setState('busy');
    try {
      const res = await fetch('/api/tools/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'autopublish', account, checked, locale }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }
  return (
    <div className="ch-autopub">
      <b>{copy.title}</b>
      {accounts.length > 1 && (
        <label className="ch-field">
          <span>{copy.account}</span>
          <select className="ch-select" value={account} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      )}
      <label className="ch-check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>
          <Markup text={copy.check.replace('{cuenta}', account)} />
        </span>
      </label>
      <button
        type="button"
        className="ch-btn ch-btn--secondary"
        disabled={!checked || state === 'busy' || state === 'done'}
        onClick={go}
      >
        {copy.cta}
      </button>
      {state === 'done' && <p role="status">{copy.done.replace('{cuenta}', account)}</p>}
      {state === 'error' && <p role="alert">{copy.error}</p>}
    </div>
  );
}
