'use client';

// "Publicar en TikTok" for a connected account (TOOLS-SPEC §4.2). A failure
// keeps every change and says what happens next.

import { useState } from 'react';

export function PublishButton({
  clipId,
  platform,
  labels,
}: {
  clipId: string;
  platform: string;
  labels: { cta: string; done: string; error: string };
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function go() {
    setState('busy');
    try {
      const res = await fetch(`/api/tools/chalybclip/clips/${encodeURIComponent(clipId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { ok: boolean } };
      setState(json.ok && json.data?.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }
  return (
    <>
      <button type="button" className="ch-btn ch-btn--gray" disabled={state === 'busy'} onClick={go}>
        {labels.cta}
      </button>
      {state === 'done' && <p role="status">{labels.done}</p>}
      {state === 'error' && <p role="alert">{labels.error}</p>}
    </>
  );
}
