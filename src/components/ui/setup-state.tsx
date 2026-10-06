// "Te falta un paso" (BUILD-SPEC §4.1 B2, §7.6, mockup 24 panel 3).
//
// Setup is a NAMED state: the tool knows exactly which step is missing and
// shows one button that resolves exactly that step. When nothing in the app
// can resolve it yet, no button is shown — never a button that goes nowhere.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Link2 } from 'lucide-react';
import type { SetupStep } from '@/lib/billing/entitlement-core';
import { ButtonLink } from './primitives';

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
    <section aria-labelledby="setup-title" className="ch-card ch-state">
      <span className="ch-state__ic" aria-hidden="true">
        <Link2 />
      </span>
      <h2 id="setup-title" className="ch-h2">
        {t(`${step}.title`)}
      </h2>
      <p className="ch-muted" style={{ maxWidth: 520 }}>
        {t(`${step}.body`)}
      </p>
      {resolver && <ButtonLink href={resolver}>{t('cta')}</ButtonLink>}
      {alternativeHref && (
        <Link href={alternativeHref as Route} className="ch-lnk">
          {t('alt')}
        </Link>
      )}
    </section>
  );
}
