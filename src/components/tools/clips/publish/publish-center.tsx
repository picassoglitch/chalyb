'use client';

// Centro de publicación (Clips → Publicar): everything the Clips app's
// /dashboard/publish/zernio did, inside the hub. The first paint comes from
// the server (overview); every action goes through the BFF (api.ts) and
// refreshes the overview after it lands.

import { useCallback, useEffect, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { Link2Off, Lock, Plus, TriangleAlert, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { publishApi, usePublishErrorText } from './api';
import { InlineMsg, PlatformTile, platformName, useConfirm, type Msg } from './common';
import { PUBLISH_TABS, isPublishTab, type Overview, type PublishTab } from './types';
import { SingleTab } from './tab-single';
import { BulkTab } from './tab-bulk';
import { PublishedTab } from './tab-published';
import { PerformanceTab } from './tab-performance';
import { CalendarTab } from './tab-calendar';
import { ScheduleTab } from './tab-schedule';
import { AutopilotTab } from './tab-autopilot';
import { CommentsTab } from './tab-comments';
import { DmsTab } from './tab-dms';
import { GrowthTab } from './tab-growth';
import { CommunityTab } from './tab-community';

export type Flash =
  | { kind: 'queued'; postId: string }
  | { kind: 'ok'; text: string }
  | { kind: 'warn'; text: string }
  | null;

export interface TabProps {
  ov: Overview;
  refresh: () => Promise<void>;
  setFlash: (f: Flash) => void;
  goTab: (t: PublishTab) => void;
  connect: (platform: string) => void;
  /** The plan includes auto-publish (TIER_CAPS.clipAutoPublish, VIP). */
  canAutopilot: boolean;
}

/** Start connecting one platform: the engine hands out the network's
 *  sign-in URL and this tab goes there (no popups in the app, TOOLS-SPEC
 *  §0.1). The network sends the person back to /app/clips/publicar/conectado,
 *  which returns here. */
export function useConnect(setMsg: (m: Msg) => void) {
  const t = useTranslations('clipsPublish.accounts');
  const errText = usePublishErrorText();
  const locale = useLocale();
  return useCallback(
    async (platform: string) => {
      setMsg({ kind: 'info', text: t('opening', { plataforma: platformName(platform) }) });
      const r = await publishApi<{ ok: boolean; auth_url: string }>('connect', {
        body: { platform, locale, next: '/app/clips/publicar' },
      });
      if (!r.ok || !r.data.auth_url) {
        setMsg({ kind: 'bad', text: r.ok ? t('failed') : errText(r.error) });
        return;
      }
      window.location.assign(r.data.auth_url);
    },
    [errText, locale, setMsg, t],
  );
}

export function PublishCenter({
  initial,
  initialTab,
  connected,
  canAutopilot,
}: {
  canAutopilot: boolean;
  initial: Overview;
  initialTab: PublishTab | null;
  /** Back from connecting a network (?conectado=<platform>). */
  connected?: string | null;
}) {
  const t = useTranslations('clipsPublish');
  const [ov, setOv] = useState(initial);
  const [tab, setTab] = useState<PublishTab>(initialTab ?? 'uno');
  const [flash, setFlash] = useState<Flash>(
    connected
      ? { kind: 'ok', text: t('accounts.connected', { plataforma: platformName(connected) }) }
      : null,
  );
  const [failedOpen, setFailedOpen] = useState(false);
  const [acctMsg, setAcctMsg] = useState<Msg>(null);

  const refresh = useCallback(async () => {
    const r = await publishApi<Overview>('overview');
    if (r.ok) setOv(r.data);
  }, []);

  const goTab = useCallback((next: PublishTab) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url.toString());
    } catch {}
  }, []);

  const connect = useConnect(setAcctMsg);
  // aceptacion-ux §7: what connecting means, before any OAuth window opens.
  const [askConnect, setAskConnect] = useState<string | null>(null);
  const tConnect = useTranslations('clipsTool.connect');
  const tConsent = useTranslations('consents.connect');

  // Back from connecting (?conectado=…): the overview is fresh already
  // (server render); just drop the flag from the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('conectado')) {
      url.searchParams.delete('conectado');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  if (!ov.configured)
    return (
      <div className="ch-card ch-state" role="status">
        <span className="ch-state__ic" aria-hidden="true">
          <TriangleAlert />
        </span>
        <h2 className="ch-h2">{t('notConfigured.title')}</h2>
        <p className="ch-muted">{t('notConfigured.body')}</p>
      </div>
    );

  const tabProps: TabProps = {
    ov,
    refresh,
    setFlash,
    goTab,
    connect: setAskConnect,
    canAutopilot,
  };

  return (
    <div className="ch-pub">
      <div className="ch-pub__head">
        <div>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-muted">
            {ov.profile
              ? t('subtitle', { perfil: ov.profile.name || ov.profile.id })
              : t('subtitleNoProfile')}
          </p>
        </div>
      </div>

      {flash && <FlashBanner flash={flash} onClose={() => setFlash(null)} />}

      {!ov.profile ? (
        <ProfileSetup
          onDone={async (f) => {
            setFlash(f);
            await refresh();
          }}
        />
      ) : (
        <>
          <div className="ch-pub-stats" role="group" aria-label={t('stats.aria')}>
            <button
              type="button"
              className="ch-card ch-pub-stat ch-pub-stat--ok"
              onClick={() => goTab('publicados')}
            >
              <b>{ov.stats.published}</b>
              <span>{t('stats.published')}</span>
            </button>
            <button
              type="button"
              className="ch-card ch-pub-stat ch-pub-stat--bad"
              onClick={() => {
                setFailedOpen(true);
                goTab('publicados');
              }}
            >
              <b>{ov.stats.failed}</b>
              <span>{t('stats.failed')}</span>
            </button>
            <div className="ch-card ch-pub-stat ch-pub-stat--acc">
              <b>{ov.stats.scheduled}</b>
              <span>{t('stats.scheduled')}</span>
            </div>
            <div className="ch-card ch-pub-stat">
              <b>{ov.stats.total}</b>
              <span>{t('stats.total')}</span>
            </div>
          </div>

          <AccountsRow
            ov={ov}
            refresh={refresh}
            connect={setAskConnect}
            msg={acctMsg}
            setFlash={setFlash}
          />
          {ov.connect_fetch_failed && (
            <div className="ch-bnr ch-bnr--warn" role="alert">
              <span className="ch-bnr__ic" aria-hidden="true">
                <TriangleAlert />
              </span>
              <span className="ch-bnr__tx">{t('accounts.fetchFailed')}</span>
            </div>
          )}

          <div className="ch-pub-tabs" role="tablist" aria-label={t('tabs.aria')}>
            {PUBLISH_TABS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                id={`pub-tab-${k}`}
                aria-selected={tab === k}
                aria-controls={`pub-panel-${k}`}
                onClick={() => goTab(k)}
              >
                {k === 'publicados' && ov.history.length > 0
                  ? t('tabs.publicadosN', { n: ov.history.length })
                  : t(`tabs.${k}`)}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`pub-panel-${tab}`} aria-labelledby={`pub-tab-${tab}`}>
            {tab === 'uno' && <SingleTab {...tabProps} />}
            {tab === 'varios' && <BulkTab {...tabProps} />}
            {tab === 'publicados' && (
              <PublishedTab {...tabProps} failedOpen={failedOpen} setFailedOpen={setFailedOpen} />
            )}
            {tab === 'rendimiento' && <PerformanceTab {...tabProps} />}
            {tab === 'calendario' && <CalendarTab />}
            {tab === 'programacion' && <ScheduleTab {...tabProps} />}
            {tab === 'piloto' && <AutopilotTab canAutopilot={canAutopilot} />}
            {tab === 'comentarios' && <CommentsTab />}
            {tab === 'dms' && <DmsTab />}
            {tab === 'crecimiento' && <GrowthTab {...tabProps} />}
            {tab === 'comunidad' && <CommunityTab {...tabProps} />}
          </div>
        </>
      )}
      <Sheet
        open={!!askConnect}
        onClose={() => setAskConnect(null)}
        title={askConnect ? tConnect('title', { plataforma: platformName(askConnect) }) : ''}
        closeLabel={tConnect('close')}
      >
        {askConnect && (
          <div style={{ display: 'grid', gap: 18 }}>
            <p>
              {tConsent.rich('body', {
                plataforma: platformName(askConnect),
                b: (c) => <b>{c}</b>,
              })}
            </p>
            <button
              type="button"
              className="ch-btn ch-btn--primary ch-btn--xl"
              onClick={() => {
                const p = askConnect;
                setAskConnect(null);
                void connect(p);
              }}
            >
              {tConsent('cta', { plataforma: platformName(askConnect) })}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function FlashBanner({ flash, onClose }: { flash: NonNullable<Flash>; onClose: () => void }) {
  const t = useTranslations('clipsPublish');
  const kind = flash.kind === 'warn' ? 'warn' : 'trial';
  return (
    <div className={`ch-bnr ch-bnr--${kind}`} role="status">
      <span className="ch-bnr__tx">
        {flash.kind === 'queued' ? (
          <>
            {t('flash.queued')}{' '}
            <Link
              className="ch-lnk"
              href={`/app/clips/publicar/trabajo/${encodeURIComponent(flash.postId)}` as Route}
            >
              {t('flash.seeStatus')}
            </Link>
          </>
        ) : (
          flash.text
        )}
      </span>
      <button
        type="button"
        className="ch-pub-acct__x"
        aria-label={t('common.close')}
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

function AccountsRow({
  ov,
  refresh,
  connect,
  msg,
  setFlash,
}: {
  ov: Overview;
  refresh: () => Promise<void>;
  connect: (platform: string) => void;
  msg: Msg;
  setFlash: (f: Flash) => void;
}) {
  const t = useTranslations('clipsPublish.accounts');
  const errText = usePublishErrorText();
  const [ask, confirmNode] = useConfirm();
  const [rowMsg, setRowMsg] = useState<Msg>(null);
  const byPlatform = new Map(ov.accounts.map((a) => [a.platform, a.account_id]));
  const atLimit = ov.account_limit !== null && ov.account_count >= ov.account_limit;

  return (
    <section className="ch-card" aria-label={t('aria')}>
      <div className="ch-pub-accts">
        {ov.account_limit !== null && (
          <span className="ch-pill ch-pill--gray" title={t('limitHint')}>
            <Lock aria-hidden="true" />
            {t('limit', { n: ov.account_count, max: ov.account_limit })}
          </span>
        )}
        {ov.platforms.map((p) => {
          const accountId = byPlatform.get(p.id);
          if (accountId)
            return (
              <span key={p.id} className="ch-pub-acct ch-pub-acct--on">
                <PlatformTile id={p.id} />
                {p.label}
                <button
                  type="button"
                  className="ch-pub-acct__x"
                  aria-label={t('disconnect', { plataforma: p.label })}
                  onClick={() =>
                    ask({
                      title: t('disconnectTitle', { plataforma: p.label }),
                      body: t('disconnectBody'),
                      cta: t('disconnectCta'),
                      danger: true,
                      onConfirm: async () => {
                        const r = await publishApi(
                          `accounts/${encodeURIComponent(accountId)}/disconnect`,
                          { method: 'POST' },
                        );
                        if (!r.ok) setRowMsg({ kind: 'bad', text: errText(r.error) });
                        await refresh();
                      },
                    })
                  }
                >
                  <X aria-hidden="true" />
                </button>
              </span>
            );
          return (
            <button
              key={p.id}
              type="button"
              className="ch-pub-acct"
              disabled={atLimit}
              title={atLimit ? t('atLimit') : undefined}
              onClick={() => connect(p.id)}
            >
              <PlatformTile id={p.id} />
              <Plus aria-hidden="true" style={{ width: 16, height: 16 }} />
              {t('connect', { plataforma: p.label })}
            </button>
          );
        })}
        <span className="ch-pub-accts__end">
          <button
            type="button"
            className="ch-btn ch-btn--danger ch-btn--tiny"
            onClick={() =>
              ask({
                title: t('unlinkTitle'),
                body: t('unlinkBody'),
                cta: t('unlinkCta'),
                danger: true,
                onConfirm: async () => {
                  const r = await publishApi('unlink', { method: 'POST' });
                  if (!r.ok) setRowMsg({ kind: 'bad', text: errText(r.error) });
                  else setFlash({ kind: 'warn', text: t('unlinked') });
                  await refresh();
                },
              })
            }
          >
            <Link2Off aria-hidden="true" />
            {t('unlink')}
          </button>
        </span>
      </div>
      {(msg || rowMsg) && (
        <div style={{ padding: '0 16px 14px' }}>
          <InlineMsg msg={msg ?? rowMsg} />
        </div>
      )}
      {confirmNode}
    </section>
  );
}

function ProfileSetup({ onDone }: { onDone: (f: Flash) => Promise<void> }) {
  const t = useTranslations('clipsPublish.profile');
  const errText = usePublishErrorText();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [claim, setClaim] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [claimMsg, setClaimMsg] = useState<Msg>(null);

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-profile-h">
      <header>
        <h2 id="pub-profile-h">{t('title')}</h2>
      </header>
      <p className="ch-muted">{t('body')}</p>
      <form
        className="ch-pub-stack"
        style={{ maxWidth: 560 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) {
            setMsg({ kind: 'bad', text: t('nameRequired') });
            return;
          }
          setBusy(true);
          setMsg({ kind: 'info', text: t('creating') });
          const r = await publishApi<{ ok: boolean; name?: string }>('profile', {
            body: { name: name.trim(), description: desc.trim() },
          });
          setBusy(false);
          if (!r.ok) {
            setMsg({ kind: 'bad', text: errText(r.error) });
            return;
          }
          await onDone({ kind: 'ok', text: t('created', { perfil: r.data.name || name.trim() }) });
        }}
      >
        <label className="ch-pub-field">
          <span>{t('name')}</span>
          <input
            className="ch-input"
            value={name}
            maxLength={80}
            placeholder={t('namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="ch-pub-field">
          <span>{t('description')}</span>
          <input
            className="ch-input"
            value={desc}
            maxLength={200}
            placeholder={t('descriptionPlaceholder')}
            onChange={(e) => setDesc(e.target.value)}
          />
        </label>
        <div className="ch-pub-row">
          <button type="submit" className="ch-btn ch-btn--primary ch-btn--compact" disabled={busy}>
            {t('create')}
          </button>
          <InlineMsg msg={msg} />
        </div>
      </form>
      <details>
        <summary>{t('claimSummary')}</summary>
        <form
          className="ch-pub-stack"
          style={{ maxWidth: 560 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!claim.trim()) return;
            setClaimMsg({ kind: 'info', text: t('claiming') });
            const r = await publishApi<{ ok: boolean; claimed?: string }>('accounts/claim', {
              body: { profile_id: claim.trim() },
            });
            if (!r.ok) {
              setClaimMsg({ kind: 'bad', text: errText(r.error) });
              return;
            }
            await onDone({ kind: 'ok', text: t('claimed', { perfil: r.data.claimed ?? claim }) });
          }}
        >
          <p className="ch-pub-hint">{t('claimHint')}</p>
          <div className="ch-pub-row">
            <input
              className="ch-input ch-pub-grow"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="prof_…"
              aria-label={t('claimLabel')}
            />
            <button type="submit" className="ch-btn ch-btn--secondary ch-btn--compact">
              {t('claim')}
            </button>
          </div>
          <InlineMsg msg={claimMsg} />
        </form>
      </details>
    </section>
  );
}

export { isPublishTab };
