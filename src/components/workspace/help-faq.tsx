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
            <b>Free</b> te deja probar todos los sistemas en modo simulación, sin tarjeta de
            crédito. <b>Pro</b> activa <b>UN</b> sistema en ejecución real — tú eliges cuál
            desde tu lista de bots. <b>VIP</b> activa los 16 sistemas en vivo y te da los
            límites de uso más altos. El admin puede cambiarte de plan desde su panel sin pasar
            por la página de pago.
          </>
        ),
      },
      {
        q: '¿Cómo cambio mi plan?',
        a: (
          <>
            Desde <b>/app/subscription</b>, haz clic en el botón del plan al que quieres
            cambiar. Si subes (Free → Pro o Pro → VIP), te redirigimos a Mercado Pago
            para procesar el pago. Si bajas a Free, el cambio se aplica inmediato sin cargo. Tu
            plan anterior sigue activo hasta el final del período facturado.
          </>
        ),
      },
      {
        q: '¿Puedo cancelar en cualquier momento?',
        a: (
          <>
            Sí. Desde <b>/app/subscription</b>, abajo de las tarjetas de plan hay un botón
            &laquo;Cancelar suscripción&raquo;. Mantienes tu plan vigente hasta el final del
            período que ya pagaste; después bajas automáticamente a Free. No te cobramos nada
            adicional.
          </>
        ),
      },
      {
        q: '¿Por qué no veo cambios después de pagar?',
        a: (
          <>
            Mercado Pago confirma el pago en segundos a minutos. Tu plan se activa
            automáticamente vía webhook cuando MP nos notifica. Revisa <b>/app/billing</b> para
            ver el estado del pago — si dice <b>Aprobado</b>, tu tier ya está activo. Si dice{' '}
            <b>Pendiente</b> y pagaste en efectivo (OXXO, ticket), espera a que el comercio
            procese.
          </>
        ),
      },
    ],
  },
  {
    title: 'Sistemas y ejecución',
    items: [
      {
        q: 'En Pro, ¿puedo cambiar cuál sistema corre en vivo?',
        a: (
          <>
            Sí, cuantas veces quieras. Ve a <b>/app/engines</b> y haz clic en{' '}
            <b>Activar en vivo</b> en el sistema que prefieras. El sistema que estaba en vivo
            antes vuelve automáticamente a simulación. No hay penalización por cambiar.
          </>
        ),
      },
      {
        q: '¿Qué hace cada sistema?',
        a: (
          <>
            Cada uno está descrito en <b>/app/engines</b>: lee la categoría y descripción debajo
            del nombre. Para una explicación más a fondo con ejemplos reales, escríbenos a
            través de <b>/contacto</b> y te mandamos un resumen.
          </>
        ),
      },
      {
        q: '¿Qué es modo simulación?',
        a: (
          <>
            En simulación, el sistema corre con datos de prueba y no toca tus cuentas externas
            (Stripe, exchanges, redes sociales, etc.). Sirve para evaluar comportamiento y
            límites sin riesgo. <b>Ejecución real</b> conecta al sistema con tus credenciales y
            actúa sobre tus datos — solo disponible en Pro y VIP.
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
            Desde <b>/app/settings</b> &raquo; sección Seguridad &raquo; Activar 2FA. Recomendamos
            usar una app como Authy o 1Password en vez de SMS. Si pierdes acceso al
            authenticator, escríbenos a través de <b>/contacto</b> y validamos tu identidad
            manualmente.
          </>
        ),
      },
      {
        q: '¿Pueden ver mis datos los administradores de Chalyb?',
        a: (
          <>
            Solo el rol <b>SUPER_ADMIN</b> de tu organización puede ver tu perfil y tu uso
            general. El equipo de Chalyb no accede a los datos de tu operación (lo que tus sistemas
            generan). Para soporte técnico, te pedimos permiso explícito antes de revisar
            los registros.
          </>
        ),
      },
      {
        q: '¿Cómo cierro mi cuenta?',
        a: (
          <>
            Cancela primero tu suscripción desde <b>/app/subscription</b> (te deja en Free) y
            luego escríbenos a <b>/contacto</b> pidiendo el borrado de cuenta. Eliminamos
            tu perfil, tus ejecuciones y tus pagos en menos de 7 días, conforme a tu derecho a
            la portabilidad de datos.
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
            Sí, para clientes en México emitimos CFDI 4.0. Después de tu primer pago en Pro o
            VIP, escríbenos vía <b>/contacto</b> con tu RFC + razón social y la generamos
            dentro de los siguientes 3 días hábiles. Para otros países, emitimos una factura
            estándar en PDF.
          </>
        ),
      },
      {
        q: '¿Qué métodos de pago aceptan?',
        a: (
          <>
            Todos los que Mercado Pago soporta en tu país: tarjeta de crédito/débito,
            transferencia, OXXO/ticket (México), Rapipago/Pago Fácil (Argentina), y más.
            Mercado Pago muestra las opciones disponibles según tu ubicación al momento de
            pagar.
          </>
        ),
      },
      {
        q: '¿Reembolsos?',
        a: (
          <>
            Te devolvemos el 100% si pides reembolso dentro de los primeros 7 días del primer
            cobro de cualquier plan. Para cobros posteriores, no hay reembolso pero cancelas
            cuando quieras y dejas de ser facturado en el próximo ciclo.
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
                    borderBottom: ii < group.items.length - 1 ? '1px solid var(--cc-line-soft)' : 'none',
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
