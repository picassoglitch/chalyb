import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { HelpFaq } from '@/components/workspace/help-faq';
import { listEngines } from '@/lib/data/engines';
import { engineIsRunnable } from '@/lib/billing/readiness';

export const metadata = { title: 'Ayuda' };

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The status tile reads the real fleet, the same way Inicio and Mis engines
  // do — never a hardcoded "todos los sistemas en línea".
  const engines = await listEngines().catch(() => []);
  const catalog = engines.filter((e) => e.status !== 'deprecated');
  const ready = catalog.filter((e) => engineIsRunnable(e)).length;
  const upcoming = catalog.length - ready;

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Estado del kit</div>
          <div className={`cc-mod-stat-v ${ready > 0 ? 'gr' : 'am'}`}>
            {ready}
            <small>listas</small>
          </div>
          <div className="cc-mod-stat-sub">
            {upcoming > 0 ? `${upcoming} próximamente · en construcción` : 'todo el kit publicado'}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tiempo de respuesta</div>
          <div className="cc-mod-stat-v">
            &lt; 24<small>hrs hábiles</small>
          </div>
          <div className="cc-mod-stat-sub">vía Mensajes o /contacto</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <p
          style={{
            color: 'var(--cc-txt-3)',
            fontSize: 13.5,
            maxWidth: '64ch',
            lineHeight: 1.55,
          }}
        >
          Lo que casi todos preguntan en sus primeros días con el kit. Si tu duda no está aquí,
          escríbenos directo y te contestamos rápido.
        </p>
      </div>

      <HelpFaq />

      <div className="cc-mod-section">
        <div className="cc-mod-sl">¿No encontraste lo que buscabas?</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            padding: '20px 22px',
            border: '1px solid var(--cc-line-2)',
            background: 'var(--cc-panel)',
            borderRadius: 'var(--cc-r-l)',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Escríbenos directamente
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--cc-txt-3)' }}>
              Te responde una persona real en menos de 24 horas hábiles. Sin tickets, sin bots.
            </div>
          </div>
          <Link
            href={'/app/messages' as Route}
            style={{
              background: 'var(--cc-green)',
              color: '#070809',
              padding: '11px 18px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              alignSelf: 'center',
            }}
          >
            Abrir Mensajes →
          </Link>
        </div>
      </div>
    </div>
  );
}
