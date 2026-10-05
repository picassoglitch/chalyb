// /app/usage — Mis créditos (FIX-3 §B, mockups 72, 72b, 74 §2).
//
// The data loader below never throws: every external call is wrapped, and
// failures are collected in `warnings` (logged with the `[/app/usage]`
// prefix). What changed with FIX-3 is the rule on top of it: when the
// balance itself couldn't be read, no number is painted — the page says so
// instead of showing a default as if it were real.

import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Plus, RefreshCw, Scissors, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { engineDisplayName } from '@/lib/engines/display-names';
import { getSessionUser, type SubscriptionTier, type UserRole } from '@/lib/auth/session';
import { effectiveTier, isAdminRole, TIER_CAPS } from '@/lib/billing/tiers';
import { getTokenBalance, type TokenBalance } from '@/lib/usage/tokens';
import { createClient } from '@/lib/supabase/server';
import { TOKEN_PACKS } from '@/lib/payments/pricing';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import {
  getCurrentAccrualsForPartner,
  getPayoutsForPartner,
  type PayoutRow,
  type RoyaltyAccrual,
} from '@/lib/usage/royalties';
import { Banner, Group, Pill, Row, StateBlock } from '@/components/ui/primitives';
import { ToolIcon } from '@/components/ui/tool-icon';
import { Markup } from '@/components/ui/markup';
import { CreditsSheet, RefreshWhilePending } from '@/components/app/credits-sheet';
import { paidCheckoutEnabled } from '@/lib/config/flags';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('credits');
  return { title: t('title') };
}

interface UsageEventRow {
  id: string;
  engine_id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  operation: string | null;
}

interface PageData {
  /** True when getSessionUser() succeeded AND returned a user. */
  hasSession: boolean;
  userId: string | null;
  role: UserRole;
  tier: SubscriptionTier;
  isAdmin: boolean;
  balance: TokenBalance;
  events: UsageEventRow[];
  engineMap: Map<string, { name: string; slug: string }>;
  royaltyAccruals: RoyaltyAccrual[];
  royaltyPayouts: PayoutRow[];
  packs: { tokens: number; at: string }[];
  /** When any of the fetches errored, the operator-visible reason. Logged
   *  to Vercel Functions logs but NOT shown to the user — the surface
   *  silently degrades to default values instead. */
  warnings: string[];
}

const DEFAULT_BALANCE: TokenBalance = {
  remaining: 0,
  unlimited: false,
  monthlyAllocation: 0,
  bonus: 0,
  held: 0,
  monthlyUsed: 0,
  reserved: 0,
  periodStart: new Date().toISOString(),
};

/**
 * Load every piece of data the page needs, with bulletproof error handling.
 * Each external call is independently try/caught — a failure in one doesn't
 * cascade. Returns a PageData object the render layer can consume without
 * ever encountering an undefined property.
 *
 * Errors are accumulated in `warnings` and console.error'd with a
 * `[/app/usage]` prefix so they're greppable in Vercel Function logs.
 */
async function loadUsagePageData(): Promise<PageData> {
  const warnings: string[] = [];

  // ── Session ─────────────────────────────────────────────────────────
  // The ONE thing we don't catch is the not-authenticated case — when
  // there's no session at all, the caller should redirect to /sign-in.
  // The try/catch here covers a thrown auth error (createClient missing
  // env vars, supabase auth fetch network error, etc).
  let session: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    session = await getSessionUser();
  } catch (err) {
    console.error('[/app/usage] getSessionUser threw:', err);
    warnings.push('session_lookup_failed');
  }

  if (!session) {
    return {
      hasSession: false,
      userId: null,
      role: 'VIEWER',
      tier: 'FREE',
      isAdmin: false,
      balance: DEFAULT_BALANCE,
      events: [],
      engineMap: new Map(),
      royaltyAccruals: [],
      royaltyPayouts: [],
      packs: [],
      warnings,
    };
  }

  const userId = session.user.id;
  const role = session.role;
  const storedTier = session.tier;
  const tier = effectiveTier(role, storedTier);
  const isAdmin = isAdminRole(role);

  // ── Balance + royalties (parallel) ──────────────────────────────────
  const [balance, royaltyAccruals, royaltyPayouts] = await Promise.all([
    getTokenBalance(userId).catch((err) => {
      console.error('[/app/usage] getTokenBalance threw:', err);
      warnings.push('balance_lookup_failed');
      return DEFAULT_BALANCE;
    }),
    getCurrentAccrualsForPartner(userId).catch((err) => {
      console.error('[/app/usage] getCurrentAccrualsForPartner threw:', err);
      warnings.push('royalty_accruals_lookup_failed');
      return [] as RoyaltyAccrual[];
    }),
    getPayoutsForPartner(userId).catch((err) => {
      console.error('[/app/usage] getPayoutsForPartner threw:', err);
      warnings.push('royalty_payouts_lookup_failed');
      return [] as PayoutRow[];
    }),
  ]);

  // ── Packs bought (Historial "+n") ──
  let packs: { tokens: number; at: string }[] = [];
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('token_pack_purchases')
      .select('tokens_granted, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) warnings.push('packs_lookup_failed');
    packs = (rows ?? []).map((r) => ({
      tokens: Number(r.tokens_granted),
      at: r.created_at as string,
    }));
  } catch (err) {
    console.error('[/app/usage] packs lookup threw:', err);
    warnings.push('packs_lookup_threw');
  }

  // ── Usage events ────────────────────────────────────────────────────
  // Defensive supabase client init.
  let events: UsageEventRow[] = [];
  const engineMap = new Map<string, { name: string; slug: string }>();
  try {
    const supabase = await createClient();
    // Try with `operation` column (migration 0015). On column-missing
    // error code 42703, fall back to legacy columns so the activity feed
    // still renders ungrouped.
    let rawEvents: unknown[] | null = null;
    try {
      const first = await supabase
        .from('usage_events')
        .select('id, engine_id, kind, amount, occurred_at, operation')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(60);
      if (first.error) {
        console.warn(
          '[/app/usage] usage_events with operation failed, retrying legacy:',
          first.error.message,
        );
        const legacy = await supabase
          .from('usage_events')
          .select('id, engine_id, kind, amount, occurred_at')
          .eq('user_id', userId)
          .order('occurred_at', { ascending: false })
          .limit(60);
        if (legacy.error) {
          console.error('[/app/usage] usage_events legacy also failed:', legacy.error.message);
          warnings.push('events_query_failed');
        } else {
          rawEvents = legacy.data;
        }
      } else {
        rawEvents = first.data;
      }
    } catch (err) {
      console.error('[/app/usage] usage_events query threw:', err);
      warnings.push('events_query_threw');
    }
    events = (rawEvents ?? []) as UsageEventRow[];

    // Hydrate engine names from the events we got back.
    const engineIds = Array.from(new Set(events.map((e) => e.engine_id).filter(Boolean)));
    if (engineIds.length > 0) {
      try {
        const enginesRes = await supabase
          .from('engines')
          .select('id, slug, name, icon')
          .in('id', engineIds);
        if (enginesRes.error) {
          console.warn('[/app/usage] engines lookup error:', enginesRes.error.message);
          warnings.push('engines_lookup_failed');
        } else {
          for (const e of enginesRes.data ?? []) {
            engineMap.set(e.id as string, {
              // Customer name ("Inmuebles"), never the internal one (P0-6).
              name: engineDisplayName(e.slug as string, (e.name as string | null) ?? undefined),
              slug: e.slug as string,
            });
          }
        }
      } catch (err) {
        console.error('[/app/usage] engines lookup threw:', err);
        warnings.push('engines_lookup_threw');
      }
    }
  } catch (err) {
    console.error('[/app/usage] createClient threw:', err);
    warnings.push('supabase_client_init_failed');
  }

  return {
    hasSession: true,
    userId,
    role,
    tier,
    isAdmin,
    balance,
    events,
    engineMap,
    royaltyAccruals,
    royaltyPayouts,
    packs,
    warnings,
  };
}

const TOOL_COLOR: Record<string, string> = {
  chalybclip: '#5B4BFF',
  chalybcrypto: '#FF9F0A',
  chalybobs: '#FF2D55',
};

export default async function UsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; comprar?: string; todo?: string }>;
}) {
  let locale = 'es';
  let sp: { status?: string; comprar?: string; todo?: string } = {};
  try {
    locale = (await params).locale || 'es';
    sp = await searchParams;
  } catch (err) {
    console.error('[/app/usage] params parsing failed:', err);
  }
  try {
    setRequestLocale(locale);
  } catch (err) {
    console.error('[/app/usage] setRequestLocale failed:', err);
  }

  const data = await loadUsagePageData();
  // `redirect()` throws NEXT_REDIRECT on purpose: the one error we want.
  if (!data.hasSession) redirect('/sign-in?next=/app/usage');

  const t = await getTranslations('credits');
  const tm = await getTranslations('myplan');
  const nf = (v: number) => v.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US');
  const date = (iso: string) => formatFechaLarga(iso, locale);
  const b = (c: string) => `<b>${c}</b>`;
  // The period start comes from the usage_balance RPC; never trust it to be a
  // valid date (an empty value used to throw on toISOString and 500 the page).
  const monthStart = () => {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString();
  };
  const balance = {
    ...data.balance,
    periodStart: Number.isFinite(Date.parse(data.balance.periodStart))
      ? data.balance.periodStart
      : monthStart(),
  };
  const balanceBroken = data.warnings.some((w) => w.startsWith('balance_') || w.startsWith('session_'));
  const total = balance.monthlyAllocation;
  const used = balance.monthlyUsed;
  const left = Math.max(0, balance.remaining);
  const usedPct = total > 0 ? Math.min(100, Math.floor((used / total) * 100)) : 0;
  // Credits renew on the 1st (calendar month; D-F3-3: show what the code does).
  const start = new Date(balance.periodStart);
  const renew = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 12)).toISOString();
  const low = !balance.unlimited && total > 0 && usedPct >= 80;
  const packs = TOKEN_PACKS.map((p) => ({ id: p.id, tokens: p.tokens, amount: formatMXN(p.amountCents) }));
  const toolName = (engineId: string) => data.engineMap.get(engineId)?.name ?? t('tool');
  const toolSlug = (engineId: string) => data.engineMap.get(engineId)?.slug ?? 'more';

  // Runs: events sharing tool, operation and day are one use.
  type Use = { key: string; engineId: string; at: string; credits: number; operation: string };
  const uses = new Map<string, Use>();
  for (const e of data.events) {
    const key = e.operation ? `${e.engine_id}|${e.operation}|${(e.occurred_at || '').slice(0, 10)}` : e.id;
    const credits = e.kind === 'llm.tokens' ? e.amount : 0;
    const u = uses.get(key);
    if (u) {
      u.credits += credits;
      if (e.occurred_at > u.at) u.at = e.occurred_at;
    } else
      uses.set(key, { key, engineId: e.engine_id, at: e.occurred_at, credits, operation: e.operation ?? e.kind });
  }
  const thisMonth = [...uses.values()].filter((u) => u.at >= balance.periodStart);
  const byTool = new Map<string, { n: number; credits: number }>();
  for (const u of thisMonth) {
    const x = byTool.get(u.engineId) ?? { n: 0, credits: 0 };
    x.n += 1;
    x.credits += u.credits;
    byTool.set(u.engineId, x);
  }

  type Hist = { key: string; at: string; title: string; detail: string; value: string; plus: boolean; slug: string };
  const history: Hist[] = [
    ...[...uses.values()].map((u) => ({
      key: u.key,
      at: u.at,
      title: toolName(u.engineId),
      detail: date(u.at),
      value: `−${nf(u.credits)}`,
      plus: false,
      slug: toolSlug(u.engineId),
    })),
    ...data.packs.map((p, i) => ({
      key: `pack-${i}`,
      at: p.at,
      title: t('history.pack', { n: nf(p.tokens) }),
      detail: date(p.at),
      value: `+${nf(p.tokens)}`,
      plus: true,
      slug: 'more',
    })),
    ...(!balance.unlimited && total > 0
      ? [
          {
            key: 'renewal',
            at: balance.periodStart,
            title: t('history.renewal'),
            detail: date(balance.periodStart),
            value: `+${nf(total)}`,
            plus: true,
            slug: 'renew',
          },
        ]
      : []),
  ].sort((a, b2) => b2.at.localeCompare(a.at));
  const all = sp.todo === '1';
  const shown = history.slice(0, all ? 20 : 5);
  const caps = TIER_CAPS[data.tier];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <header>
        <Link href={'/app/settings' as Route} className="ch-muted" style={{ fontSize: 17 }}>
          {tm('crumb')} ›
        </Link>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>

      {sp.status === 'success' && (
        <>
          <Banner kind="trial">
            <Markup text={t.markup('paid', { b })} />
          </Banner>
          <RefreshWhilePending />
        </>
      )}
      {low && !balanceBroken && (
        <Banner kind="warn" action={{ href: '/app/usage?comprar=1', label: t('lowCta') }}>
          <Markup text={t.markup('low', { pct: 100 - usedPct, fecha: date(renew), b })} />
        </Banner>
      )}

      {balanceBroken ? (
        <StateBlock
          icon={<TriangleAlert />}
          title={t('error.title')}
          body={t('error.body')}
          action={{ href: '/app/usage', label: t('error.cta') }}
          role="alert"
        />
      ) : (
        <div className="ch-acct ch-acct--credits">
          <div className="ch-acct__col">
            <section className="ch-card ch-credits" aria-labelledby="cr-left">
              {balance.unlimited ? (
                <>
                  <h2 id="cr-left" className="ch-h2">
                    {t('unlimited')}
                  </h2>
                  <p className="ch-muted">{t('admin')}</p>
                </>
              ) : (
                <>
                  <p id="cr-left" className="ch-credits__k">
                    {t('left')}
                  </p>
                  <p className="ch-credits__n">
                    <b>{nf(left)}</b> <span>{t('unit')}</span>
                  </p>
                  <div
                    className="ch-credits__bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={Math.min(used, total)}
                    aria-label={t('used', { usados: nf(used), total: nf(total) })}
                  >
                    <span style={{ width: `${usedPct}%` }} />
                  </div>
                  <p className="ch-muted">
                    {left === 0
                      ? t('none', { fecha: date(renew) })
                      : t('used', { usados: nf(used), total: nf(total) })}
                  </p>
                  <p className="ch-credits__li">
                    <span aria-hidden="true">
                      <RefreshCw />
                    </span>
                    <span>
                      <Markup text={t.markup('renew', { fecha: date(renew), total: nf(total), b })} />
                    </span>
                  </p>
                  <p className="ch-credits__li">
                    <span aria-hidden="true">
                      <Plus />
                    </span>
                    <span>
                      <Markup text={t.markup('extra', { n: nf(balance.bonus), b })} />
                    </span>
                  </p>
                  {balance.held > 0 && (
                    <p className="ch-credits__li">
                      <span aria-hidden="true">
                        <Plus />
                      </span>
                      <span>
                        <Markup text={t.markup('held', { n: nf(balance.held), b })} />
                      </span>
                    </p>
                  )}
                </>
              )}
              {/* Sales are closed while paid checkout is off. */}
              {paidCheckoutEnabled() ? (
                <CreditsSheet packs={packs} defaultOpen={sp.comprar === '1'} triggerLabel={t('cta')} />
              ) : (
                <p className="ch-muted">{t('soon')}</p>
              )}
            </section>

            {byTool.size > 0 && (
              <Group title={t('byTool.title')}>
                {[...byTool.entries()].map(([id, x]) => (
                  <Row
                    key={id}
                    icon={<ToolIcon slug={toolSlug(id)} filled size="sm" />}
                    iconColor={TOOL_COLOR[toolSlug(id)] ?? '#8E8E93'}
                    title={toolName(id)}
                    detail={t('byTool.generic', { n: x.n })}
                    value={nf(x.credits)}
                  />
                ))}
              </Group>
            )}
          </div>

          <div className="ch-acct__col">
            {uses.size === 0 ? (
              <StateBlock
                icon={<Scissors />}
                title={t('empty.title')}
                body={t('empty.body')}
                action={{ href: '/app/clips', label: t('empty.cta') }}
              />
            ) : (
              <section aria-labelledby="hist-h">
                <div className="ch-ghead-row">
                  <h2 id="hist-h" className="ch-ghead">
                    {t('history.title')}
                  </h2>
                  {!all && history.length > 5 && (
                    <Link href={'/app/usage?todo=1' as Route} className="ch-link">
                      {t('history.all')}
                    </Link>
                  )}
                </div>
                <div className="ch-group">
                  {shown.map((h) => (
                    <Row
                      key={h.key}
                      icon={h.slug === 'renew' ? <RefreshCw /> : <ToolIcon slug={h.slug} filled size="sm" />}
                      iconColor={h.plus ? '#8E8E93' : (TOOL_COLOR[h.slug] ?? '#8E8E93')}
                      title={h.title}
                      detail={h.detail}
                      value={<span style={h.plus ? { color: 'var(--accent)' } : undefined}>{h.value}</span>}
                    />
                  ))}
                </div>
              </section>
            )}

            {(data.royaltyAccruals.length > 0 || data.royaltyPayouts.length > 0) && (
              <PartnerEarnings accruals={data.royaltyAccruals} payouts={data.royaltyPayouts} locale={locale} />
            )}

            <details className="ch-card ch-adv">
              <summary>
                <SlidersHorizontal aria-hidden="true" /> {t('adv.title')}{' '}
                <Pill kind="acc">{t('adv.tag')}</Pill>
              </summary>
              <div className="ch-adv__body">
                <h3 className="ch-adv__h">{t('adv.limits')}</h3>
                <ul className="ch-adv__list">
                  <li>{t('adv.historyDays', { n: caps.historyDays })}</li>
                  {Number.isFinite(caps.clipStreamsPerMonth) && caps.clipStreamsPerMonth > 0 && <li>{t('adv.streams', { n: caps.clipStreamsPerMonth })}</li>}
                </ul>
                <h3 className="ch-adv__h">{t('adv.tech')}</h3>
                <ul className="ch-adv__list">
                  {!balance.unlimited && total > 0 && <li>{t('adv.pct', { pct: usedPct })}</li>}
                  {TOKEN_PACKS.map((p) => (
                    <li key={p.id}>
                      {t('adv.perThousand', {
                        n: nf(p.tokens),
                        monto: formatMXN(Math.round((p.amountCents * 1000) / p.tokens)),
                      })}
                    </li>
                  ))}
                </ul>
                {data.events.length > 0 && (
                  <div className="ch-table-wrap" role="region" aria-label={t('adv.tech')} tabIndex={0}>
                    <table className="ch-table">
                      <thead>
                        <tr>
                          <th scope="col">{t('adv.col.date')}</th>
                          <th scope="col">{t('adv.col.tool')}</th>
                          <th scope="col">{t('adv.col.operation')}</th>
                          <th scope="col">{t('adv.col.kind')}</th>
                          <th scope="col" className="num">
                            {t('adv.col.amount')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.events.slice(0, 20).map((e) => (
                          <tr key={e.id}>
                            <td>{date(e.occurred_at)}</td>
                            <td>{toolName(e.engine_id)}</td>
                            <td>{e.operation ?? '—'}</td>
                            <td>{e.kind}</td>
                            <td className="num">{nf(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {data.isAdmin && data.warnings.length > 0 && (
                  <p className="ch-muted">{t('adv.diag', { warnings: data.warnings.join(', ') })}</p>
                )}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

async function PartnerEarnings({
  accruals,
  payouts,
  locale,
}: {
  accruals: RoyaltyAccrual[];
  payouts: PayoutRow[];
  locale: string;
}) {
  const t = await getTranslations('credits');
  return (
    <Group title={t('partner.title')}>
      {accruals.map((a) => (
        <Row
          key={`a-${a.engineId}`}
          icon={<ToolIcon slug={a.engineSlug} filled size="sm" />}
          iconColor={TOOL_COLOR[a.engineSlug] ?? '#8E8E93'}
          title={engineDisplayName(a.engineSlug, a.engineName)}
          detail={t('partner.month')}
          value={`${formatMXN(a.accruedCents)} MXN`}
        />
      ))}
      {payouts
        .filter((p) => p.status === 'paid' && p.paidAt)
        .slice(0, 6)
        .map((p) => (
          <Row
            key={`p-${p.id}`}
            icon={<ToolIcon slug={p.engineSlug} filled size="sm" />}
            iconColor={TOOL_COLOR[p.engineSlug] ?? '#8E8E93'}
            title={engineDisplayName(p.engineSlug, p.engineName)}
            detail={t('partner.paid', { fecha: formatFechaLarga(p.paidAt!, locale) })}
            value={`${formatMXN(p.amountCents)} MXN`}
          />
        ))}
    </Group>
  );
}
