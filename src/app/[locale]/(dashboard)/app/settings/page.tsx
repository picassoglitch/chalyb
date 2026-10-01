import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Check,
  Coins,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  LayoutGrid,
  Mail,
  MessageCircle,
  Shield,
  User,
  UserX,
  Database,
  ReceiptText,
} from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { planLabelKey } from '@/lib/billing/plan-label';
import { planPrice } from '@/config/pricing';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { countUnreadForUser } from '@/lib/messages/messages-data';
import { supportSlaConfirmed, trialFlowEnabled } from '@/lib/config/flags';
import { Avatar, ButtonLink, Group, Row } from '@/components/ui/primitives';
import { SignOutRow } from '@/components/app/sign-out-row';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: t('title') };
}

// Mi cuenta (SCR-07). Structure and copy now; P2 wires the billing rows
// (renewal date, amount, card, invoices) to real data. Nothing here is
// sample data: a value we don't have yet is simply not shown.

export default async function MiCuentaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account');
  const tLang = await getTranslations('language');
  const tPlan = await getTranslations('myplan');

  const session = await getSessionUser();
  if (!session) return null;
  const meta = session.user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    '';
  const email = session.user.email ?? '';

  const [entitlements, unread] = await Promise.all([
    getEntitlements(session),
    countUnreadForUser(session.user.id).catch(() => 0),
  ]);
  const tools = Object.values(entitlements.tools);
  const allIncluded = tools.length > 0 && tools.every((a) => a.state === 'included');
  const planKey = planLabelKey(entitlements.plan) as 'gratis' | 'pro' | 'vip';
  // "Ver mi plan" → Mi plan (SCR-30); Free → the trial (SCR-14) once it exists.
  const planHref =
    planKey === 'gratis'
      ? trialFlowEnabled()
        ? '/app/prueba'
        : '/app/subscription'
      : '/app/billing';
  // "Se renueva el {fecha} · ${monto} MXN al {mes|año}, IVA incluido" — only
  // with a real renewal behind it (Hard Rule 7: IVA always stated).
  const b = entitlements.billing;
  const renewal =
    b && (b.state === 'pro' || b.state === 'trialing') && b.nextChargeAt && b.planKey
      ? `${tPlan('nextCharge', { fecha: formatFechaLarga(b.nextChargeAt, locale) })} · ${
          planPrice(b.planKey).interval === 'year'
            ? tPlan('priceYear', { monto: formatMXN(planPrice(b.planKey).totalCents) })
            : tPlan('priceMonth', { monto: formatMXN(planPrice(b.planKey).totalCents) })
        }, ${t('ivaIncluded')}`
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <Avatar name={name || email} large />
        <div style={{ minWidth: 0 }}>
          <h1 className="ch-h1">{t('title')}</h1>
          <p className="ch-muted" style={{ fontSize: 18, overflowWrap: 'anywhere' }}>
            {[name, email].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <div className="ch-acct">
        <div className="ch-acct__col">
          <section className="ch-plan" aria-labelledby="plan-title">
            <p className="ch-plan__k">{t('plan.k')}</p>
            <h2 id="plan-title" className="ch-plan__h">
              {allIncluded
                ? t('plan.nameAll', { plan: t(`plan.name.${planKey}`) })
                : t(`plan.name.${planKey}`)}
            </h2>
            {renewal && (
              <p style={{ fontSize: 18, marginTop: 6, position: 'relative', zIndex: 1 }}>{renewal}</p>
            )}
            <div className="ch-plan__foot">
              {allIncluded ? (
                <span className="ch-plan__all">
                  <Check aria-hidden="true" /> {t('plan.allTools')}
                </span>
              ) : (
                <span />
              )}
              <ButtonLink href={planHref} variant="white" size="compact">
                {t('plan.cta')}
              </ButtonLink>
            </div>
          </section>

          <Group title={t('billing.title')}>
            {/* Q13: credit numbers stay hidden until PRICING.credits is set. */}
            <Row
              icon={<Coins />}
              iconColor="#FF9F0A"
              title={t('billing.credits')}
              href="/app/usage"
            />
            <Row
              icon={<CreditCard />}
              iconColor="#34C759"
              title={t('billing.method')}
              href="/app/subscription"
            />
            {/* Q11: no "CFDI listo" until CFDI_ENABLED. */}
            <Row
              icon={<FileText />}
              iconColor="#8E8E93"
              title={t('billing.invoices')}
              href="/app/billing"
            />
          </Group>
        </div>

        <div className="ch-acct__col">
          {/* "Mis redes conectadas" stays hidden: the hub has no account-linking
              API yet (Q4), and a row that can't connect anything is a dead end. */}

          <Group title={t('prefs.title')}>
            <Row
              icon={<Globe />}
              iconColor="#0A84FF"
              title={t('prefs.language')}
              value={tLang(locale === 'es' ? 'es' : 'en')}
              href="/app/settings/perfil"
            />
            <Row
              icon={<User />}
              iconColor="#5B4BFF"
              title={t('prefs.profile')}
              href="/app/settings/perfil"
            />
          </Group>

          <section aria-labelledby="help-title">
            <h2 className="ch-ghead" id="help-title">
              {t('help.title')}
            </h2>
            <div className="ch-human">
              <span className="ch-human__ic" aria-hidden="true">
                <MessageCircle />
              </span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ fontWeight: 700, fontSize: 20 }}>{t('help.human.title')}</p>
                {/* Q16: the response-time promise is config, not copy. */}
                <p className="ch-muted" style={{ fontSize: 17 }}>
                  {supportSlaConfirmed() ? t('help.human.bodyFast') : t('help.human.body')}
                </p>
              </div>
              <ButtonLink href="/app/messages" variant="ok" size="compact">
                {t('help.human.cta')}
              </ButtonLink>
            </div>
          </section>

          <Group title={t('more.title')}>
            <Row
              icon={<LayoutGrid />}
              iconColor="#5B4BFF"
              title={t('more.tools')}
              href="/app/engines"
            />
            <Row
              icon={<Mail />}
              iconColor="#30B0C7"
              title={t('more.messages')}
              value={unread > 0 ? t('more.unread', { n: unread }) : undefined}
              href="/app/messages"
            />
            <Row
              icon={<HelpCircle />}
              iconColor="#8E8E93"
              title={t('more.help')}
              href="/app/help"
            />
          </Group>

          {/* Paths the legal documents point people to. P6-8 wires the forms;
              until then each row reaches the place that handles it today. */}
          <Group title={t('privacy.title')}>
            <Row
              icon={<Shield />}
              iconColor="#5E5E66"
              title={t('privacy.notice')}
              href="/legal/privacy"
            />
            <Row
              icon={<Database />}
              iconColor="#5E5E66"
              title={t('privacy.arco')}
              href="/app/messages"
            />
            <Row
              icon={<ReceiptText />}
              iconColor="#5E5E66"
              title={t('privacy.charge')}
              href="/app/messages"
            />
            <Row icon={<UserX />} iconColor="#5E5E66" title={t('privacy.close')} href="/app/help" />
            <SignOutRow />
          </Group>
        </div>
      </div>
    </div>
  );
}
