'use client';

// Actions on one video (mode "a"): approve every clip still waiting, download
// the approved ones as a zip (a signed engine link the browser opens), run it
// again with a persona ("Córrelo"), delete it. Each button is locked while
// its call runs; errors stay on the page with a support code.

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { errorText, toolCall, type ErrorCopy } from './tool-call';

export interface StreamActionsCopy {
  approveAll: string;
  approved: string;
  download: string;
  preparing: string;
  rerunTitle: string;
  persona: string;
  boost: string;
  boostHint: string;
  rerunGo: string;
  deleteVideo: string;
  deleteConfirm: string;
  deleteYes: string;
  deleteNo: string;
  working: string;
  errors: ErrorCopy;
}

export function StreamActions({
  streamId,
  copy,
  pendingApproval,
  readyCount,
  canRerun,
  personas,
  defaultPersona,
}: {
  streamId: string;
  copy: StreamActionsCopy;
  pendingApproval: number;
  readyCount: number;
  canRerun: boolean;
  personas: { id: string; name: string }[];
  defaultPersona: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [persona, setPersona] = useState(defaultPersona ?? personas[0]?.id ?? '');
  const [boost, setBoost] = useState(false);
  const [, startTransition] = useTransition();
  const id = encodeURIComponent(streamId);

  async function run(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, copy.errors) });
    } finally {
      setBusy(null);
    }
  }

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="ch-ce-stack">
      <div className="ch-ce-actions">
        {pendingApproval > 0 && (
          <button
            type="button"
            className="ch-btn ch-btn--primary"
            disabled={!!busy}
            onClick={() =>
              run('approve', async () => {
                const r = await toolCall<{ approved: number }>(`/streams/${id}/approve-all`);
                setMsg({ ok: true, text: copy.approved.replace('{n}', String(r.approved)) });
                refresh();
              })
            }
          >
            {busy === 'approve' ? copy.working : copy.approveAll}
          </button>
        )}
        {readyCount > 0 && (
          <button
            type="button"
            className="ch-btn ch-btn--secondary"
            disabled={!!busy}
            onClick={() =>
              run('zip', async () => {
                const r = await toolCall<{ url: string | null }>(
                  `/streams/${id}/download-approved`,
                );
                if (r.url) window.location.assign(r.url);
              })
            }
          >
            {busy === 'zip' ? copy.preparing : copy.download}
          </button>
        )}
        <button
          type="button"
          className="ch-btn ch-btn--gray"
          disabled={!!busy}
          onClick={() => setConfirmDelete(true)}
        >
          {copy.deleteVideo}
        </button>
      </div>

      {confirmDelete && (
        <div className="ch-card ch-ce-card" role="alertdialog" aria-labelledby="ce-del">
          <p id="ce-del">{copy.deleteConfirm}</p>
          <div className="ch-ce-actions">
            <button
              type="button"
              className="ch-btn ch-btn--danger"
              disabled={!!busy}
              onClick={() =>
                run('delete', async () => {
                  await toolCall(`/streams/${id}`, 'DELETE');
                  router.push('/app/clips/videos');
                })
              }
            >
              {busy === 'delete' ? copy.working : copy.deleteYes}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--secondary"
              onClick={() => setConfirmDelete(false)}
            >
              {copy.deleteNo}
            </button>
          </div>
        </div>
      )}

      {canRerun && personas.length > 0 && (
        <form
          className="ch-card ch-ce-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run('rerun', async () => {
              await toolCall(`/streams/${id}/rerun`, 'POST', { persona_id: persona, boost });
              refresh();
            });
          }}
        >
          <h3 className="ch-h3">{copy.rerunTitle}</h3>
          <label className="ch-ce-field">
            {copy.persona}
            <select
              className="ch-select"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-ce-check">
            <input type="checkbox" checked={boost} onChange={(e) => setBoost(e.target.checked)} />
            <span>
              {copy.boost}
              <small>{copy.boostHint}</small>
            </span>
          </label>
          <div className="ch-ce-actions">
            <button type="submit" className="ch-btn ch-btn--primary" disabled={!!busy || !persona}>
              {busy === 'rerun' ? copy.working : copy.rerunGo}
            </button>
          </div>
        </form>
      )}

      {msg && (
        <p className={msg.ok ? 'ch-ce-ok' : 'ch-ce-err'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
