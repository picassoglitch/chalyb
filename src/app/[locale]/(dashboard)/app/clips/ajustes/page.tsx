import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check } from 'lucide-react';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { loadTool } from '@/lib/tools/access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { AdvancedOptions } from '@/components/tools/advanced-options';
import { AccountsList, accountRows } from '@/components/tools/clips/accounts-list';
import {
  ClipsAdvancedFields,
  ClipsSettingsForm,
} from '@/components/tools/clips/clips-settings-form';
import { AutopublishForm } from '@/components/tools/clips/autopublish-form';
import { ButtonLink } from '@/components/ui/primitives';
import { SetupState } from '@/components/ui/setup-state';
import '@/styles/tools-clips.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsTool');
  return { title: t('metaSettings') };
}

// Ajustes de Clips (TOOLS-SPEC §4.3, mockup 52). Every row comes from the
// engine's capabilities: an account can be connected only when the engine
// connects (supportsConnect), the brand section only with watermark, and
// Opciones avanzadas lists only the rows it can honour (and isn't rendered
// at all when there are none). No AI voice or face here (BUILD-SPEC §11.6).

export default async function ClipsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybclip', '/app/clips/ajustes', getClipsAdapter);
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
      <ToolShell slug="chalybclip" tab="settings">
        {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
        {gate.kind === 'setup' && (
          <SetupState step={gate.step} alternativeHref="/app/clips/nuevo" />
        )}
      </ToolShell>
    );

  const t = await getTranslations('clipsTool');
  const ts = await getTranslations('clipsTool.settings');
  const tsh = await getTranslations('toolShell.advanced');
  const tca = await getTranslations('consents.autopublish');
  const { adapter, session, entitlements } = gate;
  const caps = adapter.capabilities();
  const [settings, accounts] = await Promise.all([
    adapter.getSettings(session.user.id),
    adapter.accounts(session.user.id),
  ]);
  const rows = accountRows(accounts, ['youtube', 'twitch', 'tiktok'], caps.supportsConnect);
  const connected = accounts.filter((a) => a.connected && a.handle).map((a) => a.handle!);
  const autopublish =
    caps.supportsConnect && connected.length > 0 && TIER_CAPS[entitlements.plan].clipAutoPublish;
  const adv = [
    autopublish && ts('autopublish'),
    caps.customDuration && ts('duration'),
    caps.framing && ts('framing'),
    caps.bulkUpload && ts('bulk'),
  ].filter((x): x is string => !!x);
  const list = new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'conjunction' });
  const summary = list.format(
    adv.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1))),
  );

  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-setgrid">
        <div className="ch-setcol">
          {rows.length > 0 && (
            <section aria-labelledby="set-accts" className="ch-setgroup">
              <h2 id="set-accts" className="ch-ghead">
                {ts('accounts')}
              </h2>
              <div className="ch-card">
                <AccountsList
                  rows={rows}
                  returnTo="/app/clips/ajustes"
                  subs={{ tiktok: ts('tiktokSub') }}
                />
              </div>
            </section>
          )}
          <ClipsSettingsForm
            initial={settings}
            watermark={caps.watermark}
            copy={{
              captions: ts('captions'),
              captionsOn: ts('captionsOn'),
              captionLang: ts('captionLang'),
              langs: { es: t('langs.es'), en: t('langs.en') },
              style: ts('style'),
              styleHint: ts('styleHint'),
              presets: {
                clasico: t('presets.clasico'),
                amarillo: t('presets.amarillo'),
                fondo: t('presets.fondo'),
              },
              sample: t('presets.sample'),
              brand: ts('brand'),
              watermark: ts('watermark'),
              watermarkSub: ts('watermarkSub'),
              saving: t('detail.saving'),
              saveError: t('detail.saveError'),
            }}
          />
        </div>
      </div>

      {adv.length > 0 && (
        <AdvancedOptions
          storageKey="clips.settings"
          title={tsh('title')}
          sub={tsh('sub')}
          summary={summary}
        >
          <div className="ch-advrows">
            {autopublish && (
              <AutopublishForm
                accounts={connected}
                locale={locale}
                copy={{
                  title: ts('autopublish'),
                  account: ts('autopublishAccount'),
                  check: tca.raw('check') as string,
                  cta: tca('cta'),
                  done: ts.raw('autopublishOn') as string,
                  error: t('detail.saveError'),
                }}
              />
            )}
            <ClipsAdvancedFields
              initial={settings}
              duration={caps.customDuration}
              framing={caps.framing}
              copy={{
                duration: ts('duration'),
                durationAuto: ts('durationAuto'),
                durationFixed: ts.raw('durationFixed') as string,
                framing: ts('framing'),
                framingCenter: ts('framingCenter'),
                framingFollow: ts('framingFollow'),
              }}
            />
            {caps.bulkUpload && (
              <div className="ch-setrow">
                <span className="ch-setrow__tx">
                  <b>{ts('bulk')}</b>
                  <span className="ch-muted">{ts('bulkHint')}</span>
                </span>
                <ButtonLink href="/app/clips/nuevo" variant="secondary" size="compact">
                  {ts('bulkCta')}
                </ButtonLink>
              </div>
            )}
          </div>
        </AdvancedOptions>
      )}

      <p className="ch-muted ch-setnote">
        <Check aria-hidden="true" />
        {ts('autosave')}
      </p>
    </ToolShell>
  );
}
