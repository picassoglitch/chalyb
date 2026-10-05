// Mi plan · Gratis (FIX-3 §A.3, mockup 70; 74 §3 for the other states).
// Left: "Tu plan" and the account rows. Right: the one offer, the only
// primary action on the screen. Every amount from config/pricing.ts; plan
// credit numbers only when PRICING.credits sets them (D-F3-2); the user's
// own balance is the real one.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Check, Coins, CreditCard, FileText, Gift, MessageCircle, Star } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { annualMath, floorToPeso, pct, planHasTrial, planPrice, PRICING } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { allToolsClaimAllowed, paidCheckoutEnabled, trialFlowEnabled } from '@/lib/config/flags';
import { isCheckoutReady } from '@/lib/payments/mercadopago';
import type { TokenBalance } from '@/lib/usage/tokens';
import { Banner, ButtonLink, Group, Pill, Row, StateBlock } from '@/components/ui/primitives';

const n = (v: number, locale: string) => v.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US');

export async function FreePlan({
  locale,
  trialUsed,
  balance,
  invoices,
  returnStatus,
}: {
  locale: string;
  trialUsed: boolean;
  balance: TokenBalance | null;
  invoices: number;
  returnStatus?: string;
}) {
  const t = await getTranslations('freeplan');
  const tm = await getTranslations('myplan');
  const proCredits = PRICING.credits.pro ?? null;
  const freeCredits = PRICING.credits.gratis ?? null;

  const trial = trialFlowEnabled() && !trialUsed && planHasTrial('pro_month');
  const paid = paidCheckoutEnabled();
  // Sales are closed while paid checkout is off: no offer, no plan rows.
  const ready = paid && isCheckoutReady();
  // §A.5: the trial picker with Pro mensual preselected (never the annual);
  // without the trial, the paid path; without the new flow, the old checkout.
  const proHref = trial
    ? '/app/prueba?interval=month'
    : paid
      ? '/app/prueba/pago?plan=pro_month'
      : '/app/subscription/checkout?tier=PRO';
  const vipHref =
    trial && planHasTrial('vip_month')
      ? '/app/prueba?plan=vip&interval=month'
      : paid
        ? '/app/billing/cambiar?plan=vip_month'
        : '/app/subscription/checkout?tier=VIP';

  const month = formatMXN(planPrice('pro_month').totalCents);
  const year = formatMXN(planPrice('pro_year').totalCents);
  const save = formatMXN(floorToPeso(annualMath('pro').yearSavingsCents));
  const used = balance && !balance.unlimited ? balance.monthlyUsed : null;
  const total = balance && !balance.unlimited ? balance.monthlyAllocation : null;
  const left = used !== null && total !== null ? Math.max(0, total - used) : null;

  const adds = [
    // C4 / D7: a tool claim only once entitlement, TIER_CAPS and terms agree.
    allToolsClaimAllowed() ? t('add.tools') : null,
    proCredits ? t('add.credits', { creditos: n(proCredits, locale) }) : null,
    t('add.noWatermark'),
    t('add.logo'),
    t('add.publish'),
    t('add.community'),
  ].filter((x): x is string => !!x);
  const freeList = [
    t('f.watermark'),
    freeCredits ? t('f.credits', { creditos: n(freeCredits, locale) }) : null,
    t('f.manual'),
    t('f.community'),
  ].filter((x): x is string => !!x);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header>
        <Link href={'/app/settings' as Route} className="ch-muted" style={{ fontSize: 17 }}>
          {tm('crumb')} ›
        </Link>
        <h1 className="ch-h1">{tm('title')}</h1>
      </header>

      {returnStatus === 'success' && <Banner kind="gray">{t('activated')}</Banner>}
      {returnStatus === 'failure' && (
        <Banner kind="bad" action={{ href: proHref, label: t('retry') }}>
          {t('payError')}
        </Banner>
      )}

      <div className="ch-acct ch-acct--plan">
        <div className="ch-acct__col">
          <section className="ch-card ch-freeplan" aria-labelledby="fp-h">
            <p className="ch-ghead" style={{ padding: 0 }}>
              {tm('status.free')}
            </p>
            <h2 id="fp-h" className="ch-h2">
              {tm('heading.free')}
            </h2>
            <p className="ch-pc__pr">
              <span className="ch-pc__amt">{formatMXN(0)}</span>{' '}
              <span className="ch-pc__unit">{tm('freeBody')}</span>
            </p>
            <ul className="ch-feats">
              {freeList.map((f) => (
                <li key={f}>
                  <Check aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </section>

          <Group title={t('group')}>
            {left !== null && total !== null && used !== null ? (
              <div className="ch-row ch-row--stack">
                <span className="ch-row__ic" style={{ background: '#FF9F0A' }} aria-hidden="true">
                  <Coins />
                </span>
                <div className="ch-row__tx" style={{ flex: 1, minWidth: 0 }}>
                  <div className="ch-row__line">
                    <b>{tm('credits')}</b>
                    <b className="ch-row__big">{n(left, locale)}</b>
                  </div>
                  <div
                    className="ch-lprog__bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={used}
                    aria-label={t('credits.used', {
                      usados: n(used, locale),
                      total: n(total, locale),
                    })}
                  >
                    <span
                      style={{ width: `${total ? Math.min(100, (used / total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="ch-row__line">
                    <span className="ch-muted">
                      {t('credits.used', { usados: n(used, locale), total: n(total, locale) })}
                    </span>
                    <Link href={'/app/usage' as Route} className="ch-link">
                      {t('credits.link')}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <Row icon={<Coins />} iconColor="#FF9F0A" title={tm('credits')} href="/app/usage" />
            )}
            <Row
              icon={<CreditCard />}
              iconColor="#34C759"
              title={tm('method')}
              detail={t('method.sub')}
              value={t('method.value')}
            />
            <Row
              icon={<FileText />}
              iconColor="#8E8E93"
              title={tm('invoices')}
              value={invoices === 0 ? tm('invoicesEmpty') : String(invoices)}
              href={invoices > 0 ? '/app/billing#facturas' : undefined}
            />
          </Group>

          {ready && (
            <Group title={t('other')}>
              <Row
                icon={<Star />}
                iconColor="#AF52DE"
                title={t('vip.title')}
                detail={t('vip.sub')}
                value={
                  <span style={{ color: 'var(--accent)' }}>
                    {t('vip.value', { monto: formatMXN(planPrice('vip_month').totalCents) })}
                  </span>
                }
                href={vipHref}
              />
            </Group>
          )}
        </div>

        <div className="ch-acct__col">
          {!ready ? (
            <StateBlock
              icon={<MessageCircle />}
              title={paid ? t('payDown') : t('salesSoon')}
              body={paid ? undefined : t('salesSoonBody')}
              action={paid ? { href: '/app/messages', label: t('human') } : undefined}
              role="status"
            />
          ) : (
            <section className="ch-card ch-offer" aria-labelledby="offer-h">
              {trial && (
                <Pill kind="acc">
                  <Gift aria-hidden="true" style={{ width: 18, height: 18 }} /> {t('offer.pill')}
                </Pill>
              )}
              <h2 id="offer-h" className="ch-h2" style={{ fontSize: 34 }}>
                {trial ? t('offer.title', { dias: PRICING.trial.days }) : t('used.title')}
              </h2>
              {trial && <p className="ch-sub">{t('offer.sub')}</p>}
              <p className="ch-offer__adds">{t('offer.adds')}</p>
              <ul className="ch-feats ch-feats--2">
                {adds.map((f) => (
                  <li key={f}>
                    <Check aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="ch-offer__price">
                <div className="ch-offer__today">
                  <span>{trial ? t('price.today') : t('used.today')}</span>
                  <b>{trial ? formatMXN(0) : month}</b>
                </div>
                <div className="ch-offer__after">
                  {trial && <span>{t('price.after', { dias: PRICING.trial.days })}</span>}
                  <b className="ch-offer__big">
                    {month} <small>{t('price.monthUnit')}</small>
                  </b>
                  <span>{trial ? t('price.renew') : t('used.renew', { monto_anual: year })}</span>
                  {trial && <span>{t('price.yearAlt', { monto_anual: year })}</span>}
                  <Pill kind="acc">{t('price.save', { ahorro: save, pct: pct('pro') })}</Pill>
                </div>
              </div>
              <ButtonLink href={proHref} variant="primary" size="xl">
                {trial ? t('ctaTrial', { dias: PRICING.trial.days }) : t('ctaNoTrial')}
              </ButtonLink>
              <p className="ch-muted">{trial ? t('legal') : t('legalNoTrial')}</p>
              {trial && <p className="ch-muted">{t('choiceNote')}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
