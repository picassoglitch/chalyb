'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { type Engine, ENV_LABEL, STATE_LABEL } from '@/lib/data/types';

const TABS: Array<{ id: 'metrics' | 'logs' | 'console' | 'ai' | 'autos' | 'api'; label: string }> = [
  { id: 'metrics', label: 'Métricas' },
  { id: 'logs', label: 'Logs' },
  { id: 'console', label: 'Consola' },
  { id: 'ai', label: 'AI / Persona' },
  { id: 'autos', label: 'Automatizaciones' },
  { id: 'api', label: 'API y costos' },
];

function fakeLogs(b: Engine) {
  const lines: Array<[string, string]> = [
    ['c', `worker boot · region ${b.region}`],
    ['', `config loaded · env=${ENV_LABEL[b.env]}`],
    [
      b.stateCode === 'r' ? 'r' : 'g',
      b.stateCode === 'r'
        ? 'FATAL storage quota exceeded'
        : `health check ok (${b.health}%)`,
    ],
    ['', `latency ${b.latencyMs || '—'}ms · node ${b.node}`],
    [
      b.stateCode === 'p' ? 'p' : b.stateCode === 'c' ? 'c' : 'g',
      b.stateCode === 'p'
        ? 'rendering frame batch 12/40'
        : b.stateCode === 'c'
          ? 'training step 4180'
          : 'tick processed',
    ],
    ['a', b.stateCode === 'a' ? 'queue backpressure — 41% load' : 'idle'],
  ];
  return lines;
}

function MetricsTab({ b }: { b: Engine }) {
  return (
    <>
      <div className="cc-dw-grid">
        <div className="cc-dwm">
          <div className="cc-dwm-l">Salud</div>
          <div className="cc-dwm-v">
            {b.health}
            <small>%</small>
          </div>
        </div>
        <div className="cc-dwm">
          <div className="cc-dwm-l">Latencia</div>
          <div className="cc-dwm-v">
            {b.latencyMs || '—'}
            <small>ms</small>
          </div>
        </div>
        <div className="cc-dwm">
          <div className="cc-dwm-l">Ingresos (mes)</div>
          <div className="cc-dwm-v" style={{ color: 'var(--cc-green)' }}>
            {b.revenueCents
              ? '$' + Math.round(b.revenueCents / 100).toLocaleString()
              : '$0'}
          </div>
        </div>
        <div className="cc-dwm">
          <div className="cc-dwm-l">CPU / cola</div>
          <div className="cc-dwm-v">
            {b.stateCode === 'o' ? '—' : `${30 + b.id.length * 4}`}
            <small>%</small>
          </div>
        </div>
        <div className="cc-dwm">
          <div className="cc-dwm-l">Tokens IA hoy</div>
          <div className="cc-dwm-v">
            {b.stateCode === 'o' ? '—' : (b.health * 180).toLocaleString()}
          </div>
        </div>
        <div className="cc-dwm">
          <div className="cc-dwm-l">Costo IA hoy</div>
          <div className="cc-dwm-v">${(b.health * 0.12).toFixed(2)}</div>
        </div>
      </div>
      <div className="cc-dwsec">
        <div className="cc-sl">Estado de salud</div>
        <div style={{ fontSize: 12.5, color: 'var(--cc-txt-2)', lineHeight: 1.6 }}>
          {b.stateCode === 'r'
            ? '🔴 Error crítico — el sistema no procesa trabajos. Revisa los logs.'
            : b.stateCode === 'a'
              ? '🟡 Va lento — la cola está saturada y la latencia subió.'
              : b.stateCode === 'p'
                ? '🟣 Renderizando — el video se está procesando.'
                : b.stateCode === 'c'
                  ? '🔵 Entrenando — actualizando el modelo y la persona.'
                  : b.stateCode === 'o'
                    ? '⚫ Offline — el sistema está detenido.'
                    : '🟢 Todo bien — funcionando con normalidad.'}
        </div>
      </div>
    </>
  );
}

export function DetailDrawer() {
  const router = useRouter();
  const drawerEngineId = useDashboard((s) => s.drawerEngineId);
  const drawerTab = useDashboard((s) => s.drawerTab);
  const setDrawerTab = useDashboard((s) => s.setDrawerTab);
  const closeDrawer = useDashboard((s) => s.closeDrawer);
  const engines = useDashboard((s) => s.engines);
  const showToast = useDashboard((s) => s.showToast);

  const engine = useMemo(
    () => engines.find((e) => e.id === drawerEngineId) ?? null,
    [engines, drawerEngineId],
  );
  if (!engine) return null;
  // Internal name kept as `bot` for the rest of the file because all the JSX
  // already uses b/bot.* — renaming the local would be churn for no gain.
  const bot = engine;
  const lbl = STATE_LABEL[bot.stateCode];

  return (
    <div className="cc-dwov" onClick={(e) => e.target === e.currentTarget && closeDrawer()}>
      <div className="cc-drawer">
        <div className="cc-dw-h">
          <div className="cc-di">{bot.icon}</div>
          <div className="cc-dt">
            <h2>
              {bot.name}{' '}
              <span
                className={`cc-led ${bot.stateCode}${bot.stateCode !== 'o' ? ' pulse' : ''}`}
                style={{ width: 9, height: 9 }}
              />
            </h2>
            <div className="cc-de">
              {bot.stateCode === 'o' ? (
                'Offline'
              ) : (
                <>
                  <b>{ENV_LABEL[bot.env]}</b> · {bot.region} · {bot.node} · {bot.latencyMs}ms · {lbl}
                </>
              )}
            </div>
          </div>
          <button type="button" className="cc-dx" onClick={closeDrawer}>
            ✕
          </button>
        </div>
        <div className="cc-dw-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={drawerTab === t.id ? 'on' : ''}
              onClick={() => setDrawerTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="cc-dw-body">
          {drawerTab === 'metrics' && <MetricsTab b={bot} />}

          {drawerTab === 'logs' && (
            <div className="cc-dwsec">
              <div className="cc-sl">Logs en vivo · {bot.node}</div>
              <div className="cc-logbox">
                {fakeLogs(bot).map(([c, m], i) => (
                  <div key={i} className={`cc-ll ${c}`}>
                    <span className="cc-tm">{new Date().toTimeString().slice(0, 8)}</span>{' '}
                    <span className="cc-ms">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drawerTab === 'console' && (
            <div className="cc-dwsec">
              <div className="cc-sl">Consola</div>
              <div className="cc-logbox">
                <div className="cc-ll">
                  <span className="cc-tm">chalyb@{bot.slug}</span>{' '}
                  <span className="cc-ms">$ _</span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 11,
                  color: 'var(--cc-txt-4)',
                  fontSize: 11.5,
                  fontFamily: 'var(--cc-mono), monospace',
                }}
              >
                Consola interactiva — se conecta al worker real cuando lo activemos.
              </div>
            </div>
          )}

          {drawerTab === 'ai' && (
            <div className="cc-dwsec">
              <div className="cc-sl">Identidad y memoria del bot</div>
              {bot.persona ? (
                <div className="cc-persona">
                  {(
                    [
                      ['Persona', bot.persona.persona],
                      ['Tono', bot.persona.tone],
                      ['Metas', bot.persona.goals],
                      ['Foco', bot.persona.focus],
                      ['Estado', bot.persona.learningState],
                      ['Score', String(bot.persona.engagementScore)],
                    ] as Array<[string, string]>
                  ).map(([k, v]) => (
                    <div key={k} className="cc-prow">
                      <div className="cc-pl">{k}</div>
                      <div className="cc-pv">
                        {v}
                        {k === 'Score' && (
                          <div className="cc-gauge">
                            <i style={{ width: `${bot.persona!.engagementScore}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    color: 'var(--cc-txt-4)',
                    fontSize: 12,
                    fontFamily: 'var(--cc-mono), monospace',
                  }}
                >
                  Este sistema no usa una capa de persona.
                </div>
              )}
            </div>
          )}

          {drawerTab === 'autos' && (
            <div className="cc-dwsec">
              <div className="cc-sl">Automatizaciones vinculadas</div>
              <div className="cc-persona">
                <div className="cc-prow">
                  <div className="cc-pl">Si hay error</div>
                  <div className="cc-pv">Avisar y reintentar 3×</div>
                </div>
                <div className="cc-prow">
                  <div className="cc-pl">Cada cuánto</div>
                  <div className="cc-pv">Cada 15 min · cron activo</div>
                </div>
                <div className="cc-prow">
                  <div className="cc-pl">Si hay ingresos</div>
                  <div className="cc-pv">Webhook → panel de ingresos</div>
                </div>
              </div>
            </div>
          )}

          {drawerTab === 'api' && (
            <div className="cc-dwsec">
              <div className="cc-sl">API keys y costos</div>
              <div className="cc-persona">
                <div className="cc-prow">
                  <div className="cc-pl">Proveedor</div>
                  <div className="cc-pv">Anthropic principal · OpenAI de respaldo</div>
                </div>
                <div className="cc-prow">
                  <div className="cc-pl">Key</div>
                  <div className="cc-pv">sk-chalyb-••••••••{bot.slug.slice(0, 4)}</div>
                </div>
                <div className="cc-prow">
                  <div className="cc-pl">Costo 30 días</div>
                  <div className="cc-pv">${(bot.health * 3.4).toFixed(2)}</div>
                </div>
                <div className="cc-prow">
                  <div className="cc-pl">Límite de uso</div>
                  <div className="cc-pv">
                    {bot.stateCode === 'r' ? '🔴 Excedido' : '🟢 OK · 12% usado'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="cc-dw-foot">
          {/* Primary action: navigate to the engine workspace. The workspace
              page handles tier-aware rendering (live vs simulation vs upgrade
              gate) so we don't duplicate that logic here. */}
          <button
            type="button"
            className="cc-b go"
            onClick={() => {
              closeDrawer();
              router.push(`/app/engines/${bot.slug}` as never);
            }}
          >
            {bot.stateCode === 'o' ? 'Iniciar sistema →' : 'Abrir consola →'}
          </button>
          {/* Secondary action: simulated restart. Real worker restart hooks in
              when the engine workers are deployed and expose an admin API. For
              now this is a clear placeholder so the button isn't a dead end. */}
          <button
            type="button"
            className="cc-b gh"
            onClick={() => {
              if (
                !confirm(
                  `¿Reiniciar el worker de ${bot.name}?\n\n` +
                    'Quedará en cola y se ejecutará en cuanto los workers estén activos.',
                )
              ) {
                return;
              }
              showToast(
                `Reinicio de <b>${bot.name}</b> en cola · falta conectar los workers.`,
              );
            }}
          >
            Reiniciar worker
          </button>
        </div>
      </div>
    </div>
  );
}
