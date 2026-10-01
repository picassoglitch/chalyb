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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className="cc-launch-btn"
        style={{
          background: 'var(--cc-green)',
          color: '#070809',
          minHeight: 48,
          padding: '12px 24px',
          borderRadius: 12,
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 16,
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? t('opening') : t('open')}
      </button>

      <div role="status" aria-live="polite" style={{ fontSize: 15, lineHeight: 1.5 }}>
        {outcome?.kind === 'blocked' && (
          <span>
            {t('blocked')}{' '}
            <a href={outcome.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              {t('openNamed', { tool: toolName })}
            </a>
          </span>
        )}
        {errorText && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span>{errorText}</span>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {errorCode === 'NEEDS_PLAN' && (
                <Link href={planHref as Route} style={linkStyle}>
                  {trialFlow ? t('trialCta') : t('plansCta')}
                </Link>
              )}
              {errorCode === 'SESSION_EXPIRED' && (
                <Link href={'/sign-in' as Route} style={linkStyle}>
                  {t('signIn')}
                </Link>
              )}
              {errorCode && RETRYABLE.has(errorCode) && (
                <button type="button" onClick={onClick} disabled={pending} style={retryStyle}>
                  {t('retry')}
                </button>
              )}
              {errorCode !== 'NEEDS_PLAN' && errorCode !== 'SESSION_EXPIRED' && (
                <Link href={'/app/help' as Route} style={linkStyle}>
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

const linkStyle = {
  color: 'var(--cc-green)',
  textDecoration: 'underline',
  fontWeight: 600,
  minHeight: 48,
  display: 'inline-flex',
  alignItems: 'center',
} as const;

const retryStyle = {
  minHeight: 48,
  padding: '10px 18px',
  borderRadius: 12,
  border: '1px solid var(--cc-line-2)',
  background: 'transparent',
  color: 'var(--cc-txt)',
  fontFamily: 'inherit',
  fontSize: 15,
  cursor: 'pointer',
} as const;
