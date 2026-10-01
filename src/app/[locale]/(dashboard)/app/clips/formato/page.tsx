import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { checkSourceUrl } from '@/lib/tools/adapters/run-job';
import { CLIP_COUNTS, CLIP_FORMATS } from '@/lib/tools/adapters/types';
import { createClipJob } from '@/lib/tools/clips-actions';
import { WizardHeader } from '@/components/app/clips/wizard-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('s2.metaTitle') };
}

// Clips · Paso 2 (SCR-03): pick the shape and how many. Defaults are the
// recommended ones (Vertical, 6), so "Crear mis clips" works untouched.

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
  const backHref = `/app/clips?link=${encodeURIComponent(checked.url)}`;

  return (
    <div className="cc-scroll" style={{ maxWidth: 1000 }}>
      <WizardHeader step={2} backHref={backHref} />
      <form action={createClipJob}>
        <input type="hidden" name="link" value={checked.url} />
        <fieldset style={fieldset}>
          <legend style={h1}>{t('s2.title')}</legend>
          <p style={sub}>{t('s2.sub')}</p>
          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            {CLIP_FORMATS.map((format) => (
              <label key={format} style={option}>
                <input
                  type="radio"
                  name="format"
                  value={format}
                  defaultChecked={format === 'vertical'}
                  style={radio}
                />
                <span>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 18 }}>
                    {t(`s2.formats.${format}.title`)}
                  </span>
                  <span style={{ display: 'block', color: 'var(--cc-txt-2)', fontSize: 16 }}>
                    {t(`s2.formats.${format}.detail`)}
                  </span>
                  {format === 'vertical' && (
                    <span
                      className="cc-mod-badge gr"
                      style={{ marginTop: 8, display: 'inline-block' }}
                    >
                      {t('s2.recommended')}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ ...fieldset, marginTop: 28 }}>
          <legend style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
            {t('s2.count')}
          </legend>
          <p style={{ ...sub, fontSize: 16 }}>{t('s2.countHint')}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {CLIP_COUNTS.map((count) => (
              <label key={count} style={{ ...option, minWidth: 96, justifyContent: 'center' }}>
                <input
                  type="radio"
                  name="count"
                  value={count}
                  defaultChecked={count === 6}
                  style={radio}
                />
                <span style={{ fontSize: 20, fontWeight: 600 }}>{count}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" style={primary}>
          {t('s2.cta')}
        </button>
      </form>
    </div>
  );
}

const h1 = { fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 } as const;
const sub = { fontSize: 18, color: 'var(--cc-txt-2)', lineHeight: 1.5, marginBottom: 20 } as const;
const fieldset = { border: 'none', padding: 0, margin: 0, minWidth: 0 } as const;
const option = {
  display: 'flex',
  gap: 14,
  alignItems: 'flex-start',
  minHeight: 64,
  padding: '16px 18px',
  borderRadius: 20,
  border: '1.5px solid var(--cc-line-2)',
  background: 'var(--cc-panel)',
  cursor: 'pointer',
} as const;
const radio = { width: 24, height: 24, marginTop: 2, accentColor: 'var(--cc-green)' } as const;
const primary = {
  marginTop: 28,
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
