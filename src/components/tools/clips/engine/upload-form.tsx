'use client';

// Subir un video (mode "a"). The file never passes through the app server:
//   1. POST /uploads with name/size/type → the engine admits the size and
//      answers a short-lived presigned PUT to the bucket + a ticket;
//   2. the browser PUTs the file straight to the bucket (progress bar);
//   3. POST /uploads/{id}/complete → the engine checks it and starts.
// Cancelling (or leaving mid-upload) releases the admission (abort).

import { useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { CloudUpload } from 'lucide-react';
import { errorText, toolCall, ToolCallError, type ErrorCopy } from './tool-call';

export interface UploadCopy {
  drop: string;
  dropHint: string;
  formats: string;
  chosen: string;
  boost: string;
  boostHint: string;
  start: string;
  uploading: string;
  checking: string;
  cancel: string;
  cancelled: string;
  keepOpen: string;
  tooBig: string;
  badType: string;
  putFailed: string;
  errors: ErrorCopy;
}

const TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
};

function typeOf(file: File): string | null {
  if (Object.values(TYPES).includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? null;
}

export function UploadForm({ copy, maxBytes }: { copy: UploadCopy; maxBytes: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [boost, setBoost] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'checking'>('idle');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const started = useRef<{ id: string; ticket: string } | null>(null);

  function pick(f: File | null | undefined) {
    setError(null);
    if (!f) return;
    if (!typeOf(f)) return setError(copy.badType);
    if (maxBytes > 0 && f.size > maxBytes) return setError(copy.tooBig);
    setFile(f);
  }

  async function abort() {
    xhr.current?.abort();
    const s = started.current;
    started.current = null;
    setPhase('idle');
    setPct(0);
    if (s) {
      await toolCall(`/uploads/${encodeURIComponent(s.id)}/abort`, 'POST', {
        ticket: s.ticket,
      }).catch(() => {});
      setError(copy.cancelled);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || phase !== 'idle') return;
    const type = typeOf(file);
    if (!type) return setError(copy.badType);
    setError(null);
    setPhase('uploading');
    setPct(0);
    try {
      const up = await toolCall<{
        stream_id: string;
        upload_url: string;
        headers: Record<string, string>;
        ticket: string;
      }>('/uploads', 'POST', {
        filename: file.name.slice(0, 255),
        size_bytes: file.size,
        content_type: type,
        boost,
      });
      started.current = { id: up.stream_id, ticket: up.ticket };
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        xhr.current = x;
        x.open('PUT', up.upload_url);
        for (const [k, v] of Object.entries(up.headers)) x.setRequestHeader(k, v);
        x.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setPct(Math.round((ev.loaded / ev.total) * 100));
        };
        x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error('put')));
        x.onerror = () => reject(new Error('put'));
        x.onabort = () => reject(new Error('aborted'));
        x.send(file);
      });
      setPhase('checking');
      const done = await toolCall<{ stream_id: string }>(
        `/uploads/${encodeURIComponent(up.stream_id)}/complete`,
        'POST',
        { ticket: up.ticket },
      );
      started.current = null;
      router.push(`/app/clips/videos/${encodeURIComponent(done.stream_id)}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'aborted') return;
      const s = started.current;
      started.current = null;
      setPhase('idle');
      if (err instanceof ToolCallError) setError(errorText(err, copy.errors));
      else setError(copy.putFailed);
      if (s)
        void toolCall(`/uploads/${encodeURIComponent(s.id)}/abort`, 'POST', {
          ticket: s.ticket,
        }).catch(() => {});
    }
  }

  const busy = phase !== 'idle';
  return (
    <form className="ch-ce-form" onSubmit={submit}>
      <label
        className="ch-ce-drop"
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy) pick(e.dataTransfer.files?.[0]);
        }}
      >
        <CloudUpload aria-hidden="true" />
        <b>{file ? copy.chosen.replace('{nombre}', file.name) : copy.drop}</b>
        <span className="ch-muted">{copy.dropHint}</span>
        <span className="ch-ce-note">{copy.formats}</span>
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm"
          className="ch-sr"
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      <label className="ch-ce-check">
        <input
          type="checkbox"
          checked={boost}
          disabled={busy}
          onChange={(e) => setBoost(e.target.checked)}
        />
        <span>
          {copy.boost}
          <small>{copy.boostHint}</small>
        </span>
      </label>
      {busy && (
        <div role="status" aria-live="polite" className="ch-ce-form">
          <div
            className="ch-ce-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={copy.uploading}
          >
            <span style={{ width: `${phase === 'checking' ? 100 : pct}%` }} />
          </div>
          <p className="ch-muted">
            {phase === 'checking' ? copy.checking : `${copy.uploading} ${pct}%`} · {copy.keepOpen}
          </p>
        </div>
      )}
      {error && (
        <p className="ch-ce-err" role="alert">
          {error}
        </p>
      )}
      <div className="ch-ce-actions">
        <button
          type="submit"
          className="ch-btn ch-btn--primary ch-btn--xl"
          disabled={!file || busy}
        >
          {copy.start}
        </button>
        {phase === 'uploading' && (
          <button type="button" className="ch-btn ch-btn--gray" onClick={abort}>
            {copy.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
