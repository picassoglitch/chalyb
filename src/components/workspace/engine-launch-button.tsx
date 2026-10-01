'use client';

// "Abrir" for a tool. Opens the tab on the click (see launch-window.ts), asks
// the server for the signed URL, then fills the tab in. If the browser blocked
// the tab, a link takes its place; if the server refused, the mapped message
// and its one next action take its place. Nothing ends silently.

import { useRef, useState, useTransition } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { getEngineLaunchUrl } from '@/lib/engines/launch-actions';
import type { CustomerErrorCode } from '@/lib/errors/customer-errors';
import { finishLaunch, openLaunchWindow, type LaunchOutcome } from './launch-window';

interface Props {
  engineId: string;
  slug: string;
  /** Customer-facing tool name ("Clips"). */
  toolName: string;
  /** Where "Prueba Pro gratis" / "Ver planes" leads for NEEDS_PLAN. */
  planHref: string;
  /** Whether the trial path exists yet (TRIAL_FLOW_ENABLED). */
  trialFlow: boolean;
}

const RETRYABLE: ReadonlySet<CustomerErrorCode> = new Set([
  'PROVISION_FAILED',
  'TOOL_UNAVAILABLE',
  'NETWORK',
  'UNKNOWN',
]);

export function EngineLaunchButton({ engineId, slug, toolName, planHref, trialFlow }: Props) {
  const t = useTranslations('launch');
  const tErr = useTranslations('errors.tool');
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null);
  const busy = useRef(false);

  function onClick() {
    if (busy.current) return;
    busy.current = true;
    setOutcome(null);
    // Synchronous, inside the click — the only moment a browser allows it.
    const win = openLaunchWindow((url, target) => window.open(url, target));
    startTransition(async () => {
      try {
        const result = await getEngineLaunchUrl(engineId).catch(
          () => ({ ok: false, code: 'NETWORK' }) as const,
        );
        setOutcome(finishLaunch(win, result));
      } finally {
        busy.current = false;
      }
    });
  }

  const errorCode = outcome?.kind === 'error' ? outcome.code : null;
  const errorText =
    errorCode === null
      ? null
      : errorCode === 'PROVISION_FAILED' && slug === 'chalybclip'
        ? tErr('PROVISION_FAILED_CLIPS')
        : tErr(errorCode, { tool: toolName });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'inherit' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className="ch-btn ch-btn--primary ch-btn--xl"
      >
        {pending ? t('opening') : t('open')}
      </button>

      <div role="status" aria-live="polite" style={{ fontSize: 17, lineHeight: 1.5 }}>
        {outcome?.kind === 'blocked' && (
          <span>
            {t('blocked')}{' '}
            <a href={outcome.url} target="_blank" rel="noopener noreferrer" className="ch-lnk">
              {t('openNamed', { tool: toolName })}
            </a>
          </span>
        )}
        {errorText && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span>{errorText}</span>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {errorCode === 'NEEDS_PLAN' && (
                <Link href={planHref as Route} className="ch-btn ch-btn--secondary ch-btn--compact">
                  {trialFlow ? t('trialCta') : t('plansCta')}
                </Link>
              )}
              {errorCode === 'SESSION_EXPIRED' && (
                <Link
                  href={'/sign-in' as Route}
                  className="ch-btn ch-btn--secondary ch-btn--compact"
                >
                  {t('signIn')}
                </Link>
              )}
              {errorCode && RETRYABLE.has(errorCode) && (
                <button
                  type="button"
                  onClick={onClick}
                  disabled={pending}
                  className="ch-btn ch-btn--secondary ch-btn--compact"
                >
                  {t('retry')}
                </button>
              )}
              {errorCode !== 'NEEDS_PLAN' && errorCode !== 'SESSION_EXPIRED' && (
                <Link href={'/app/help' as Route} className="ch-btn ch-btn--ok ch-btn--compact">
                  {t('help')}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
