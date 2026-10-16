'use client';

// Comentarios: one feed of the comments on the person's posts, with reply,
// like and hide (only where the network supports hiding).

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EyeOff, Heart, Reply, Send } from 'lucide-react';
import { publishApi, usePublishErrorText } from './api';
import { InlineMsg, PlatformTile, platformName, type Msg } from './common';

interface Comment {
  account_id: string;
  post_id?: string | null;
  platform_post_id?: string | null;
  comment_id: string;
  platform: string;
  author_name?: string | null;
  author_username?: string | null;
  text?: string | null;
  status?: string | null;
  can_hide?: boolean;
}

export function CommentsTab() {
  const t = useTranslations('clipsPublish.comments');
  const errText = usePublishErrorText();
  const [items, setItems] = useState<Comment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void publishApi<{ comments: Comment[] }>('inbox/comments.json').then((r) => {
      if (r.ok) setItems(r.data.comments ?? []);
      else {
        setErr(errText(r.error));
        setItems([]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-comments-h">
      <header>
        <h2 id="pub-comments-h">{t('title')}</h2>
      </header>
      {items === null ? (
        <p className="ch-pub-hint">{t('loading')}</p>
      ) : err ? (
        <p className="ch-pub-err">{err}</p>
      ) : items.length === 0 ? (
        <p className="ch-pub-hint">{t('empty')}</p>
      ) : (
        <ul className="ch-pub-list">
          {items.map((c) => (
            <CommentRow key={`${c.account_id}-${c.comment_id}`} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentRow({ c }: { c: Comment }) {
  const t = useTranslations('clipsPublish.comments');
  const errText = usePublishErrorText();
  const [hidden, setHidden] = useState(c.status === 'hidden');
  const [liked, setLiked] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const postId = c.platform_post_id || c.post_id || '';
  const author = c.author_name || c.author_username || t('anonymous');

  async function act(path: string, body: Record<string, unknown>): Promise<boolean> {
    const r = await publishApi(path, { body });
    if (!r.ok) {
      setMsg({ kind: 'bad', text: errText(r.error) });
      return false;
    }
    return true;
  }

  return (
    <li
      className={`ch-pub-item${hidden ? ' ch-pub-item--dim' : ''}`}
      style={{ alignItems: 'flex-start' }}
    >
      <PlatformTile id={c.platform} />
      <span className="ch-pub-item__tx">
        <b>
          {author}
          {hidden && (
            <>
              {' '}
              <span className="ch-pill ch-pill--gray">{t('hidden')}</span>
            </>
          )}
        </b>
        <span style={{ whiteSpace: 'normal' }}>{c.text}</span>
        <small>{platformName(c.platform)}</small>
        <span className="ch-pub-row" style={{ marginTop: 6 }}>
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny"
            aria-expanded={replying}
            onClick={() => setReplying(!replying)}
          >
            <Reply aria-hidden="true" />
            {t('reply')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny"
            aria-pressed={liked}
            onClick={async () => {
              if (
                await act('inbox/comments/like', {
                  account_id: c.account_id,
                  post_id: postId,
                  comment_id: c.comment_id,
                })
              )
                setLiked(true);
            }}
          >
            <Heart aria-hidden="true" />
            {liked ? t('liked') : t('like')}
          </button>
          {c.can_hide && !hidden && (
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--tiny"
              onClick={async () => {
                if (
                  await act('inbox/comments/hide', {
                    account_id: c.account_id,
                    post_id: postId,
                    comment_id: c.comment_id,
                    platform: c.platform,
                  })
                )
                  setHidden(true);
              }}
            >
              <EyeOff aria-hidden="true" />
              {t('hide')}
            </button>
          )}
          <InlineMsg msg={msg} />
        </span>
        {replying && (
          <form
            className="ch-pub-row"
            style={{ marginTop: 8 }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              if (
                await act('inbox/comments/reply', {
                  account_id: c.account_id,
                  post_id: postId,
                  comment_id: c.comment_id,
                  message: reply.trim(),
                })
              ) {
                setReply('');
                setReplying(false);
                setMsg({ kind: 'ok', text: t('replied') });
              }
            }}
          >
            <input
              className="ch-input ch-pub-grow"
              value={reply}
              placeholder={t('replyPlaceholder')}
              aria-label={t('replyTo', { autor: author })}
              onChange={(e) => setReply(e.target.value)}
            />
            <button type="submit" className="ch-btn ch-btn--primary ch-btn--compact">
              <Send aria-hidden="true" />
              {t('send')}
            </button>
          </form>
        )}
      </span>
    </li>
  );
}
