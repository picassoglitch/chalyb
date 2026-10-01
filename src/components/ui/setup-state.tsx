// "Te falta un paso" (BUILD-SPEC §4.1 B2, §7.6, mockup 24 panel 3).
//
// Setup is a NAMED state: the tool knows exactly which step is missing and
// shows one button that resolves exactly that step. When nothing in the app
// can resolve it yet, no button is shown — never a button that goes nowhere.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { SetupStep } from '@/lib/billing/entitlement-core';

/** Where each step is resolved. A step without an entry has no resolver yet:
 *  the state renders without a button. The connection flows land in P3. */
const RESOLVERS: Partial<Record<SetupStep, string>> = {};

export async function SetupState({
  step,
  alternativeHref,
}: {
  step: SetupStep;
  /** A way to use the tool without the connection, when one exists (Clips:
   *  paste a link). Never blocked by an optional connection. */
  alternativeHref?: string;
}) {
  const t = await getTranslations('setup');
  const resolver = RESOLVERS[step];
  return (
    <section
      aria-labelledby="setup-title"
      style={{
        padding: '24px 26px',
        border: '1px solid var(--cc-line-2)',
        background: 'var(--cc-panel)',
        borderRadius: 'var(--cc-r-l)',
        marginBottom: 28,
      }}
    >
      <h2 id="setup-title" style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
        {t(`${step}.title`)}
      </h2>
      <p style={{ fontSize: 16, color: 'var(--cc-txt-2)', lineHeight: 1.5, marginBottom: 16 }}>
        {t(`${step}.body`)}
      </p>
      {resolver && (
        <Link href={resolver as Route} className="cc-btn-primary" style={primaryStyle}>
          {t('cta')}
        </Link>
      )}
      {alternativeHref && (
        <p style={{ marginTop: 14 }}>
          <Link href={alternativeHref as Route} style={{ color: 'var(--cc-green)' }}>
            {t('alt')}
          </Link>
        </p>
      )}
    </section>
  );
}

const primaryStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 52,
  padding: '12px 24px',
  borderRadius: 12,
  background: 'var(--cc-green)',
  color: '#070809',
  fontWeight: 600,
  textDecoration: 'none',
} as const;
