'use client';

// "Configurar {plataforma}": the engine's channel edit form. The saved key
// never comes back to the page: the field starts empty, and "Mostrar" shows
// the saved one only after re-authentication (useKeyReveal).

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sheet } from '@/components/ui/sheet';
import { isCustomPlatform, PLATFORM_META, validIngestUrl } from '@/lib/tools/envivo-platforms';
import type { DestinationPatch, LiveDestination } from '@/lib/tools/adapters/tools';
import { ReauthSheet, useKeyReveal, ValueRow } from './stream-key';

export function ChannelEdit({
  d,
  busy,
  onClose,
  onSave,
}: {
  d: LiveDestination;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: DestinationPatch) => void;
}) {
  const t = useTranslations('liveTool.edit');
  const tc = useTranslations('liveTool.channels');
  const meta = PLATFORM_META[d.platformId];
  const custom = isCustomPlatform(d.platformId);
  const fixedIngest = !custom && meta.ingestHint.length > 0;
  const [handle, setHandle] = useState(d.channelHandle);
  const [title, setTitle] = useState(d.streamTitle);
  const [ingest, setIngest] = useState(d.ingestUrl || meta.ingestHint);
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const saved = useKeyReveal({ id: d.id });
  const ingestOk = validIngestUrl(ingest);
  const canSave =
    !busy && ingestOk && ingest.trim().length > 0 && (key.trim().length > 0 || d.hasStreamKey);

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('title', { plataforma: meta.name })}
      closeLabel={tc('close')}
    >
      <form
        className="ch-ev-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          onSave({
            channelHandle: handle.trim(),
            streamTitle: title.trim(),
            ingestUrl: ingest.trim(),
            ...(key.trim() ? { streamKey: key.trim() } : {}),
          });
        }}
      >
        {d.oauthConnected && (
          <p className="ch-ev-ok">{t('oauthNote', { plataforma: meta.name })}</p>
        )}
        <label className="ch-field">
          <span>{t('handle')}</span>
          <input
            className="ch-input"
            value={handle}
            maxLength={200}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="ch-field">
          <span>{t('streamTitle')}</span>
          <input
            className="ch-input"
            value={title}
            maxLength={200}
            placeholder={t('streamTitlePh')}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="ch-field">
          <span>{t('ingest')}</span>
          <input
            className="ch-input ch-ev-mono"
            value={ingest}
            maxLength={500}
            readOnly={fixedIngest}
            aria-invalid={!ingestOk}
            onChange={(e) => setIngest(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          {fixedIngest && <small className="ch-muted">{t('ingestFixed')}</small>}
          {!ingestOk && (
            <small role="alert" className="ch-ev-err">
              {t('ingestInvalid')}
            </small>
          )}
        </label>
        <label className="ch-field">
          <span>{t('key')}</span>
          <span className="ch-ev-key__row">
            <input
              className="ch-input ch-ev-mono"
              type={showKey ? 'text' : 'password'}
              value={key}
              maxLength={500}
              placeholder={t('keyPh')}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? t('hide') : t('show')}
            </button>
          </span>
          <small className="ch-muted">{t(`hint.${d.platformId}`)}</small>
          {d.hasStreamKey && <small className="ch-muted">{t('keySaved')}</small>}
        </label>
        {d.hasStreamKey && (
          <ValueRow
            id={`saved-${d.id}`}
            label={t('key')}
            value={saved.key}
            secret={{
              shown: saved.key !== null,
              busy: saved.busy,
              onShow: () => void saved.reveal(''),
              onHide: saved.hide,
            }}
          />
        )}
        <div className="ch-ev-form__btns">
          <button type="button" className="ch-btn ch-btn--gray" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="ch-btn ch-btn--primary" disabled={!canSave}>
            {t('save')}
          </button>
        </div>
      </form>
      <ReauthSheet r={saved} next="/app/en-vivo" />
    </Sheet>
  );
}
