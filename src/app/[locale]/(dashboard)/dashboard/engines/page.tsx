import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { ENV_LABEL } from '@/lib/data/types';
import {
  EngineRoyaltyRateInput,
  EngineStatusSelect,
  EngineTierSelect,
} from '@/components/dashboard/engine-admin-controls';

export const metadata = { title: 'Engines · administración' };

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'gr' },
  coming_soon: { label: 'Próximamente', cls: 'am' },
  deprecated: { label: 'Deprecado', cls: 'r' },
};

export default async function AdminEnginesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Parent dashboard layout already gates non-admins to /app, but double-check here
  // in case this route is ever wired into a different layout.
  const session = await getSessionUser();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    redirect('/app');
  }

  const engines = await listEngines();
  const counts = {
    active: engines.filter((e) => e.status === 'active').length,
    coming_soon: engines.filter((e) => e.status === 'coming_soon').length,
    deprecated: engines.filter((e) => e.status === 'deprecated').length,
  };

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines en total</div>
          <div className="cc-mod-stat-v gr">{engines.length}</div>
          <div className="cc-mod-stat-sub">en el catálogo</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Activos</div>
          <div className="cc-mod-stat-v gr">{counts.active}</div>
          <div className="cc-mod-stat-sub">en vivo para tus subscribers</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Próximamente</div>
          <div className="cc-mod-stat-v">{counts.coming_soon}</div>
          <div className="cc-mod-stat-sub">se ven como adelanto, pero todavía no funcionan</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Deprecados</div>
          <div className="cc-mod-stat-v">{counts.deprecated}</div>
          <div className="cc-mod-stat-sub">ya no salen en el catálogo de subscribers</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <p
          style={{
            color: 'var(--cc-txt-3)',
            fontSize: 13,
            maxWidth: '70ch',
            lineHeight: 1.55,
            marginBottom: 16,
          }}
        >
          Administra el catálogo de engines que ven tus subscribers. Cambia el <b>status</b> para
          mover un engine entre <b>Activo</b> (en vivo y visible en /app/engines),{' '}
          <b>Próximamente</b> (se ve como adelanto, pero todavía no funciona) o <b>Deprecado</b> (ya
          no sale en el catálogo). El <b>tier requerido</b> define qué plan necesita el subscriber
          para activarlo.
        </p>

        <div className="cc-mod-list">
          {engines.map((e) => {
            const badge = STATUS_BADGE[e.status] ?? { label: e.status, cls: '' };
            return (
              <div key={e.id} className="cc-mod-row">
                <div className="cc-mod-ic" style={{ fontSize: 18 }}>
                  {e.icon}
                </div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">
                    {e.name}{' '}
                    <span className={`cc-mod-badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="cc-mod-sub">
                    {e.type} · {ENV_LABEL[e.env]} · {e.region}
                    {e.node !== '—' && ` · ${e.node}`}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: 'var(--cc-txt-3)',
                      lineHeight: 1.5,
                      maxWidth: '64ch',
                    }}
                  >
                    {e.description}
                  </div>
                </div>
                <div
                  className="cc-mod-right"
                  style={{
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'flex-end',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span
                      style={{
                        fontFamily: 'var(--cc-mono), monospace',
                        fontSize: 10,
                        color: 'var(--cc-txt-4)',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Status
                    </span>
                    <EngineStatusSelect
                      engineId={e.id}
                      current={e.status}
                      engineName={e.name}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span
                      style={{
                        fontFamily: 'var(--cc-mono), monospace',
                        fontSize: 10,
                        color: 'var(--cc-txt-4)',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Tier
                    </span>
                    <EngineTierSelect
                      engineId={e.id}
                      current={e.tierRequired}
                      engineName={e.name}
                    />
                  </div>
                  {/* Royalty rate — only meaningful when the engine has an
                      owner (PARTNER tier user). We always render it though so
                      the admin can set the rate BEFORE assigning the partner
                      from /dashboard/team. 0 (default) renders as muted. */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span
                      style={{
                        fontFamily: 'var(--cc-mono), monospace',
                        fontSize: 10,
                        color: 'var(--cc-txt-4)',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                      }}
                      title="MXN cents per 1,000,000 tokens consumed in this engine"
                    >
                      Royalty
                    </span>
                    <EngineRoyaltyRateInput
                      engineId={e.id}
                      currentCents={e.partnerRoyaltyPerMillionTokensCents}
                      engineName={e.name}
                    />
                  </div>
                  {/* "Abrir engine" goes to the admin operational detail
                      page — subs count, cost vs revenue, top users, recent
                      activity. The subscriber-view (/app/engines/[slug])
                      is reachable from there via the "Probar como subscriber"
                      button so the admin can still QA the user-facing UI. */}
                  {e.status !== 'deprecated' && (
                    <Link
                      href={`/dashboard/engines/${e.slug}` as Route}
                      style={{
                        marginTop: 2,
                        color: 'var(--cc-green)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      Abrir engine →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p
          style={{
            fontSize: 11.5,
            color: 'var(--cc-txt-4)',
            fontFamily: 'var(--cc-mono), monospace',
            marginTop: 12,
            paddingLeft: 4,
          }}
        >
          ▸ Cada cambio queda guardado en /dashboard/audit con quién lo hizo y el antes/después.
          Por ahora, crear o borrar engines se hace por migration (seed file).
        </p>
      </div>
    </div>
  );
}
