'use client';

// Clips · Canales (mode "a"): watch a YouTube / Twitch / Kick channel; each
// new video comes in on its own and goes through the whole process. Pause,
// how often to look, look now, stop watching.

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { errorText, toolCall, ToolCallError, type ErrorCopy } from './tool-call';

export interface Watch {
  id: string;
  platform: string;
  channel_url: string;
  label: string | null;
  persona_id: string;
  enabled: boolean;
  polls_per_day: number;
  seen_count: number;
  last_polled_at: string | null;
}

export interface SourcesCopy {
  addTitle: string;
  url: string;
  urlPh: string;
  platform: string;
  platformAuto: string;
  persona: string;
  max: string;
  label: string;
  labelPh: string;
  language: string;
  languagePh: string;
  cadence: string;
  cadences: Record<string, string>;
  add: string;
  added: string;
  already: string;
  listTitle: string;
  empty: string;
  watching: string;
  paused: string;
  seen: string;
  lastPoll: string;
  never: string;
  pollNow: string;
  scanning: string;
  remove: string;
  removeConfirm: string;
  working: string;
  errors: ErrorCopy;
}

const CADENCES = [1, 2, 4, 6, 12, 24];

export function SourcesPanel({
  initial,
  personas,
  copy,
  locale,
}: {
  initial: Watch[];
  personas: { id: string; name: string }[];
  copy: SourcesCopy;
  locale: string;
}) {
  const [watches, setWatches] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    channel_url: '',
    platform: '',
    persona_id: personas[0]?.id ?? '',
    max_per_poll: 3,
    label: '',
    language: '',
    polls_per_day: 1,
  });
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  async function run(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      const text =
        err instanceof ToolCallError && err.refusal === 'already_watching'
          ? copy.already
          : errorText(err, copy.errors);
      setMsg({ ok: false, text });
    } finally {
      setBusy(null);
    }
  }

  const replace = (w: Watch) => setWatches((ws) => ws.map((x) => (x.id === w.id ? w : x)));

  return (
    <div className="ch-ce-stack">
      <form
        className="ch-card ch-ce-card"
        onSubmit={(e) => {
          e.preventDefault();
          void run('add', async () => {
            const r = await toolCall<{ watch: Watch }>('/sources', 'POST', form);
            setWatches((ws) => [r.watch, ...ws]);
            setForm((f) => ({ ...f, channel_url: '', label: '' }));
            setMsg({ ok: true, text: copy.added });
          });
        }}
      >
        <h2 className="ch-h3">{copy.addTitle}</h2>
        <label className="ch-ce-field">
          {copy.url}
          <input
            className="ch-input"
            type="url"
            required
            value={form.channel_url}
            placeholder={copy.urlPh}
            onChange={(e) => setForm({ ...form, channel_url: e.target.value })}
          />
        </label>
        <div className="ch-ce-grid3">
          <label className="ch-ce-field">
            {copy.platform}
            <select
              className="ch-select"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
            >
              <option value="">{copy.platformAuto}</option>
              <option value="youtube">YouTube</option>
              <option value="twitch">Twitch</option>
              <option value="kick">Kick</option>
            </select>
          </label>
          <label className="ch-ce-field">
            {copy.persona}
            <select
              className="ch-select"
              value={form.persona_id}
              onChange={(e) => setForm({ ...form, persona_id: e.target.value })}
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-ce-field">
            {copy.max}
            <input
              className="ch-input"
              type="number"
              min={1}
              max={25}
              value={form.max_per_poll}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_per_poll: Math.max(1, Math.min(25, Number(e.target.value) || 1)),
                })
              }
            />
          </label>
          <label className="ch-ce-field">
            {copy.label}
            <input
              className="ch-input"
              value={form.label}
              placeholder={copy.labelPh}
              maxLength={120}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </label>
          <label className="ch-ce-field">
            {copy.language}
            <input
              className="ch-input"
              value={form.language}
              placeholder={copy.languagePh}
              maxLength={16}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            />
          </label>
          <label className="ch-ce-field">
            {copy.cadence}
            <select
              className="ch-select"
              value={form.polls_per_day}
              onChange={(e) => setForm({ ...form, polls_per_day: Number(e.target.value) })}
            >
              {CADENCES.map((n) => (
                <option key={n} value={n}>
                  {copy.cadences[String(n)]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ch-ce-actions">
          <button
            type="submit"
            className="ch-btn ch-btn--primary"
            disabled={!!busy || !form.persona_id}
          >
            {busy === 'add' ? copy.working : copy.add}
          </button>
        </div>
      </form>

      {msg && (
        <p className={msg.ok ? 'ch-ce-ok' : 'ch-ce-err'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}

      <section className="ch-ce-stack" aria-labelledby="ce-watches">
        <h2 id="ce-watches" className="ch-ghead">
          {copy.listTitle}
        </h2>
        {watches.length === 0 ? (
          <p className="ch-muted">{copy.empty}</p>
        ) : (
          <ul className="ch-card ch-ce-rows">
            {watches.map((w) => (
              <li key={w.id} className="ch-ce-row" style={{ flexWrap: 'wrap' }}>
                <span className="ch-ce-row__tx">
                  <b>{w.label || w.channel_url}</b>
                  <small>
                    {w.platform} · {w.enabled ? copy.watching : copy.paused} ·{' '}
                    {copy.seen.replace('{n}', String(w.seen_count))} · {copy.lastPoll}{' '}
                    {w.last_polled_at ? fmt.format(new Date(w.last_polled_at)) : copy.never}
                  </small>
                </span>
                <select
                  className="ch-select"
                  aria-label={copy.cadence}
                  value={CADENCES.includes(w.polls_per_day) ? w.polls_per_day : 1}
                  disabled={!!busy}
                  onChange={(e) =>
                    run(`c${w.id}`, async () => {
                      const r = await toolCall<{ watch: Watch }>(
                        `/sources/${encodeURIComponent(w.id)}`,
                        'PATCH',
                        {
                          polls_per_day: Number(e.target.value),
                        },
                      );
                      replace(r.watch);
                    })
                  }
                >
                  {CADENCES.map((n) => (
                    <option key={n} value={n}>
                      {copy.cadences[String(n)]}
                    </option>
                  ))}
                </select>
                <Switch
                  checked={w.enabled}
                  label={copy.watching}
                  disabled={!!busy}
                  onChange={(v) =>
                    run(`t${w.id}`, async () => {
                      const r = await toolCall<{ watch: Watch }>(
                        `/sources/${encodeURIComponent(w.id)}`,
                        'PATCH',
                        {
                          enabled: v,
                        },
                      );
                      replace(r.watch);
                    })
                  }
                />
                <button
                  type="button"
                  className="ch-btn ch-btn--secondary ch-btn--compact"
                  disabled={!!busy}
                  onClick={() =>
                    run(`p${w.id}`, async () => {
                      await toolCall(`/sources/${encodeURIComponent(w.id)}/poll`);
                      setMsg({ ok: true, text: copy.scanning });
                    })
                  }
                >
                  {copy.pollNow}
                </button>
                <button
                  type="button"
                  className="ch-btn ch-btn--gray ch-btn--compact"
                  disabled={!!busy}
                  onClick={() => {
                    if (!window.confirm(copy.removeConfirm)) return;
                    void run(`d${w.id}`, async () => {
                      await toolCall(`/sources/${encodeURIComponent(w.id)}`, 'DELETE');
                      setWatches((ws) => ws.filter((x) => x.id !== w.id));
                    });
                  }}
                >
                  {copy.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
