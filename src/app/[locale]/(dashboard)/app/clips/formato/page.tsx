import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { checkSourceUrl } from '@/lib/tools/adapters/run-job';
import { CLIP_COUNTS, CLIP_FORMATS } from '@/lib/tools/adapters/types';
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
// P3 adds Opciones avanzadas (SCR-06) below.

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

        <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">
          {t('s2.cta')}
        </button>
      </form>
    </WizardShell>
  );
}
