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

const FAQ: FaqGroup[] = [
  {
    title: 'Suscripción y planes',
    items: [
      {
        q: '¿Cuál es la diferencia entre Free, Pro y VIP?',
        a: (
          <>
            <b>Free</b> incluye Clips, sin tarjeta de crédito. <b>Pro</b> incluye una herramienta a
            tu elección. <b>VIP</b> incluye todas las herramientas y los límites de uso más altos.
          </>
        ),
      },
      {
        q: '¿Cómo cambio mi plan?',
        a: (
          <>
            Desde <b>Suscripción</b>, haz clic en el botón del plan al que quieres cambiar. Si subes
            (Free → Pro o Pro → VIP), te llevamos a Mercado Pago para el pago. Si bajas a Free, no
            se te cobra nada y conservas el plan anterior hasta que termine el período que ya
            pagaste.
          </>
        ),
      },
      {
        q: '¿Puedo cancelar en cualquier momento?',
        a: (
          <>
            Sí. En <b>Suscripción</b>, abajo de las tarjetas de plan, está el botón &laquo;Cancelar
            suscripción&raquo;. La cancelación detiene la renovación y conservas tu plan hasta que
            termine el período que ya pagaste; ese día bajas automáticamente a Free. No te cobramos
            nada adicional.
          </>
        ),
      },
      {
        q: '¿Por qué no veo cambios después de pagar?',
        a: (
          <>
            Mercado Pago confirma el pago en segundos o minutos, y tu plan se activa solo en cuanto
            nos avisa. En <b>Facturación</b> ves el estado del pago: si dice <b>Aprobado</b>, tu
            plan ya está activo. Si dice <b>Pendiente</b> y pagaste en efectivo (OXXO), espera a que
            el comercio lo procese.
          </>
        ),
      },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      {
        q: 'En Pro, ¿puedo cambiar de herramienta?',
        a: (
          <>
            Sí, cuantas veces quieras. En <b>Herramientas</b>, elige la que prefieras. No hay
            penalización por cambiar.
          </>
        ),
      },
      {
        q: '¿Qué hace cada herramienta?',
        a: (
          <>
            Cada una tiene su descripción en <b>Herramientas</b>. Si quieres una explicación con
            ejemplos, escríbenos desde <b>Contacto</b> y te respondemos.
          </>
        ),
      },
    ],
  },
  {
    title: 'Cuenta y seguridad',
    items: [
      {
        q: '¿Cómo activo autenticación de dos factores (2FA)?',
        a: (
          <>
            Desde <b>Perfil &amp; seguridad</b> &raquo; sección Seguridad &raquo; Activar 2FA.
            Recomendamos usar una app como Authy o 1Password en vez de SMS. Si pierdes acceso al
            authenticator, escríbenos a través de <b>/contacto</b> y validamos tu identidad
            manualmente.
          </>
        ),
      },
      {
        q: '¿Pueden ver mis datos los administradores de Chalyb?',
        a: (
          <>
            Solo el rol <b>SUPER_ADMIN</b> de tu organización puede ver tu perfil y tu uso general.
            El equipo de Chalyb no accede a los datos de tu operación (lo que tus sistemas generan).
            Para soporte técnico, te pedimos permiso explícito antes de revisar los registros.
          </>
        ),
      },
      {
        q: '¿Cómo cierro mi cuenta?',
        a: (
          <>
            Cancela primero tu suscripción desde <b>Suscripción</b> (te deja en Free) y luego
            escríbenos a <b>/contacto</b> pidiendo el borrado de cuenta. Eliminamos tu perfil, tus
            ejecuciones y tus pagos en menos de 7 días, conforme a tu derecho a la portabilidad de
            datos.
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
            escríbenos vía <b>/contacto</b> con tu RFC + razón social y la generamos dentro de los
            siguientes 3 días hábiles. Para otros países, emitimos una factura estándar en PDF.
          </>
        ),
      },
      {
        q: '¿Qué métodos de pago aceptan?',
        a: (
          <>
            Todos los que Mercado Pago soporta en tu país: tarjeta de crédito/débito, transferencia,
            OXXO/ticket (México), Rapipago/Pago Fácil (Argentina), y más. Mercado Pago muestra las
            opciones disponibles según tu ubicación al momento de pagar.
          </>
        ),
      },
      {
        q: '¿Reembolsos?',
        a: (
          <>
            Te devolvemos el 100% si pides reembolso dentro de los primeros 7 días del primer cobro
            de cualquier plan. Para cobros posteriores, no hay reembolso pero cancelas cuando
            quieras y dejas de ser facturado en el próximo ciclo.
          </>
        ),
      },
    ],
  },
];

export function HelpFaq() {
  // Track open state by `${groupIdx}-${itemIdx}` — flat keys avoid nested state.
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
