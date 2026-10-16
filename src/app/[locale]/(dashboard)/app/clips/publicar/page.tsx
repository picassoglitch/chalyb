import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadPublishOverview, loadPublishTool } from '@/lib/tools/adapters/clips/publish-page';
import { socialsAllowed } from '@/lib/tools/clips-bff';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { Banner } from '@/components/ui/primitives';
import { SetupState } from '@/components/ui/setup-state';
import { PublishCenter } from '@/components/tools/clips/publish/publish-center';
import { isPublishTab, type Overview } from '@/components/tools/clips/publish/types';
import '@/styles/tools-clips.css';
import '@/components/tools/clips/publish/publish.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsPublish');
  return { title: t('metaTitle') };
}

// Centro de publicación (Clips → Publicar): connected networks, publish one
// or many clips, drafts, schedule, auto-pilot, inbox and growth — the Clips
// app's Zernio publishing, in the hub. Screens and copy in
// src/components/tools/clips/publish/; the BFF in
// src/app/api/tools/chalybclip/publish/.

export default async function ClipsPublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; conectado?: string }>;
}) {
  const { locale } = await params;
  const { tab, conectado } = await searchParams;
  setRequestLocale(locale);
  const gate = await loadPublishTool(locale, '/app/clips/publicar');
  if (gate.kind === 'locked')
    return (
      <ToolShell
        slug="chalybclip"
        tab={null}
        plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}
      >
        <ToolLockedState slug="chalybclip" entitlements={gate.entitlements} />
      </ToolShell>
    );
  if (gate.kind !== 'ready')
    return (
      <ToolShell slug="chalybclip" tab="publish">
        {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
        {gate.kind === 'setup' && (
          <SetupState step={gate.step} alternativeHref="/app/clips/nuevo" />
        )}
      </ToolShell>
    );

  const t = await getTranslations('clipsPublish');
  const overview = await loadPublishOverview<Overview>(gate.adapter, gate.session.user.id);
  return (
    <ToolShell slug="chalybclip" tab="publish">
      {!socialsAllowed(gate.entitlements.plan) && (
        <Banner kind="trial" action={{ href: '/app/planes', label: t('needsPlan.cta') }}>
          {t('needsPlan.body')}
        </Banner>
      )}
      {overview.ok ? (
        <PublishCenter
          initial={overview.data}
          initialTab={isPublishTab(tab) ? tab : null}
          canAutopilot={TIER_CAPS[gate.entitlements.plan]?.clipAutoPublish === true}
          connected={
            typeof conectado === 'string' && /^[a-z]{1,20}$/.test(conectado) ? conectado : null
          }
        />
      ) : (
        <ToolErrorState slug="chalybclip" error={overview.error} />
      )}
    </ToolShell>
  );
}
