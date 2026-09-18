// /dashboard/settings — "Ajustes". Org, language, timezone, security.
//
// Every control on this page was `disabled` with nothing next to it saying
// why, and the notification "switches" were plain <div>s styled to look like
// toggles — they clicked like a control and did nothing, forever. A disabled
// control with no next step is worse than no control: it reads as broken.
//
// So the page says what it is: a read-only view of the org's configuration,
// with each row pointing at where the thing IS changed today, or naming what
// it would take to make it changeable here.

import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { PLATFORM_TIMEZONE } from '@/lib/billing/money';

export const metadata = { title: 'Ajustes' };

/** A configuration value you cannot change here, and where you can. */
function ReadOnlyRow({
  label,
  value,
  where,
}: {
  label: string;
  value: string;
  /** Where this IS changed, or what is missing for it to be changeable. */
  where: React.ReactNode;
}) {
  return (
    <div className="cc-mod-row">
      <div className="cc-mod-body">
        <div className="cc-mod-name">{label}</div>
        <div className="cc-mod-sub">{where}</div>
      </div>
      <div className="cc-mod-right">
        <b style={{ fontFamily: 'var(--cc-mono), monospace', fontSize: 12 }}>{value}</b>
      </div>
    </div>
  );
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  const meta = session?.user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    session?.user.email?.split('@')[0] ||
    'Operator';
  const email = session?.user.email ?? 'operator@chalyb.com';
  const role = (session?.role ?? 'VIEWER').replace('_', ' ');

  return (
    <div className="cc-scroll">
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Tu cuenta</div>
        <div className="cc-mod-list">
          <ReadOnlyRow
            label="Nombre"
            value={fullName}
            where={
              <>
                Se edita en{' '}
                <Link href={'/app/settings' as Route} style={{ color: 'var(--cc-cyan)' }}>
                  tu perfil de subscriber
                </Link>
                .
              </>
            }
          />
          <ReadOnlyRow
            label="Correo"
            value={email}
            where="El correo es tu identidad de acceso: cambiarlo requiere un flujo de verificación que todavía no existe."
          />
          <ReadOnlyRow
            label="Rol"
            value={role}
            where={
              <>
                Los roles se asignan desde{' '}
                <Link href={'/dashboard/team' as Route} style={{ color: 'var(--cc-cyan)' }}>
                  Personas
                </Link>
                . Nadie puede cambiar el suyo propio.
              </>
            }
          />
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Organización</div>
        <div className="cc-mod-list">
          <ReadOnlyRow
            label="Nombre de la org"
            value="Chalyb"
            where="Hay una sola organización. El día que haya dos, esto se vuelve editable."
          />
          <ReadOnlyRow
            label="Idioma de la interfaz"
            value={locale === 'es' ? 'Español' : 'English'}
            where={
              <>
                Lo decide la URL (<code>/</code> = español, <code>/en</code> = inglés) y tu
                preferencia guardada en{' '}
                <Link href={'/app/settings' as Route} style={{ color: 'var(--cc-cyan)' }}>
                  tu perfil
                </Link>
                .
              </>
            }
          />
          <ReadOnlyRow
            label="Zona horaria de facturación"
            value={PLATFORM_TIMEZONE}
            where="Define qué cuenta como «hoy» en Dinero y en el centro de mando. Está fija en el código (lib/billing/money.ts) para que ninguna pantalla use otra."
          />
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Notificaciones</div>
        <div className="cc-mod-empty-note">
          No conectado — todavía no hay preferencias de notificación por admin.
          <br />
          <small>
            Los avisos del sistema (pagos, cobros rechazados, engines caídos) se escriben siempre y
            se leen en{' '}
            <Link href={'/dashboard/activity' as Route} style={{ color: 'var(--cc-cyan)' }}>
              Actividad
            </Link>
            . Falta la tabla de preferencias y el envío por correo para poder apagarlos por persona.
          </small>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Seguridad</div>
        <div className="cc-mod-list">
          <ReadOnlyRow
            label="Acceso"
            value="Supabase Auth"
            where="Contraseña y sesión se gestionan en tu perfil de subscriber. El acceso al command center está limitado a los roles Admin y Super Admin."
          />
          <ReadOnlyRow
            label="2FA"
            value="no conectado"
            where="El segundo factor todavía no está habilitado en Supabase Auth para esta cuenta. Hasta que lo esté, la pantalla no finge lo contrario."
          />
        </div>
      </div>
    </div>
  );
}
