import { setRequestLocale } from 'next-intl/server';
import { formatCompact, formatUsdMicros, getModelUsage } from '@/lib/data/ops';

export const metadata = { title: 'Modelos y medidores' };

// Native-unit suffix per meter kind. New kinds fall back to the raw kind
// string — migration 0020 dropped the kind whitelist on purpose.
const KIND_UNIT: Record<string, string> = {
  'llm.tokens': 'tokens',
  'transcription.seconds': 'seg',
  'storage.mb': 'MB',
  'publish.count': 'publicaciones',
};

export default async function ModelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const providers = await getModelUsage();

  return (
    <div className="cc-scroll">
      {providers.length === 0 ? (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Proveedores</div>
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
            Aún no hay uso de modelos en los últimos 30 días.
            <br />
            <span
              style={{
                color: 'var(--cc-txt-4)',
                fontSize: 12,
                fontFamily: 'var(--cc-mono), monospace',
                marginTop: 6,
                display: 'inline-block',
              }}
            >
              En cuanto tus engines empiecen a trabajar, vas a ver aquí cuánto consumen, agrupado por proveedor.
            </span>
          </div>
        </div>
      ) : (
        providers.map((p) => (
          <div key={p.provider} className="cc-mod-section">
            <div className="cc-mod-sl">
              {p.provider} · {p.events.toLocaleString('es-MX')} eventos 30d ·{' '}
              {formatUsdMicros(p.costUsdMicros)}
            </div>
            <div className="cc-mod-list">
              {p.meters.map((m) => (
                <div key={`${m.kind}-${m.operation ?? ''}`} className="cc-mod-row">
                  <div className="cc-mod-ic">◈</div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {m.kind}
                      {m.operation && <span className="cc-mod-badge cy">{m.operation}</span>}
                    </div>
                    <div className="cc-mod-sub">
                      {formatCompact(m.amount)} {KIND_UNIT[m.kind] ?? 'unidades'} ·{' '}
                      {formatUsdMicros(m.costUsdMicros)} de costo del proveedor
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b>{m.events.toLocaleString('es-MX')}</b>
                    <span>eventos 30d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
