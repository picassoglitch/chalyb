'use client';

// "Actualizar títulos" (engine BroadcastComposerModal): one set of fields;
// each row shows which of the person's channels will receive it.

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  BROADCAST_FIELDS,
  fieldTargets,
  LANGUAGE_OPTIONS,
  PLATFORM_META,
  VISIBILITIES,
  type BroadcastMeta,
  type PlatformId,
  type Visibility,
} from '@/lib/tools/envivo-platforms';

export function BroadcastComposer({
  meta,
  platforms,
  busy,
  onClose,
  onPublish,
}: {
  meta: BroadcastMeta;
  platforms: PlatformId[];
  busy: boolean;
  onClose: () => void;
  onPublish: (meta: BroadcastMeta) => void;
}) {
  const t = useTranslations('liveTool.composer');
  const tc = useTranslations('liveTool.channels');
  const [draft, setDraft] = useState(meta);
  const [tag, setTag] = useState('');
  const connected = useMemo(() => [...new Set(platforms)], [platforms]);
  const set = <K extends keyof BroadcastMeta>(k: K, v: BroadcastMeta[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const commitTag = () => {
    const v = tag.trim().slice(0, 100);
    if (v && !draft.tags.includes(v) && draft.tags.length < 30) set('tags', [...draft.tags, v]);
    setTag('');
  };

  return (
    <Sheet open onClose={onClose} title={t('title')} closeLabel={tc('close')}>
      <form
        className="ch-ev-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.title.trim()) onPublish(draft);
        }}
      >
        <p className="ch-muted">{t('sub')}</p>
        {BROADCAST_FIELDS.map((f) => {
          const targets = fieldTargets(f.id, connected);
          const id = `bc-${f.id}`;
          return (
            <div key={f.id} className="ch-ev-bc">
              <div className="ch-ev-bc__head">
                <label htmlFor={id} className="ch-ev-key__l">
                  {t(`field.${f.id}`)}
                </label>
                <span className="ch-ev-bc__chips">
                  {targets.length === 0 ? (
                    <i className="ch-muted">{t('noTargets')}</i>
                  ) : (
                    targets.map((p) => (
                      <span key={p} className="ch-ev-chip">
                        <i style={{ background: PLATFORM_META[p].color }} aria-hidden="true" />
                        {PLATFORM_META[p].name}
                      </span>
                    ))
                  )}
                </span>
              </div>
              {f.kind === 'text' && (
                <input
                  id={id}
                  className="ch-input"
                  maxLength={200}
                  value={draft[f.id] as string}
                  placeholder={t(`ph.${f.id as 'title' | 'category'}`)}
                  onChange={(e) => set(f.id, e.target.value as never)}
                  autoComplete="off"
                />
              )}
              {f.kind === 'textarea' && (
                <textarea
                  id={id}
                  className="ch-input ch-ev-textarea"
                  rows={3}
                  maxLength={5000}
                  value={draft.description}
                  placeholder={t('ph.description')}
                  onChange={(e) => set('description', e.target.value)}
                />
              )}
              {f.kind === 'tags' && (
                <div className="ch-ev-tags">
                  {draft.tags.map((x) => (
                    <span key={x} className="ch-ev-chip">
                      {x}
                      <button
                        type="button"
                        aria-label={t('tagRemove', { etiqueta: x })}
                        onClick={() =>
                          set(
                            'tags',
                            draft.tags.filter((y) => y !== x),
                          )
                        }
                      >
                        <X aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <input
                    id={id}
                    className="ch-input"
                    value={tag}
                    maxLength={100}
                    placeholder={t('ph.tags')}
                    onChange={(e) => setTag(e.target.value)}
                    onBlur={commitTag}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        commitTag();
                      } else if (e.key === 'Backspace' && !tag && draft.tags.length)
                        set('tags', draft.tags.slice(0, -1));
                    }}
                    autoComplete="off"
                  />
                </div>
              )}
              {f.kind === 'select' && f.id === 'language' && (
                <select
                  id={id}
                  className="ch-input ch-select"
                  value={draft.language}
                  onChange={(e) => set('language', e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label ?? t('languageNone')}
                    </option>
                  ))}
                </select>
              )}
              {f.kind === 'select' && f.id === 'visibility' && (
                <select
                  id={id}
                  className="ch-input ch-select"
                  value={draft.visibility}
                  onChange={(e) => set('visibility', e.target.value as Visibility)}
                >
                  {VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {t(`visibility.${v}`)}
                    </option>
                  ))}
                </select>
              )}
              {f.kind === 'toggle' && (
                <Switch
                  checked={draft[f.id] as boolean}
                  label={t(`field.${f.id}`)}
                  onChange={(v) => set(f.id, v as never)}
                />
              )}
            </div>
          );
        })}
        <div className="ch-ev-form__btns">
          <button type="button" className="ch-btn ch-btn--gray" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="ch-btn ch-btn--primary"
            disabled={busy || !draft.title.trim()}
          >
            {t('publish')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
