'use client';

import { useState, useTransition } from 'react';
import { useWorkspace } from '@/lib/workspace/store';
import { setSelectedLiveEngine } from '@/lib/auth/selected-engine-actions';

interface Props {
  engineId: string;
  engineName: string;
  isCurrentlySelected: boolean;
  /** If the engine is coming_soon or deprecated, the button is disabled with
   *  a teaser message instead of an active CTA. */
  disabled?: boolean;
  disabledReason?: string;
}

export function LiveEngineSelectButton({
  engineId,
  engineName,
  isCurrentlySelected,
  disabled,
  disabledReason,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(isCurrentlySelected);
  const showToast = useWorkspace((s) => s.showToast);

  function handleClick() {
    if (pending || selected || disabled) return;
    startTransition(async () => {
      const res = await setSelectedLiveEngine(engineId);
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error}`);
        return;
      }
      setSelected(true);
      showToast(`<b>${engineName}</b> ahora corre en vivo. Tu slot Pro está ocupado.`);
    });
  }

  if (selected) {
    return (
      <button
        type="button"
        disabled
        className="cc-mod-badge gr"
        style={{
          cursor: 'default',
          fontFamily: 'var(--cc-mono), monospace',
          padding: '5px 10px',
          fontWeight: 600,
        }}
      >
        ● EN VIVO
      </button>
    );
  }

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        style={{
          background: 'transparent',
          border: '1px dashed var(--cc-line-2)',
          color: 'var(--cc-txt-4)',
          padding: '6px 12px',
          borderRadius: 7,
          fontFamily: 'inherit',
          fontSize: 11.5,
          fontWeight: 500,
          cursor: 'not-allowed',
        }}
      >
        {disabledReason ?? 'No disponible'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={{
        background: 'transparent',
        border: '1px solid var(--cc-green)',
        color: 'var(--cc-green)',
        padding: '6px 12px',
        borderRadius: 7,
        fontFamily: 'inherit',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: pending ? 'wait' : 'pointer',
      }}
    >
      {pending ? '…' : 'Activar en vivo'}
    </button>
  );
}

// Back-compat alias for any straggler import sites.
export { LiveEngineSelectButton as LiveBotSelectButton };
