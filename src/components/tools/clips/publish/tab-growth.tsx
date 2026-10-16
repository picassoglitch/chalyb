'use client';

// Crecimiento (paid plans): comment→DM automations, contacts, drip
// sequences and broadcasts. Other plans see what it does and where to
// upgrade.

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pause, Play, Plus, Rocket, Send } from 'lucide-react';
import { ButtonLink } from '@/components/ui/primitives';
import { publishApi, publishRead, usePublishErrorText } from './api';
import { InlineMsg, PlatformTile, platformName, useConfirm, type Msg } from './common';
import type { TabProps } from './publish-center';

interface Automation {
  _id?: string;
  id?: string;
  name?: string;
  platform?: string;
  isActive?: boolean;
  stats?: { triggered?: number; dmsSent?: number };
}
interface Sequence {
  _id?: string;
  id?: string;
  name?: string;
  isActive?: boolean;
  status?: string;
}
interface Contact {
  contact_key?: string;
  name?: string | null;
  username?: string | null;
  tags?: string | null;
}

const TAGS = ['comment-lead', 'dm-lead'] as const;
const idOf = (x: { _id?: string; id?: string }) => x._id ?? x.id ?? '';

export function GrowthTab({ ov }: TabProps) {
  const t = useTranslations('clipsPublish.growth');
  if (!ov.is_pro)
    return (
      <div className="ch-card ch-state">
        <span className="ch-state__ic" aria-hidden="true">
          <Rocket />
        </span>
        <h2 className="ch-h2">{t('upsell.title')}</h2>
        <p className="ch-muted" style={{ maxWidth: 520 }}>
          {t('upsell.body')}
        </p>
        <ButtonLink href="/app/planes">{t('upsell.cta')}</ButtonLink>
      </div>
    );
  return <GrowthPanels ov={ov} />;
}

function GrowthPanels({ ov }: { ov: TabProps['ov'] }) {
  const t = useTranslations('clipsPublish.growth');
  const errText = usePublishErrorText();
  const [ask, confirmNode] = useConfirm();
  const accounts = ov.accounts;
  const metaAccounts = accounts.filter(
    (a) => a.platform === 'instagram' || a.platform === 'facebook',
  );
  const label = (a: { platform: string; account_id: string }) =>
    `${platformName(a.platform)} · ${a.account_id.slice(-6)}`;

  // automations
  const [autos, setAutos] = useState<Automation[] | null>(null);
  const [autoAccount, setAutoAccount] = useState(metaAccounts[0]?.account_id ?? '');
  const [posts, setPosts] = useState<{ post_id: string; content: string | null }[]>([]);
  const [autoPost, setAutoPost] = useState('');
  const [keywords, setKeywords] = useState('CLIP, LINK');
  const [dm, setDm] = useState(t('auto.dmDefault'));
  const [publicReply, setPublicReply] = useState('');
  const [autoMsg, setAutoMsg] = useState<Msg>(null);
  // contacts
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  // sequences
  const [seqs, setSeqs] = useState<Sequence[] | null>(null);
  const [seqMsg, setSeqMsg] = useState<Msg>(null);
  // broadcast
  const [bcAccount, setBcAccount] = useState(accounts[0]?.account_id ?? '');
  const [bcTag, setBcTag] = useState('');
  const [bcName, setBcName] = useState('');
  const [bcText, setBcText] = useState('');
  const [bcMsg, setBcMsg] = useState<Msg>(null);

  function loadAutos() {
    return publishRead<{ automations: Automation[] }>('growth/automations.json', (r) => {
      setAutos(r.ok ? (r.data.automations ?? []) : []);
      if (!r.ok) setAutoMsg({ kind: 'bad', text: errText(r.error) });
    });
  }
  function loadSeqs() {
    return publishRead<{ sequences: Sequence[] }>('growth/sequences.json', (r) => {
      setSeqs(r.ok ? (r.data.sequences ?? []) : []);
      if (!r.ok) setSeqMsg({ kind: 'bad', text: errText(r.error) });
    });
  }
  useEffect(() => {
    void loadAutos();
    void loadSeqs();
    void publishRead<{ history: { post_id: string; content: string | null }[] }>('feed.json', (r) =>
      setPosts(r.ok ? (r.data.history ?? []).slice(0, 20) : []),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);
  useEffect(() => {
    const id = setTimeout(() => {
      void publishApi<{ contacts: Contact[] }>('growth/contacts.json', { query: { q, tag } }).then(
        (r) => setContacts(r.ok ? (r.data.contacts ?? []) : []),
      );
    }, 250);
    return () => clearTimeout(id);
  }, [q, tag]);

  return (
    <div className="ch-pub-stack">
      <section className="ch-card ch-pub-sec" aria-labelledby="pub-auto-dm-h">
        <header>
          <h2 id="pub-auto-dm-h">{t('auto.title')}</h2>
          <span className="ch-pub__push ch-pub-hint">{t('auto.only')}</span>
        </header>
        {metaAccounts.length === 0 ? (
          <p className="ch-pub-hint">{t('auto.noAccount')}</p>
        ) : (
          <>
            <div className="ch-pub-fields">
              <label className="ch-pub-field">
                <span>{t('auto.account')}</span>
                <select
                  className="ch-select"
                  value={autoAccount}
                  onChange={(e) => setAutoAccount(e.target.value)}
                >
                  {metaAccounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {label(a)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ch-pub-field">
                <span>{t('auto.post')}</span>
                <select
                  className="ch-select"
                  value={autoPost}
                  onChange={(e) => setAutoPost(e.target.value)}
                >
                  <option value="">{t('auto.anyPost')}</option>
                  {posts.map((p) => (
                    <option key={p.post_id} value={p.post_id}>
                      {(p.content || p.post_id).slice(0, 40)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ch-pub-field">
                <span>{t('auto.keywords')}</span>
                <input
                  className="ch-input"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </label>
            </div>
            <label className="ch-pub-field">
              <span>{t('auto.dm')}</span>
              <input className="ch-input" value={dm} onChange={(e) => setDm(e.target.value)} />
            </label>
            <label className="ch-pub-field">
              <span>{t('auto.reply')}</span>
              <input
                className="ch-input"
                value={publicReply}
                placeholder={t('auto.replyPlaceholder')}
                onChange={(e) => setPublicReply(e.target.value)}
              />
            </label>
            <div className="ch-pub-row">
              <button
                type="button"
                className="ch-btn ch-btn--primary ch-btn--compact"
                onClick={async () => {
                  const post = posts.find((p) => p.post_id === autoPost);
                  const r = await publishApi('growth/automations', {
                    body: {
                      account_id: autoAccount,
                      name: `Auto ${(post?.content || t('auto.clip')).slice(0, 40)}`,
                      dm_message: dm,
                      keywords: keywords
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      post_id: autoPost || null,
                      comment_reply: publicReply || null,
                    },
                  });
                  setAutoMsg(
                    r.ok
                      ? { kind: 'ok', text: t('auto.created') }
                      : { kind: 'bad', text: errText(r.error) },
                  );
                  if (r.ok) await loadAutos();
                }}
              >
                <Plus aria-hidden="true" />
                {t('auto.create')}
              </button>
              <InlineMsg msg={autoMsg} />
            </div>
          </>
        )}
        {autos === null ? (
          <p className="ch-pub-hint">{t('loading')}</p>
        ) : autos.length === 0 ? (
          <p className="ch-pub-hint">{t('auto.none')}</p>
        ) : (
          <ul className="ch-pub-list">
            {autos.map((a) => (
              <li key={idOf(a)} className="ch-pub-item">
                {a.platform && <PlatformTile id={a.platform} small />}
                <span className="ch-pub-item__tx">
                  <b>{a.name}</b>
                  <small>
                    {t('auto.stats', {
                      disparos: a.stats?.triggered ?? 0,
                      dms: a.stats?.dmsSent ?? 0,
                    })}
                  </small>
                </span>
                <span className={`ch-pill ch-pill--${a.isActive ? 'ok' : 'gray'}`}>
                  {a.isActive ? t('active') : t('paused')}
                </span>
                <button
                  type="button"
                  className="ch-btn ch-btn--gray ch-btn--tiny"
                  onClick={async () => {
                    const r = await publishApi(
                      `growth/automations/${encodeURIComponent(idOf(a))}/toggle`,
                      { body: { active: !a.isActive } },
                    );
                    if (!r.ok) setAutoMsg({ kind: 'bad', text: errText(r.error) });
                    await loadAutos();
                  }}
                >
                  {a.isActive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  {a.isActive ? t('pause') : t('activate')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ch-card ch-pub-sec" aria-labelledby="pub-contacts-h">
        <header>
          <h2 id="pub-contacts-h">{t('contacts.title')}</h2>
        </header>
        <div className="ch-pub-row">
          <input
            className="ch-input ch-pub-grow"
            value={q}
            placeholder={t('contacts.search')}
            aria-label={t('contacts.search')}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="ch-select"
            value={tag}
            aria-label={t('contacts.tag')}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">{t('contacts.allTags')}</option>
            {TAGS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        {contacts === null ? (
          <p className="ch-pub-hint">{t('loading')}</p>
        ) : contacts.length === 0 ? (
          <p className="ch-pub-hint">{t('contacts.none')}</p>
        ) : (
          <ul className="ch-pub-list">
            {contacts.map((c, i) => (
              <li key={c.contact_key ?? i} className="ch-pub-item" style={{ padding: '8px 0' }}>
                <span className="ch-pub-item__tx">
                  <b>{c.name || c.username || c.contact_key}</b>
                  {c.tags && <small>{c.tags}</small>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ch-card ch-pub-sec" aria-labelledby="pub-seq-h">
        <header>
          <h2 id="pub-seq-h">{t('seq.title')}</h2>
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--tiny ch-pub__push"
            disabled={accounts.length === 0}
            onClick={async () => {
              const account = autoAccount || accounts[0]?.account_id || '';
              const r = await publishApi('growth/sequences', {
                body: { account_id: account, name: 'Bienvenida Chalyb', template: 'bienvenida' },
              });
              setSeqMsg(
                r.ok
                  ? { kind: 'ok', text: t('seq.created') }
                  : { kind: 'bad', text: errText(r.error) },
              );
              if (r.ok) await loadSeqs();
            }}
          >
            <Plus aria-hidden="true" />
            {t('seq.template')}
          </button>
        </header>
        <InlineMsg msg={seqMsg} />
        {seqs === null ? (
          <p className="ch-pub-hint">{t('loading')}</p>
        ) : seqs.length === 0 ? (
          <p className="ch-pub-hint">{t('seq.none')}</p>
        ) : (
          <ul className="ch-pub-list">
            {seqs.map((s) => {
              const active = s.isActive ?? s.status === 'active';
              return (
                <li key={idOf(s)} className="ch-pub-item">
                  <span className="ch-pub-item__tx">
                    <b>{s.name}</b>
                  </span>
                  <span className={`ch-pill ch-pill--${active ? 'ok' : 'gray'}`}>
                    {active ? t('active') : t('paused')}
                  </span>
                  <button
                    type="button"
                    className="ch-btn ch-btn--gray ch-btn--tiny"
                    onClick={async () => {
                      const r = await publishApi(
                        `growth/sequences/${encodeURIComponent(idOf(s))}/toggle`,
                        { body: { active: !active } },
                      );
                      if (!r.ok) setSeqMsg({ kind: 'bad', text: errText(r.error) });
                      await loadSeqs();
                    }}
                  >
                    {active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    {active ? t('pause') : t('activate')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        className="ch-card ch-pub-sec"
        aria-labelledby="pub-bc-h"
        style={{ boxShadow: '0 0 0 2px var(--tint), var(--shadow)' }}
      >
        <header>
          <h2 id="pub-bc-h">{t('bc.title')}</h2>
          <span className="ch-pub__push ch-pub-hint">{t('bc.cap')}</span>
        </header>
        <div className="ch-pub-fields">
          <label className="ch-pub-field">
            <span>{t('bc.account')}</span>
            <select
              className="ch-select"
              value={bcAccount}
              onChange={(e) => setBcAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {label(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-pub-field">
            <span>{t('bc.segment')}</span>
            <select className="ch-select" value={bcTag} onChange={(e) => setBcTag(e.target.value)}>
              <option value="">{t('bc.all')}</option>
              {TAGS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="ch-pub-field">
          <span>{t('bc.name')}</span>
          <input
            className="ch-input"
            value={bcName}
            placeholder={t('bc.namePlaceholder')}
            onChange={(e) => setBcName(e.target.value)}
          />
        </label>
        <label className="ch-pub-field">
          <span>{t('bc.message')}</span>
          <textarea
            className="ch-input"
            rows={2}
            value={bcText}
            placeholder={t('bc.messagePlaceholder')}
            onChange={(e) => setBcText(e.target.value)}
          />
        </label>
        {ov.feature_whatsapp && <p className="ch-pub-hint">{t('bc.whatsapp')}</p>}
        <div className="ch-pub-row">
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--compact"
            disabled={accounts.length === 0}
            onClick={() => {
              if (!bcName.trim() || !bcText.trim()) {
                setBcMsg({ kind: 'bad', text: t('bc.needFields') });
                return;
              }
              ask({
                title: t('bc.confirmTitle'),
                body: bcTag ? t('bc.confirmTag', { tag: bcTag }) : t('bc.confirmAll'),
                cta: t('bc.send'),
                danger: true,
                onConfirm: async () => {
                  const r = await publishApi('growth/broadcasts/send', {
                    body: {
                      account_id: bcAccount,
                      name: bcName.trim(),
                      message: bcText.trim(),
                      tag: bcTag || null,
                      confirm: true,
                    },
                  });
                  setBcMsg(
                    r.ok
                      ? { kind: 'ok', text: t('bc.sent') }
                      : { kind: 'bad', text: errText(r.error) },
                  );
                },
              });
            }}
          >
            <Send aria-hidden="true" />
            {t('bc.send')}
          </button>
          <InlineMsg msg={bcMsg} />
        </div>
      </section>
      {confirmNode}
    </div>
  );
}
