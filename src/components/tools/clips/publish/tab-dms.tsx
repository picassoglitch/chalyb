'use client';

// DMs: conversations across the connected accounts, the thread, reply and
// archive.

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, Send } from 'lucide-react';
import { publishApi, usePublishErrorText } from './api';
import { InlineMsg, PlatformTile, type Msg } from './common';

interface Conversation {
  account_id: string;
  conversation_id: string;
  platform: string;
  participant_name?: string | null;
  participant_username?: string | null;
  status?: string | null;
}
interface Message {
  direction?: string;
  text?: string | null;
}

export function DmsTab() {
  const t = useTranslations('clipsPublish.dms');
  const errText = usePublishErrorText();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Conversation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    return publishApi<{ conversations: Conversation[] }>('inbox/conversations.json').then((r) => {
      if (r.ok) setConvs(r.data.conversations ?? []);
      else {
        setErr(errText(r.error));
        setConvs([]);
      }
    });
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);

  const name = (c: Conversation) => c.participant_name || c.participant_username || t('contact');

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-dms-h">
      <header>
        <h2 id="pub-dms-h">{t('title')}</h2>
      </header>
      <div className="ch-pub-inbox">
        <div className="ch-pub-convs" aria-label={t('listAria')}>
          {convs === null ? (
            <p className="ch-pub-hint">{t('loading')}</p>
          ) : err ? (
            <p className="ch-pub-err">{err}</p>
          ) : convs.length === 0 ? (
            <p className="ch-pub-hint">{t('empty')}</p>
          ) : (
            convs.map((c) => (
              <button
                key={`${c.account_id}-${c.conversation_id}`}
                type="button"
                className="ch-pub-conv"
                aria-current={open?.conversation_id === c.conversation_id}
                onClick={() => {
                  setNotice(null);
                  setOpen(c);
                }}
              >
                <PlatformTile id={c.platform} small />
                <span className="ch-pub-grow">{name(c)}</span>
                {c.status === 'archived' && (
                  <span className="ch-pill ch-pill--gray">{t('archived')}</span>
                )}
              </button>
            ))
          )}
        </div>
        <div>
          {open ? (
            <Thread
              key={open.conversation_id}
              conv={open}
              title={name(open)}
              onArchived={async () => {
                setOpen(null);
                setNotice(t('archivedDone'));
                await load();
              }}
            />
          ) : (
            <p className="ch-pub-hint">{notice ?? t('pick')}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Thread({
  conv,
  title,
  onArchived,
}: {
  conv: Conversation;
  title: string;
  onArchived: () => Promise<void>;
}) {
  const t = useTranslations('clipsPublish.dms');
  const errText = usePublishErrorText();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    return publishApi<{ messages: Message[] }>('inbox/messages.json', {
      query: { conversation_id: conv.conversation_id },
    }).then((r) => {
      setMsgs(r.ok ? (r.data.messages ?? []) : []);
      if (!r.ok) setMsg({ kind: 'bad', text: errText(r.error) });
    });
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per conversation
  }, [conv.conversation_id]);

  return (
    <div className="ch-pub-stack">
      <div className="ch-pub-row">
        <PlatformTile id={conv.platform} />
        <b className="ch-pub-grow">{title}</b>
        <button
          type="button"
          className="ch-btn ch-btn--gray ch-btn--tiny"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await publishApi('inbox/conversations/archive', {
              body: { account_id: conv.account_id, conversation_id: conv.conversation_id },
            });
            setBusy(false);
            if (!r.ok) {
              setMsg({ kind: 'bad', text: errText(r.error) });
              return;
            }
            await onArchived();
          }}
        >
          <Archive aria-hidden="true" />
          {t('archive')}
        </button>
      </div>
      <div className="ch-pub-thread" aria-live="polite">
        {msgs === null ? (
          <p className="ch-pub-hint">{t('loading')}</p>
        ) : msgs.length === 0 ? (
          <p className="ch-pub-hint">{t('noMessages')}</p>
        ) : (
          msgs.map((m, i) => (
            <div
              key={i}
              className={`ch-bubble${m.direction === 'outgoing' ? ' ch-bubble--me' : ''}`}
              style={m.direction === 'outgoing' ? { justifySelf: 'end' } : { justifySelf: 'start' }}
            >
              {m.text}
            </div>
          ))
        )}
      </div>
      <form
        className="ch-pub-row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          const r = await publishApi('inbox/conversations/reply', {
            body: {
              account_id: conv.account_id,
              conversation_id: conv.conversation_id,
              message: text.trim(),
              platform: conv.platform,
            },
          });
          setBusy(false);
          if (!r.ok) {
            setMsg({ kind: 'bad', text: errText(r.error) });
            return;
          }
          setText('');
          setMsg(null);
          await load();
        }}
      >
        <input
          className="ch-input ch-pub-grow"
          value={text}
          placeholder={t('replyPlaceholder')}
          aria-label={t('replyTo', { contacto: title })}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="ch-btn ch-btn--primary ch-btn--compact" disabled={busy}>
          <Send aria-hidden="true" />
          {t('send')}
        </button>
      </form>
      <InlineMsg msg={msg} />
    </div>
  );
}
