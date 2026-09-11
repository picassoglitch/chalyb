'use client';

// Button on the per-engine admin detail page that syncs the engine's
// cost_per_million_tokens_cents from Anthropic's real org-wide billing
// data over the last 30 days. One click hits the org admin API, computes
// a blended USD/MXN rate, and writes it into the engine row. The toast
// shows the captured tokens + total cost so the operator can sanity-check
// against their Anthropic dashboard.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { syncEngineCostFromAnthropic } from '@/lib/engines/admin-actions';

interface Props {
  engineId: string;
  engineName: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('es-MX');
}

export function AnthropicSyncButton({ engineId, engineName }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function handle() {
    if (pending) return;
    startTransition(async () => {
      const res = await syncEngineCostFromAnthropic(engineId);
      if (!res.ok) {
        showToast(`<b>No se pudo sincronizar con Anthropic</b> · ${res.error ?? 'sin detalle'}`);
        return;
      }
      const rateFmt = `$${((res.rate ?? 0) / 100).toLocaleString('es-MX')}`;
      const totalFmt = `$${((res.totalCostCents ?? 0) / 100).toLocaleString('es-MX')}`;
      showToast(
        `<b>${engineName}</b> · costo actualizado: ${rateFmt}/1M · ` +
          `con base en ${formatTokens(res.totalTokens ?? 0)} tokens / ${totalFmt} MXN ` +
          `en ${res.daysCounted ?? 30}d`,
      );
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      title="Trae los últimos 30 días de facturación real de Anthropic y actualiza el costo"
      style={{
        padding: '6px 11px',
        borderRadius: 7,
        border: '1px solid var(--cc-line-2)',
        background: pending ? 'var(--cc-bg-3)' : 'transparent',
        color: pending ? 'var(--cc-txt-4)' : 'var(--cc-txt-2)',
        fontFamily: 'inherit',
        fontSize: 11.5,
        fontWeight: 500,
        cursor: pending ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 12 }}>↻</span>
      <span>{pending ? 'Sincronizando…' : 'Sincronizar con Anthropic'}</span>
    </button>
  );
}
