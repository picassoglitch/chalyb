import { setRequestLocale } from 'next-intl/server';
import { formatUsdMicros, getProviderUsage } from '@/lib/data/ops';

export const metadata = { title: 'API e integraciones' };

// Real integrations the codebase actually talks to, detected from the env
// vars each client module reads. We only surface configured/not-configured —
// never key material (this page is server-rendered for admins, but there's
// no reason to put even masked secrets in HTML).
const INTEGRATIONS: Array<{ name: string; detail: string; envKeys: string[][] }> = [
  // envKeys: outer array = AND groups, inner array = any-of alternatives.
  { name: 'Supabase', detail: 'DB · auth · RLS', envKeys: [['NEXT_PUBLIC_SUPABASE_URL'], ['SUPABASE_SERVICE_ROLE_KEY']] },
  { name: 'Mercado Pago', detail: 'pagos · webhooks', envKeys: [['MERCADOPAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN']] },
  { name: 'Resend', detail: 'email transaccional', envKeys: [['RESEND_API_KEY']] },
  { name: 'Anthropic (admin)', detail: 'billing/costos Claude', envKeys: [['ANTHROPIC_ADMIN_KEY']] },
  { name: 'ChalybClip', detail: 'engine · SSO + admin API', envKeys: [['CHALYBCLIP_ADMIN_TOKEN'], ['CHALYBCLIP_SSO_SECRET']] },
  { name: 'ChalybCrypto', detail: 'engine · SSO + admin API', envKeys: [['CHALYBCRYPTO_ADMIN_TOKEN'], ['CHALYBCRYPTO_SSO_SECRET']] },
  { name: 'ChalybOBS', detail: 'engine · SSO + admin API', envKeys: [['CHALYBOBS_ADMIN_TOKEN'], ['CHALYBOBS_SSO_SECRET']] },
];

function isConfigured(envKeys: string[][]): boolean {
  return envKeys.every((group) => group.some((key) => Boolean(process.env[key])));
}

export default async function ApiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const providers = await getProviderUsage();
  const configured = INTEGRATIONS.map((i) => ({ ...i, ok: isConfigured(i.envKeys) }));
  const configuredCount = configured.filter((i) => i.ok).length;
  const cost30d = providers.reduce((s, p) => s + p.costUsdMicros30d, 0);
  const events24h = providers.reduce((s, p) => s + p.events24h, 0);

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Integraciones configuradas</div>
          <div className="cc-mod-stat-v">
            {configuredCount}
            <small>/ {configured.length}</small>
          </div>
          <div className="cc-mod-stat-sub">detectadas en tus variables de entorno</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Costo de proveedores (30 días)</div>
          <div className="cc-mod-stat-v am">{formatUsdMicros(cost30d)}</div>
          <div className="cc-mod-stat-sub">lo que reportan tus engines</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Eventos (últimas 24 h)</div>
          <div className="cc-mod-stat-v cy">{events24h.toLocaleString('es-MX')}</div>
          <div className="cc-mod-stat-sub">entran por /api/engines/[slug]/usage</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Integraciones</div>
        <div className="cc-mod-list">
          {configured.map((i) => (
            <div key={i.name} className="cc-mod-row">
              <div className="cc-mod-ic">⌘</div>
              <div className="cc-mod-body">
                <div className="cc-mod-name">
                  {i.name}{' '}
                  <span className={`cc-mod-badge ${i.ok ? 'gr' : 'am'}`}>
                    {i.ok ? 'Lista' : 'Falta configurar'}
                  </span>
                </div>
                <div className="cc-mod-sub">{i.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Consumo por proveedor (30 días)</div>
        {providers.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
            }}
          >
            Todavía ningún engine reportó consumo de proveedores en este periodo.
          </div>
        ) : (
          <div className="cc-mod-list">
            {providers.map((p) => (
              <div key={p.provider} className="cc-mod-row">
                <div className="cc-mod-ic">◈</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">{p.provider}</div>
                  <div className="cc-mod-sub">
                    {p.events30d.toLocaleString('es-MX')} eventos en 30 días ·{' '}
                    {p.events24h.toLocaleString('es-MX')} en las últimas 24 h
                  </div>
                </div>
                <div className="cc-mod-right">
                  <b>{formatUsdMicros(p.costUsdMicros30d)}</b>
                  <span>30 días</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
