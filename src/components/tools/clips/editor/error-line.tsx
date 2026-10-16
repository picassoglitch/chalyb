'use client';

// One line saying why an editor action didn't work, from the BFF's
// normalized error: a refusal (tokens, plan caps) is the person's state and
// says what to do; anything else is "try again" with the support code.

import { useTranslations } from 'next-intl';
import type { EditorCallError } from './api';

const KNOWN = ['no_credits', 'rate_limited', 'too_large', 'needs_plan', 'not_found', 'bad_request'];

export function ErrorLine({ error }: { error: EditorCallError }) {
  const t = useTranslations('clipsEditor.errors');
  const reason = error.status === 401 ? 'session' : (error.error?.reason ?? 'unknown');
  const key = reason === 'session' || KNOWN.includes(reason) ? reason : 'generic';
  return (
    <p className="ch-ce__flash ch-ce__flash--bad" role="alert" data-reason={reason}>
      {t(key)}
      {error.error?.supportCode ? (
        <span className="ch-ce__code"> {t('code', { codigo: error.error.supportCode })}</span>
      ) : null}
    </p>
  );
}
