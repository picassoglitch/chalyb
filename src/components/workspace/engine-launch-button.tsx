'use client';

// Client button that asks the server for the engine's launch URL, then
// either opens it in a new tab (external_sso_redirect) or shows a toast
// with the error reason if the integration isn't ready.

import { useTransition } from 'react';
import { useWorkspace } from '@/lib/workspace/store';
import { getEngineLaunchUrl } from '@/lib/engines/launch-actions';

interface Props {
  engineId: string;
  engineName: string;
  label: string;
  /** When true (default), opens in a new tab so the user stays on Chalyb.
   *  When false, navigates in the same tab. */
  newTab?: boolean;
}

export function EngineLaunchButton({ engineId, engineName, label, newTab = true }: Props) {
  const [pending, startTransition] = useTransition();
  const showToast = useWorkspace((s) => s.showToast);

  function onClick() {
    startTransition(async () => {
      const result = await getEngineLaunchUrl(engineId);
      if (!result.ok || !result.url) {
        // Distinguish the "not configured / placeholder" case from real errors —
        // placeholder is expected during development, not a failure.
        if (result.reason === 'not_configured') {
          showToast(
            `<b>${engineName}</b> todavía no está en línea. Se conecta en cuanto ${engineName} esté listo.`,
          );
        } else {
          showToast(`<b>Error</b> · ${result.error ?? 'No pudimos abrir el engine. Inténtalo de nuevo.'}`);
        }
        return;
      }
      if (newTab) {
        // window.open with a "noopener noreferrer" stand-in keeps the engine
        // from getting a window.opener handle back into Chalyb's tab.
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = result.url;
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        background: 'var(--cc-green)',
        color: '#070809',
        padding: '11px 22px',
        borderRadius: 9,
        border: 'none',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 600,
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? 'Abriendo…' : label}
    </button>
  );
}
