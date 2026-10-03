import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listEngines } from '@/lib/data/engines';
import { trialFlowEnabled } from '@/lib/config/flags';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { CLIP_FAILURE_REASONS, type ClipFailureReason } from '@/lib/tools/adapters/types';
import { EngineLaunchButton } from '@/components/workspace/engine-launch-button';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ClipError } from '@/components/app/clips/clip-error';
import { PasteButton } from '@/components/app/clips/paste-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('s1.metaTitle') };
}

// Clips · Paso 1 (SCR-02): paste a link. With TOOL_HUB_MODE_CHALYBCLIP=off
// (no engine job API yet) it hands off to the Clips app over SSO (P0-14).
// Connect / upload alternatives show only when the adapter supports them
// (none does yet); "Pegar" only where the Clipboard API can read.

export default async function ClipsStep1Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; link?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { entitlements } = await requireClipsAccess(locale, '/app/clips');
  // A trial offer only while it can be honoured (K-7).
  const trialFlow = trialFlowEnabled() && !entitlements.trialUsed;
  const t = await getTranslations('clips');
  const { error, link } = await searchParams;
  const chrome = {
    slug: 'chalybclip',
    toolName: 'Clips',
    backHref: '/app',
    backLabel: t('home'),
    closeLabel: t('close'),
  };

  if (!getClipsAdapter()) {
    const engine = (await listEngines().catch(() => [])).find((e) => e.slug === 'chalybclip');
    return (
      <WizardShell {...chrome} narrow>
        <div className="ch-center-col">
          <h1 className="ch-h1">{t('handoff.title')}</h1>
          <p className="ch-sub">{t('handoff.body')}</p>
          {engine && (
            <EngineLaunchButton
              engineId={engine.id}
              slug={engine.slug}
              toolName={engine.name}
              planHref={
                trialFlow ? '/app/prueba' : trialFlowEnabled() ? '/app/planes' : '/app/subscription'
              }
              trialFlow={trialFlow}
            />
          )}
        </div>
      </WizardShell>
    );
  }

  const caps = getClipsAdapter()!.capabilities();
  const list = new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'conjunction' });

  const reason = (CLIP_FAILURE_REASONS as readonly string[]).includes(error ?? '')
    ? (error as ClipFailureReason)
    : null;

  if (reason) {
    return (
      <WizardShell {...chrome} narrow>
        <ClipError reason={reason} sourceUrl={link} noCharge />
      </WizardShell>
    );
  }

  return (
    <WizardShell {...chrome} step={1} stepLabel={t('step', { n: 1 })} narrow>
      <form action="/app/clips/formato" method="get" className="ch-center-col">
        <h1 className="ch-h1">
          <label htmlFor="clip-link">{t('s1.title')}</label>
        </h1>
        <p className="ch-sub" id="clip-link-sub">
          {t('s1.sub')}
        </p>
        <div className="ch-paste">
          <input
            id="clip-link"
            name="link"
            type="url"
            inputMode="url"
            required
            autoComplete="off"
            defaultValue={link ?? ''}
            placeholder={t('s1.placeholder')}
            aria-describedby="clip-link-sub clip-link-works"
            className="ch-input"
          />
          <PasteButton targetId="clip-link" label={t('s1.paste')} />
        </div>
        <p id="clip-link-works" className="ch-muted" style={{ fontSize: 17 }}>
          {t('s1.works', { plataformas: list.format(caps.sources) })}
        </p>
        <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">
          {t('s1.cta')}
        </button>
      </form>
    </WizardShell>
  );
}
