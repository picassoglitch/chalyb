import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { checkSourceUrl } from '@/lib/tools/adapters/run-job';
import { CAPTION_STYLES, CLIP_COUNTS, CLIP_FORMATS } from '@/lib/tools/adapters/types';
import { MAX_EXTRA_LINKS } from '@/lib/tools/clips-options';
import { createClipJob } from '@/lib/tools/clips-actions';
import { WizardShell } from '@/components/ui/wizard-shell';
import { Pill } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('s2.metaTitle') };
}

// Clips · Paso 2 (SCR-03): the shape and how many. Defaults are the
// recommended ones (Vertical, 6), so "Crear mis clips" works untouched.
// Opciones avanzadas (SCR-06) is closed by default and shows only the rows
// the adapter supports; autopublish waits for supportsConnect (P3-3).

export default async function ClipsStep2Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ link?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireClipsAccess(locale, '/app/clips');
  if (!getClipsAdapter()) return redirect({ href: '/app/clips', locale });

  const { link } = await searchParams;
  const checked = checkSourceUrl(link ?? '');
  if (!checked.ok) {
    return redirect({
      href: `/app/clips?error=${checked.reason}&link=${encodeURIComponent(link ?? '')}`,
      locale,
    });
  }

  const t = await getTranslations('clips');
  const caps = getClipsAdapter()!.capabilities();

  return (
    <WizardShell
      slug="chalybclip"
      toolName="Clips"
      step={2}
      stepLabel={t('step', { n: 2 })}
      backHref={`/app/clips?link=${encodeURIComponent(checked.url)}`}
      backLabel={t('back')}
      closeLabel={t('close')}
    >
      <form action={createClipJob} className="ch-center-col">
        <input type="hidden" name="link" value={checked.url} />
        <fieldset className="ch-fieldset">
          <legend className="ch-h1">{t('s2.title')}</legend>
          <p className="ch-sub">{t('s2.sub')}</p>
          <div className="ch-formats">
            {CLIP_FORMATS.map((format) => (
              <label key={format} className="ch-format">
                <input
                  type="radio"
                  name="format"
                  value={format}
                  defaultChecked={format === 'vertical'}
                />
                <span
                  className={`ch-format__shape ch-format__shape--${format}`}
                  aria-hidden="true"
                />
                <span className="ch-format__t">{t(`s2.formats.${format}.title`)}</span>
                <span className="ch-muted">{t(`s2.formats.${format}.detail`)}</span>
                {format === 'vertical' && <Pill kind="acc">{t('s2.recommended')}</Pill>}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ textAlign: 'center' }}>
          <p className="ch-h2" id="count-title">
            {t('s2.count')}
          </p>
          <p className="ch-muted" style={{ margin: '6px 0 14px' }}>
            {t('s2.countHint')}
          </p>
          <Segmented
            name="count"
            legend={t('s2.count')}
            defaultValue={6}
            options={CLIP_COUNTS.map((n) => ({ value: n, label: String(n) }))}
          />
        </div>

        {(caps.bulkUpload || caps.captionStyles || caps.customDuration) && (
          <details className="ch-card ch-adv">
            <summary>
              <b>{t('adv.title')}</b> · <span className="ch-muted">{t('adv.sub')}</span>
            </summary>
            <div className="ch-adv__body">
              {caps.bulkUpload && (
                <div className="ch-field">
                  <label htmlFor="adv-more">{t('adv.bulk')}</label>
                  <textarea
                    id="adv-more"
                    name="more"
                    rows={3}
                    inputMode="url"
                    className="ch-input ch-textarea"
                    aria-describedby="adv-more-hint"
                  />
                  <p id="adv-more-hint" className="ch-muted" style={{ fontSize: 16, marginTop: 8 }}>
                    {t('adv.bulkHint', { n: MAX_EXTRA_LINKS })}
                  </p>
                </div>
              )}
              {caps.captionStyles && (
                <fieldset className="ch-fieldset ch-adv__row">
                  <legend>{t('adv.captions')}</legend>
                  <label className="ch-field">
                    <span>{t('adv.captionStyle')}</span>
                    <select name="captionStyle" className="ch-input" defaultValue="clasico">
                      {CAPTION_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {t(`adv.styles.${s}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ch-field">
                    <span>{t('adv.captionLang')}</span>
                    <select name="captionLang" className="ch-input" defaultValue={locale === 'en' ? 'en' : 'es'}>
                      {(['es', 'en'] as const).map((l) => (
                        <option key={l} value={l}>
                          {t(`adv.langs.${l}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              )}
              {caps.customDuration && (
                <fieldset className="ch-fieldset ch-adv__row">
                  <legend>
                    {t('adv.duration')} <span className="ch-muted">· {t('adv.durationHint')}</span>
                  </legend>
                  <label className="ch-field">
                    <span>{t('adv.min')}</span>
                    <input name="minSec" type="number" min={15} max={60} inputMode="numeric" className="ch-input" />
                  </label>
                  <label className="ch-field">
                    <span>{t('adv.max')}</span>
                    <input name="maxSec" type="number" min={15} max={60} inputMode="numeric" className="ch-input" />
                  </label>
                </fieldset>
              )}
              <p className="ch-muted">{t('adv.default')}</p>
            </div>
          </details>
        )}

        <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">
          {t('s2.cta')}
        </button>
      </form>
    </WizardShell>
  );
}
