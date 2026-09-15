'use client';

import { useState } from 'react';

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

interface FaqGroup {
  title: string;
  items: FaqItem[];
}

// Every answer describes a control that exists on the page it names, in the
// state it names. "Activar en vivo" appears only on engines marked Listo; an
// engine marked Próximamente has nothing to activate, and the FAQ says so.
const FAQ: FaqGroup[] = [
  {
    title: 'Tu kit y tus planes',
    items: [
      {
        q: '¿Qué es Chalyb exactamente?',
        a: (
          <>
            Un kit de herramientas de IA en <b>una sola suscripción</b>: ChalyClip, ChalyCrypto,
            ChalyOBS y las demás son herramientas internas del kit, no productos aparte. Viniste por
            una; las otras van incluidas en tu plan en cuanto están listas.
          </>
        ),
      },
      {
        q: '¿Cuál es la diferencia entre Free, Pro y VIP?',
        a: (
          <>
            <b>Free</b> explora el kit en simulación, sin tarjeta. <b>Pro</b> enciende <b>una</b>{' '}
            herramienta en vivo, la que tú elijas, y la cambias cuando quieras. <b>VIP</b> abre el
            kit completo en vivo con los límites más altos. Los tokens IA van incluidos en cada
            plan, pero el plan se trata de las herramientas, no de los tokens.
          </>
        ),
      },
      {
        q: '¿Cómo cambio mi plan?',
        a: (
          <>
            Desde <b>/app/subscription</b>, elige la tarjeta del plan. Si subes (Free → Pro o Pro →
            VIP), pagas con tarjeta a través de Mercado Pago dentro de la app. Si bajas a Free, no
            se te cobra nada y conservas el plan anterior hasta que termine el período que ya
            pagaste. Si los pagos aún no están habilitados, la página lo dice y no se inicia ningún
            cobro.
          </>
        ),
      },
      {
        q: '¿Puedo cancelar en cualquier momento?',
        a: (
          <>
            Sí. En <b>/app/subscription</b>, abajo de las tarjetas, está «Cancelar suscripción».
            Detiene la renovación; conservas tu plan hasta el final del período pagado y ese día
            pasas a Free. Sin cargos adicionales.
          </>
        ),
      },
      {
        q: 'Mi plan dice «cortesía». ¿Qué significa?',
        a: (
          <>
            Que el equipo Chalyb te asignó ese plan sin cobro (por ejemplo, para una prueba). No hay
            renovación ni pagos detrás, y así lo muestran Suscripción y Facturación. Cuando quieras
            un plan pagado, lo activas desde <b>/app/subscription</b>.
          </>
        ),
      },
    ],
  },
  {
    title: 'Herramientas: Listo, En vivo, Simulación y Próximamente',
    items: [
      {
        q: '¿Qué significa cada estado?',
        a: (
          <>
            <b>Próximamente</b> o <b>En construcción</b>: la herramienta aún no se puede abrir; no
            hay nada que activar. <b>Listo</b>: se puede abrir hoy y tu plan permite ponerla en
            vivo. <b>Simulación</b>: se puede abrir con datos de prueba, sin tocar tus cuentas.{' '}
            <b>En vivo</b>: corre con tus credenciales reales. Inicio, Mis engines y la página de
            cada herramienta muestran siempre el mismo estado.
          </>
        ),
      },
      {
        q: 'En Pro, ¿cómo elijo o cambio la herramienta que corre en vivo?',
        a: (
          <>
            Solo en herramientas marcadas <b>Listo</b>: en su tarjeta de <b>/app/engines</b> y en su
            página aparece el botón <b>Activar en vivo</b>. La que estaba en vivo vuelve a
            simulación automáticamente. Si una herramienta dice Próximamente, ese botón no existe
            todavía porque no hay nada que encender.
          </>
        ),
      },
      {
        q: '¿Por qué veo todo como Próximamente?',
        a: (
          <>
            Porque el kit está en construcción: los backends de las herramientas se están publicando
            de nuevo. Tu plan ya está listo y no pierde nada; cada herramienta aparece como Listo en
            cuanto se publica. No mostramos nada como «en vivo» hasta que de verdad se pueda abrir.
          </>
        ),
      },
      {
        q: '¿Qué es modo simulación?',
        a: (
          <>
            La herramienta corre con datos de prueba y no toca tus cuentas externas (exchanges,
            redes sociales, etc.). Sirve para evaluar sin riesgo. <b>En vivo</b> conecta tus
            credenciales y actúa sobre tus datos: disponible en Pro (una herramienta) y VIP (todo el
            kit).
          </>
        ),
      },
    ],
  },
  {
    title: 'Cuenta y seguridad',
    items: [
      {
        q: '¿Cómo cambio mi contraseña o mi idioma?',
        a: (
          <>
            Desde <b>/app/settings</b>. El cambio de idioma se guarda sin cerrar tu sesión. La
            verificación en dos pasos (2FA) aún no está disponible; la anunciaremos ahí mismo cuando
            lo esté.
          </>
        ),
      },
      {
        q: '¿Pueden ver mis datos los administradores de Chalyb?',
        a: (
          <>
            Los roles <b>ADMIN</b> y <b>SUPER_ADMIN</b> ven tu perfil, tu plan y tu uso agregado
            para poder darte soporte. No acceden a lo que tus herramientas generan sin tu permiso
            explícito.
          </>
        ),
      },
      {
        q: '¿Cómo cierro mi cuenta?',
        a: (
          <>
            Cancela primero tu suscripción desde <b>/app/subscription</b> (te deja en Free) y luego
            escríbenos por <b>/app/messages</b> o <b>/contacto</b> pidiendo el borrado. Eliminamos
            tu perfil, tus ejecuciones y tus pagos en menos de 7 días.
          </>
        ),
      },
    ],
  },
  {
    title: 'Facturación',
    items: [
      {
        q: '¿Aceptan factura fiscal?',
        a: (
          <>
            Sí, para clientes en México emitimos CFDI 4.0. Después de tu primer pago en Pro o VIP,
            escríbenos vía <b>/contacto</b> con tu RFC y razón social y la generamos en los
            siguientes 3 días hábiles. Para otros países, factura estándar en PDF.
          </>
        ),
      },
      {
        q: '¿Qué métodos de pago aceptan?',
        a: (
          <>
            Pro y VIP se cobran con tarjeta de crédito o débito a través de Mercado Pago, cada mes,
            hasta que canceles. Los paquetes de tokens se pagan una sola vez por el mismo medio.
          </>
        ),
      },
      {
        q: '¿Reembolsos?',
        a: (
          <>
            Te devolvemos el 100% si lo pides dentro de los primeros 7 días del primer cobro de
            cualquier plan. Para cobros posteriores no hay reembolso, pero cancelas cuando quieras y
            no se te cobra el siguiente ciclo.
          </>
        ),
      },
    ],
  },
];

export function HelpFaq() {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      {FAQ.map((group, gi) => (
        <div key={group.title} className="cc-mod-section">
          <div className="cc-mod-sl">{group.title}</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--cc-line)',
              borderRadius: 'var(--cc-r-l)',
              overflow: 'hidden',
            }}
          >
            {group.items.map((item, ii) => {
              const key = `${gi}-${ii}`;
              const isOpen = open.has(key);
              return (
                <div
                  key={key}
                  style={{
                    borderBottom:
                      ii < group.items.length - 1 ? '1px solid var(--cc-line-soft)' : 'none',
                    background: 'var(--cc-panel)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '16px 20px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--cc-txt)',
                      fontFamily: 'inherit',
                      fontSize: 13.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--cc-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--cc-mono), monospace',
                        fontSize: 11,
                        color: isOpen ? 'var(--cc-green)' : 'var(--cc-txt-4)',
                        flexShrink: 0,
                        width: 16,
                        transition: 'transform 0.2s, color 0.2s',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0)',
                      }}
                    >
                      ▸
                    </span>
                    <span style={{ flex: 1 }}>{item.q}</span>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: '0 22px 18px 50px',
                        fontSize: 13,
                        color: 'var(--cc-txt-3)',
                        lineHeight: 1.6,
                      }}
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
