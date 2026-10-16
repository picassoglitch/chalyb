'use client';

// Clips · Personas (mode "a"): who the captions sound like — language, the
// languages to write versions in, the voice prompt, tags. Create and edit.

import { useState } from 'react';
import { errorText, toolCall, ToolCallError, type ErrorCopy } from './tool-call';

export interface Persona {
  id: string;
  name: string;
  primary_language: string;
  target_languages: string[];
  voice_prompt: string;
  routing_tags: string[];
}

export interface PersonasCopy {
  newTitle: string;
  editTitle: string;
  id: string;
  idHint: string;
  name: string;
  language: string;
  targets: string;
  targetsHint: string;
  prompt: string;
  tags: string;
  tagsHint: string;
  create: string;
  save: string;
  cancel: string;
  edit: string;
  saved: string;
  exists: string;
  empty: string;
  listTitle: string;
  working: string;
  errors: ErrorCopy;
}

const empty = {
  id: '',
  name: '',
  primary_language: 'es',
  targets: 'es',
  voice_prompt: '',
  tags: '',
};
const csv = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function PersonasPanel({ initial, copy }: { initial: Persona[]; copy: PersonasCopy }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function startEdit(p: Persona) {
    setEditing(p.id);
    setMsg(null);
    setForm({
      id: p.id,
      name: p.name,
      primary_language: p.primary_language,
      targets: p.target_languages.join(', '),
      voice_prompt: p.voice_prompt,
      tags: p.routing_tags.join(', '),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const body = {
      name: form.name,
      primary_language: form.primary_language,
      voice_prompt: form.voice_prompt,
      target_languages: csv(form.targets),
      routing_tags: csv(form.tags),
    };
    try {
      const r = editing
        ? await toolCall<{ persona: Persona }>(
            `/personas/${encodeURIComponent(editing)}`,
            'PUT',
            body,
          )
        : await toolCall<{ persona: Persona }>('/personas', 'POST', { ...body, id: form.id });
      setList((l) =>
        editing ? l.map((p) => (p.id === r.persona.id ? r.persona : p)) : [...l, r.persona],
      );
      setEditing(null);
      setForm(empty);
      setMsg({ ok: true, text: copy.saved });
    } catch (err) {
      setMsg({
        ok: false,
        text:
          err instanceof ToolCallError && err.refusal === 'exists'
            ? copy.exists
            : errorText(err, copy.errors),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ch-ce-stack">
      <section className="ch-ce-stack" aria-labelledby="ce-pers">
        <h2 id="ce-pers" className="ch-ghead">
          {copy.listTitle}
        </h2>
        {list.length === 0 ? (
          <p className="ch-muted">{copy.empty}</p>
        ) : (
          <ul className="ch-card ch-ce-rows">
            {list.map((p) => (
              <li key={p.id} className="ch-ce-row">
                <span className="ch-ce-row__tx">
                  <b>{p.name}</b>
                  <small>
                    {p.id} · {p.primary_language}
                    {p.target_languages.length ? ` → ${p.target_languages.join(', ')}` : ''}
                  </small>
                </span>
                <button
                  type="button"
                  className="ch-btn ch-btn--secondary ch-btn--compact"
                  onClick={() => startEdit(p)}
                >
                  {copy.edit}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="ch-card ch-ce-card" onSubmit={submit}>
        <h2 className="ch-h3">{editing ? copy.editTitle : copy.newTitle}</h2>
        <div className="ch-ce-grid3">
          {!editing && (
            <label className="ch-ce-field">
              {copy.id}
              <input
                className="ch-input"
                required
                pattern="[A-Za-z0-9_\-]+"
                maxLength={64}
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
              />
              <small>{copy.idHint}</small>
            </label>
          )}
          <label className="ch-ce-field">
            {copy.name}
            <input
              className="ch-input"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="ch-ce-field">
            {copy.language}
            <input
              className="ch-input"
              required
              maxLength={16}
              value={form.primary_language}
              onChange={(e) => setForm({ ...form, primary_language: e.target.value })}
            />
          </label>
          <label className="ch-ce-field">
            {copy.targets}
            <input
              className="ch-input"
              value={form.targets}
              onChange={(e) => setForm({ ...form, targets: e.target.value })}
            />
            <small>{copy.targetsHint}</small>
          </label>
          <label className="ch-ce-field">
            {copy.tags}
            <input
              className="ch-input"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
            <small>{copy.tagsHint}</small>
          </label>
        </div>
        <label className="ch-ce-field">
          {copy.prompt}
          <textarea
            className="ch-input"
            required
            maxLength={8000}
            value={form.voice_prompt}
            onChange={(e) => setForm({ ...form, voice_prompt: e.target.value })}
          />
        </label>
        <div className="ch-ce-actions">
          <button type="submit" className="ch-btn ch-btn--primary" disabled={busy}>
            {busy ? copy.working : editing ? copy.save : copy.create}
          </button>
          {editing && (
            <button
              type="button"
              className="ch-btn ch-btn--secondary"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
            >
              {copy.cancel}
            </button>
          )}
        </div>
        {msg && (
          <p className={msg.ok ? 'ch-ce-ok' : 'ch-ce-err'} role={msg.ok ? 'status' : 'alert'}>
            {msg.text}
          </p>
        )}
      </form>
    </div>
  );
}
