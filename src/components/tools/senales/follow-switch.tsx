'use client';

// "Recibir avisos de esta moneda" (TOOLS-SPEC §5.3): adds or removes the
// coin from the delivery preferences. It never changes the signal.

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

export function FollowSwitch({
  coin,
  initial,
  coins,
  label,
  via,
  errorLabel,
}: {
  coin: string;
  initial: boolean;
  coins: string[];
  label: string;
  via: string;
  errorLabel: string;
}) {
  const [on, setOn] = useState(initial);
  const [list, setList] = useState(coins);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function change(next: boolean) {
    setOn(next);
    setBusy(true);
    setError(false);
    const set = new Set(list);
    if (next) set.add(coin);
    else set.delete(coin);
    try {
      const res = await fetch('/api/tools/chalybcrypto/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins: [...set] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setList([...set]);
    } catch {
      setOn(!next);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ch-card ch-follow">
      <span className="ch-follow__tx">
        <b>{label}</b>
        <small className="ch-muted">{via}</small>
        {error && (
          <small role="alert" style={{ color: 'var(--bad)' }}>
            {errorLabel}
          </small>
        )}
      </span>
      <Switch checked={on} onChange={change} label={label} disabled={busy} />
    </div>
  );
}
