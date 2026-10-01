// Wizard chrome (BUILD-SPEC §0.7): Atrás on the left, the tool in the middle,
// close on the right, and "Paso N de 3" underneath. P1 re-skins it with the
// design system's FlowTopbar + StepBar.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export async function WizardHeader({ step, backHref }: { step: 1 | 2 | 3; backHref: string }) {
  const t = await getTranslations('clips');
  return (
    <header style={{ marginBottom: 28 }}>
      <nav
        aria-label={t('wizardNav')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <Link href={backHref as Route} style={chrome}>
          ← {step === 1 ? t('home') : t('back')}
        </Link>
        <span style={{ fontWeight: 600, fontSize: 18 }}>Clips</span>
        <Link href={'/app' as Route} style={chrome} aria-label={t('close')}>
          ✕
        </Link>
      </nav>
      <p style={{ marginTop: 14, fontSize: 15, color: 'var(--cc-txt-3)' }}>
        {t('step', { n: step })}
      </p>
    </header>
  );
}

const chrome = {
  minWidth: 48,
  minHeight: 48,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 12px',
  color: 'var(--cc-txt-2)',
  textDecoration: 'none',
  fontSize: 16,
} as const;
