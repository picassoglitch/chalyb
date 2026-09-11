import { setRequestLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
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

  return (
    <div className="cc-scroll">
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Tu cuenta</div>
        <div className="cc-mod-form">
          <div className="cc-mod-field">
            <label>Nombre</label>
            <input type="text" defaultValue={fullName} disabled />
          </div>
          <div className="cc-mod-field">
            <label>Correo</label>
            <input type="email" defaultValue={email} disabled />
          </div>
          <div className="cc-mod-field">
            <label>Rol</label>
            <input
              type="text"
              defaultValue={(session?.role ?? 'VIEWER').replace('_', ' ')}
              disabled
            />
          </div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Organización</div>
        <div className="cc-mod-form">
          <div className="cc-mod-field">
            <label>Nombre de la org</label>
            <input type="text" defaultValue="Chalyb (demo)" disabled />
          </div>
          <div className="cc-mod-field">
            <label>Idioma principal</label>
            <select defaultValue={locale} disabled>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div className="cc-mod-field">
            <label>Zona horaria</label>
            <select defaultValue="America/Mexico_City" disabled>
              <option>America/Mexico_City</option>
              <option>America/New_York</option>
              <option>America/Los_Angeles</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Notificaciones</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">Errores críticos</span>
              <span className="s">Te avisamos por correo y push apenas se cae un sistema.</span>
            </div>
            <div className="cc-mod-switch on" />
          </div>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">Resumen diario</span>
              <span className="s">Cada día a las 09:00 te llega lo del día anterior: ingresos, jobs y errores.</span>
            </div>
            <div className="cc-mod-switch on" />
          </div>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">Eventos de marketing</span>
              <span className="s">Cuando una publicación se vuelve viral o el engagement se dispara.</span>
            </div>
            <div className="cc-mod-switch" />
          </div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Seguridad</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">2FA con app autenticadora</span>
              <span className="s">El código TOTP es obligatorio para los roles Admin y Super Admin.</span>
            </div>
            <div className="cc-mod-switch on" />
          </div>
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">Sesiones activas</span>
              <span className="s">1 sesión · este navegador</span>
            </div>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: '1px solid var(--cc-line-2)',
                color: 'var(--cc-txt-2)',
                padding: '7px 12px',
                borderRadius: 7,
                fontFamily: 'inherit',
                fontSize: 12,
                cursor: 'pointer',
              }}
              disabled
            >
              Cerrar las demás
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
