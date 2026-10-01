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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('s1.metaTitle') };
}

// Clips · Paso 1 (SCR-02): paste a link. With TOOL_HUB_MODE_CHALYBCLIP=off
// (no engine job API yet) it hands off to the Clips app over SSO (P0-14).
// P3 adds the connect / upload alternatives once they exist.

export default async function ClipsStep1Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; link?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireClipsAccess(locale, '/app/clips');
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
              planHref="/app/subscription"
              trialFlow={trialFlowEnabled()}
            />
          )}
        </div>
      </WizardShell>
    );
  }

  const reason = (CLIP_FAILURE_REASONS as readonly string[]).includes(error ?? '')
    ? (error as ClipFailureReason)
    : null;

  if (reason) {
    return (
      <WizardShell {...chrome} narrow>
        <ClipError reason={reason} sourceUrl={link} />
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
        <p id="clip-link-works" className="ch-muted" style={{ fontSize: 17 }}>
          {t('s1.works')}
        </p>
        <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">
          {t('s1.cta')}
        </button>
      </form>
    </WizardShell>
  );
}
