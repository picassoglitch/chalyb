'use client';

// "Re-provisionar" CTA shown on the engine workspace when the access row
// exists but external_user_id is still NULL. Clicking it forces another
// trip to the engine's admin API; the result lands in a toast.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/workspace/store';
import { reprovisionEngine } from '@/lib/engines/reprovision-actions';

interface Props {
  engineId: string;
  engineName: string;
}

export function EngineReprovisionButton({ engineId, engineName }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useWorkspace((s) => s.showToast);

  function onClick() {
    startTransition(async () => {
      const result = await reprovisionEngine(engineId);
      if (result.ok) {
        showToast(
          `<b>${engineName}</b> · tu cuenta ya está lista (id: ${result.externalUserId})`,
        );
        // RSC refresh so the "Tu acceso" panel re-renders with the new id.
        router.refresh();
      } else {
        showToast(`<b>Error</b> · ${result.error ?? 'No pudimos crear tu cuenta'}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        background: 'var(--cc-amber)',
        color: '#070809',
        padding: '9px 18px',
        borderRadius: 8,
        border: 'none',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? 'Creando tu cuenta…' : `↻ Crear tu cuenta en ${engineName}`}
    </button>
  );
}
