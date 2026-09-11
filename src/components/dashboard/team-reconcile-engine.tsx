'use client';

// Bulk-reconcile control for /dashboard/team (B3 of the contemplation plan).
//
// Pattern: a small button in the page header that opens a popover with:
//   1. Engine selector (today: only chalybclip — single option)
//   2. "Vista previa (dry-run)" button — shows the proposed counts without
//      hitting the engine. Lets the admin see "this sweep would re-link 47
//      users" before pulling the trigger.
//   3. "Ejecutar reconciliación" button — actually rolls the sweep through
//      the engine integration.
//   4. Summary panel that appears after each run with the counts + errors.
//
// Designed for the 100-user partner-program scale. Past 500 we'd need a
// background job (the server action caps at 500 profiles).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import {
  reconcileEngineLinks,
  type ReconcileSummary,
} from '@/lib/engines/reconcile-actions';

const SUPPORTED_ENGINES: Array<{ slug: string; label: string }> = [
  { slug: 'chalybclip', label: 'ChalybClip' },
  // Add more here when integrations register reconciliation support.
];

export function TeamReconcileEngine() {
  const [open, setOpen] = useState(false);
  const [engineSlug, setEngineSlug] = useState<string>(SUPPORTED_ENGINES[0]!.slug);
  const [summary, setSummary] = useState<ReconcileSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function run(dryRun: boolean) {
    startTransition(async () => {
      const res = await reconcileEngineLinks(engineSlug, { dryRun });
      if (!res.ok || !res.summary) {
        showToast(`<b>Reconcile falló</b> · ${res.error ?? 'sin detalle'}`);
        setSummary(null);
        return;
      }
      setSummary(res.summary);
      const verb = dryRun ? 'Vista previa' : 'Reconciliación';
      showToast(
        `${verb} · ${res.summary.newlyLinked} nuevos · ${res.summary.alreadyLinked} ya linkeados · ${res.summary.errors.length} errores`,
      );
      if (!dryRun) router.refresh();
    });
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Re-linkear todos los usuarios contra un engine"
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--cc-line-2)',
          background: 'var(--cc-bg-2)',
          color: 'var(--cc-txt)',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>↻</span>
        <span>Reconciliar engines</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 50,
            width: 360,
            padding: 16,
            background: 'var(--cc-panel-2)',
            border: '1px solid var(--cc-line-2)',
            borderRadius: 9,
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--cc-mono), monospace',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--cc-txt-4)',
              textTransform: 'uppercase',
            }}
          >
            Reconciliación masiva · engine_subscriptions
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'var(--cc-txt-3)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Recorre cada perfil + re-provisiona contra el engine elegido.
            Idempotente: usuarios ya linkeados no se tocan. El engine reclama
            tenants huérfanos por email (post-B2). Tope: 500 usuarios por
            corrida.
          </p>

          <label
            style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}
          >
            <span style={{ color: 'var(--cc-txt-3)' }}>Engine</span>
            <select
              value={engineSlug}
              onChange={(e) => setEngineSlug(e.target.value)}
              disabled={pending}
              style={{
                background: 'var(--cc-bg-1)',
                border: '1px solid var(--cc-line-2)',
                borderRadius: 7,
                padding: '7px 10px',
                color: 'var(--cc-txt)',
                fontFamily: 'inherit',
                fontSize: 12.5,
              }}
            >
              {SUPPORTED_ENGINES.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.label} ({e.slug})
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => run(true)}
              disabled={pending}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 7,
                border: '1px solid var(--cc-line-2)',
                background: 'transparent',
                color: 'var(--cc-txt-2)',
                fontFamily: 'inherit',
                fontSize: 12,
                cursor: pending ? 'default' : 'pointer',
              }}
            >
              Vista previa
            </button>
            <button
              type="button"
              onClick={() => run(false)}
              disabled={pending}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 7,
                border: 'none',
                background: pending ? 'var(--cc-bg-3)' : 'var(--cc-green)',
                color: pending ? 'var(--cc-txt-4)' : '#070809',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: pending ? 'default' : 'pointer',
              }}
            >
              {pending ? 'Trabajando…' : 'Ejecutar'}
            </button>
          </div>

          {summary && (
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--cc-bg-1)',
                border: '1px solid var(--cc-line)',
                borderRadius: 8,
                fontSize: 11.5,
                color: 'var(--cc-txt-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--cc-mono), monospace',
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  color: 'var(--cc-txt-4)',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                {summary.engineName} · {summary.dryRun ? 'DRY RUN' : 'EJECUTADO'}
              </div>
              <div>Escaneados: <b>{summary.scanned}</b></div>
              <div style={{ color: 'var(--cc-green)' }}>
                Nuevos linkeados: <b>{summary.newlyLinked}</b>
              </div>
              <div>Ya linkeados: <b>{summary.alreadyLinked}</b></div>
              <div style={{ color: 'var(--cc-txt-3)' }}>
                Saltados (sin email / no requiere): <b>{summary.skipped}</b>
              </div>
              {summary.errors.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--cc-red)' }}>
                    Errores: <b>{summary.errors.length}</b>
                  </summary>
                  <ul
                    style={{
                      marginTop: 6,
                      paddingLeft: 18,
                      fontSize: 10.5,
                      color: 'var(--cc-txt-3)',
                      maxHeight: 140,
                      overflowY: 'auto',
                    }}
                  >
                    {summary.errors.map((e, i) => (
                      <li key={i}>
                        <code>{e.email ?? e.userId.slice(0, 8)}</code> — {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
