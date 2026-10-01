// Admin-only diagnostics for a tool page (P0-5).
//
// Everything the old "Tu acceso" panel printed to customers — the engine-side
// id, the env var that has to match, the admin_api_base column, the log tag —
// is useful to an operator and meaningless (or alarming) to a customer. It
// lives here now, collapsed, and the page renders it only for admin roles.
// Admin UI may keep technical words (rebuild prompt §1.4).

import type { getEngineAccess } from '@/lib/engines/subscriptions';
import { EngineReprovisionButton } from '@/components/workspace/engine-reprovision-button';

interface Props {
  engineId: string;
  slug: string;
  requiresProvisioning: boolean;
  access: Awaited<ReturnType<typeof getEngineAccess>>;
}

export function EngineDiagnostics({ engineId, slug, requiresProvisioning, access }: Props) {
  const envPrefix = slug.toUpperCase();
  return (
    <details
      data-testid="admin-diagnostics"
      style={{
        marginTop: 28,
        padding: '14px 18px',
        border: '1px dashed #c9c9d2',
        borderRadius: 16,
        fontSize: 15,
        color: '#5e5e66',
        background: '#fff',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Diagnóstico (solo admin)</summary>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          gap: '6px 14px',
          marginTop: 12,
        }}
      >
        <dt>slug</dt>
        <dd>{slug}</dd>
        <dt>engine_subscriptions</dt>
        <dd>{access ? `${access.status} · source=${access.source}` : 'sin fila'}</dd>
        <dt>external_user_id</dt>
        <dd>{access?.external_user_id ?? '—'}</dd>
        <dt>requires_provisioning</dt>
        <dd>{String(requiresProvisioning)}</dd>
      </dl>
      {requiresProvisioning && !access?.external_user_id && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EngineReprovisionButton engineId={engineId} engineName={slug} />
          <p style={{ lineHeight: 1.5 }}>
            Si falla: el engine debe estar en línea; <code>{envPrefix}_ADMIN_TOKEN</code> (Vercel)
            debe coincidir con <code>CHALYB_ADMIN_TOKEN</code> en el engine;{' '}
            <code>engines.admin_api_base</code> debe apuntar al endpoint correcto. Busca{' '}
            <code>[launch]</code> y <code>[engine_subs]</code> en los logs.
          </p>
        </div>
      )}
    </details>
  );
}
