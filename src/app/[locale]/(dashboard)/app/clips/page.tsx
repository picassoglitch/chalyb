import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listEngines } from '@/lib/data/engines';
import { trialFlowEnabled } from '@/lib/config/flags';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { CLIP_FAILURE_REASONS, type ClipFailureReason } from '@/lib/tools/adapters/types';
import { EngineLaunchButton } from '@/components/workspace/engine-launch-button';
import { WizardHeader } from '@/components/app/clips/wizard-header';
import { ClipError } from '@/components/app/clips/clip-error';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('s1.metaTitle') };
}

// Clips · Paso 1 (SCR-02): paste a link. Functional markup; P1 applies the
// design system and P3 adds the connect/upload alternatives once they exist.
//
// With TOOL_HUB_MODE_CHALYBCLIP=off (no job API yet) this screen hands off to
// the Clips app over SSO instead (P0-14).

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

  if (!getClipsAdapter()) {
    const engine = (await listEngines().catch(() => [])).find((e) => e.slug === 'chalybclip');
    return (
      <div className="cc-scroll" style={{ maxWidth: 760 }}>
        <WizardHeader step={1} backHref="/app" />
        <h1 style={h1}>{t('handoff.title')}</h1>
        <p style={sub}>{t('handoff.body')}</p>
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
    );
  }

  const reason = (CLIP_FAILURE_REASONS as readonly string[]).includes(error ?? '')
    ? (error as ClipFailureReason)
    : null;

  return (
    <div className="cc-scroll" style={{ maxWidth: 760 }}>
      <WizardHeader step={1} backHref="/app" />
      {reason ? (
        <ClipError reason={reason} sourceUrl={link} />
      ) : (
        <form action="/app/clips/formato" method="get">
          <h1 style={h1}>
            <label htmlFor="clip-link">{t('s1.title')}</label>
          </h1>
          <p style={sub} id="clip-link-sub">
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
            style={input}
          />
          <p id="clip-link-works" style={{ ...sub, fontSize: 16, marginTop: 12 }}>
            {t('s1.works')}
          </p>
          <button type="submit" style={primary}>
            {t('s1.cta')}
          </button>
        </form>
      )}
    </div>
  );
}

const h1 = { fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 } as const;
const sub = { fontSize: 18, color: 'var(--cc-txt-2)', lineHeight: 1.5, marginBottom: 20 } as const;
const input = {
  width: '100%',
  minHeight: 60,
  padding: '0 18px',
  borderRadius: 16,
  border: '1.5px solid var(--cc-line-2)',
  background: 'var(--cc-panel)',
  color: 'var(--cc-txt)',
  fontSize: 18,
} as const;
const primary = {
  marginTop: 20,
  width: '100%',
  maxWidth: 520,
  minHeight: 64,
  borderRadius: 18,
  border: 'none',
  background: 'var(--cc-green)',
  color: '#070809',
  fontSize: 19,
  fontWeight: 700,
  cursor: 'pointer',
} as const;
