import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAdminPage } from '@/lib/admin/guard';
import { billingToggleEnabled, usageMarginPercent } from '@/lib/config/settings';
import { legalEntity } from '@/lib/billing/legal-entity';
import { legalDocuments } from '@/lib/legal/documents';
import { planPrice, PRICING, type PlanKey } from '@/config/pricing';
import { formatMxn, PLATFORM_TIMEZONE } from '@/lib/billing/money';
import { BillingToggle } from '@/components/dashboard/admin/billing-toggle';
import { UsageMargin } from '@/components/dashboard/admin/usage-margin';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.settings');
  return { title: t('metaTitle') };
}

// Ajustes (P5-6). Read-only except the Mensual/Anual toggle (Q31) and the
// usage margin.

const PLANS: PlanKey[] = ['pro_month', 'pro_year', 'vip_month', 'vip_year'];

export default async function AjustesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireAdminPage();
  const t = await getTranslations('admin.settings');
  const ts = await getTranslations('seller');
  const seller = legalEntity();
  const docs = legalDocuments('terminos', 'suscripcion', 'privacidad', 'uso_aceptable');
  const row = (label: string, value: string, note?: string) => (
    <div className="ch-row" key={label}>
      <span className="ch-row__tx">
        <b>{label}</b>
        {note && <small>{note}</small>}
      </span>
      <span style={{ textAlign: 'right', overflowWrap: 'anywhere', maxWidth: '60%' }}>{value}</span>
    </div>
  );
  const meta = session.user.user_metadata ?? {};

  return (
    <div style={{ display: 'grid', gap: 26, maxWidth: 860 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>

      <section className="ch-section" aria-labelledby="pricing-t">
        <h2 id="pricing-t">{t('pricing')}</h2>
        <div className="ch-group">
          <BillingToggle initial={await billingToggleEnabled()} />
          <UsageMargin initial={await usageMarginPercent()} />
          {PLANS.map((k) => row(t(`plan.${k}`), `${formatMxn(planPrice(k).totalCents)} ${PRICING.currency}`, t('pricingNote')))}
        </div>
      </section>

      <section className="ch-section" aria-labelledby="seller-t">
        <h2 id="seller-t">{t('seller')}</h2>
        <div className="ch-group">
          {(['name', 'rfc', 'address', 'phone', 'email', 'hours', 'complaints'] as const).map((k) => row(ts(k), seller[k] || t('sellerMissing')))}
        </div>
      </section>

      <section className="ch-section" aria-labelledby="legal-t">
        <h2 id="legal-t">{t('legal')}</h2>
        <div className="ch-group">{docs.map((d) => row(d.doc, t('version', { v: d.version }), d.url))}</div>
      </section>

      <section className="ch-section" aria-labelledby="acct-t">
        <h2 id="acct-t">{t('account')} · <span className="ch-muted">{t('readOnly')}</span></h2>
        <div className="ch-group">
          {row(t('rows.name'), (typeof meta.full_name === 'string' && meta.full_name) || '—')}
          {row(t('rows.email'), session.user.email ?? '—')}
          {row(t('rows.role'), session.role)}
        </div>
      </section>
      <section className="ch-section" aria-labelledby="org-t">
        <h2 id="org-t">{t('org')}</h2>
        <div className="ch-group">
          {row(t('rows.orgName'), 'Chalyb')}
          {row(t('rows.timezone'), PLATFORM_TIMEZONE)}
        </div>
      </section>
      <section className="ch-section" aria-labelledby="sec-t">
        <h2 id="sec-t">{t('security')}</h2>
        <div className="ch-group">
          {row(t('rows.auth'), t('authValue'))}
          {row(t('rows.twofa'), t('twofaValue'))}
        </div>
      </section>
    </div>
  );
}
