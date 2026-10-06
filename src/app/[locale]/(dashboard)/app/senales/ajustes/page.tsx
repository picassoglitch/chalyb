import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { loadTool } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { riskAckAt } from '@/lib/tools/consents';
import { DEFAULT_PREFS } from '@/lib/tools/signals-prefs';
import { maskEmail, SIGNAL_TZ } from '@/lib/tools/signals-view';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { SignalsSettingsForm } from '@/components/tools/senales/settings-form';
import { LegalSheetButton } from '@/components/tools/senales/legal-sheet-button';
import '@/styles/tools-senales.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signalsTool');
  return { title: t('metaSettings') };
}

// Ajustes de Señales (TOOLS-SPEC §5.4, mockup 56): which coins, how and
// when we alert, and the risk notice accepted. Delivery only — no money
// fields and no exchange link exist here.

export default async function SenalesAjustes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybcrypto', '/app/senales/ajustes', getSenales);
  if (gate.kind === 'error')
    return (
      <ToolShell slug="chalybcrypto" tab="settings">
        <ToolErrorState slug="chalybcrypto" error={gate.error} />
      </ToolShell>
    );
  if (gate.kind !== 'ready' || gate.riskPending) return redirect({ href: '/app/senales', locale });
  const { session, adapter } = gate;
  const [coins, channels, prefs, ackAt] = await Promise.all([
    adapter.coins(),
    adapter.channels(),
    adapter.getPrefs(session.user.id),
    riskAckAt(session.user.id, 'chalybcrypto').catch(() => null),
  ]);
  if (!prefs) return redirect({ href: '/app/senales/empezar', locale });
  const t = await getTranslations('signalsTool.settings');
  const tc = await getTranslations('consents.risk');
  const td = await getTranslations('toolShell.disclaimer');
  const fecha = ackAt
    ? new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
        timeZone: SIGNAL_TZ,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(ackAt))
    : null;

  return (
    <ToolShell slug="chalybcrypto" tab="settings">
      <SignalsSettingsForm
        coins={coins}
        channels={channels}
        initial={{ ...DEFAULT_PREFS, ...prefs }}
        maskedEmail={maskEmail(session.user.email)}
        locale={locale}
        legal={
          <section aria-labelledby="sig-legal">
            <h2 id="sig-legal" className="ch-ghead">
              {t('legal')}
            </h2>
            <div className="ch-group">
              <div className="ch-row">
                <span className="ch-row__tx">
                  <b>{t('riskNotice')}</b>
                  {fecha && <small>{t('riskAccepted', { fecha })}</small>}
                </span>
                <LegalSheetButton
                  label={t('readAgain')}
                  title={td('sheetTitle')}
                  legal={tc.markup('body', { herramienta: 'Señales', b: (c) => `<b>${c}</b>` })}
                  closeLabel={td('close')}
                />
              </div>
            </div>
          </section>
        }
      />
    </ToolShell>
  );
}
