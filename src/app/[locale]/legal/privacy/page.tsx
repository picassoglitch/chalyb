import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth/session';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata = {
  title: 'Aviso de privacidad',
  description:
    'Cómo Chalyb recopila, usa y protege tus datos personales. Cumplimiento con LFPDPPP (México).',
};

// force-dynamic so Vercel's CDN never serves a stale 404 from before the
// route existed. The page is cheap (no DB, just getCurrentUser for nav
// state), so per-request rendering has no real cost.
export const dynamic = 'force-dynamic';

const LAST_UPDATED = '17 junio 2026';

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  return (
    <LegalPage
      title="Aviso de privacidad"
      lastUpdated={LAST_UPDATED}
      isAuthenticated={user !== null}
    >
      <div className="legal-toc">
        <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          Contenido
        </strong>
        <ol>
          <li><a href="#responsable">Responsable del tratamiento</a></li>
          <li><a href="#datos">Datos que recopilamos</a></li>
          <li><a href="#finalidades">Finalidades del tratamiento</a></li>
          <li><a href="#terceros">Terceros con los que compartimos datos</a></li>
          <li><a href="#engines">Datos enviados a los Engines</a></li>
          <li><a href="#cookies">Cookies y tecnologías similares</a></li>
          <li><a href="#retencion">Retención de datos</a></li>
          <li><a href="#derechos">Tus derechos ARCO</a></li>
          <li><a href="#transferencias">Transferencias internacionales</a></li>
          <li><a href="#seguridad">Medidas de seguridad</a></li>
          <li><a href="#menores">Menores de edad</a></li>
          <li><a href="#cambios">Cambios al aviso</a></li>
          <li><a href="#contacto">Contacto</a></li>
        </ol>
      </div>

      <p>
        Este aviso de privacidad describe cómo <strong>Chalyb</strong> recopila,
        usa, almacena y protege tus datos personales, en cumplimiento con la{' '}
        <strong>Ley Federal de Protección de Datos Personales en Posesión de los
        Particulares (LFPDPPP)</strong>, su Reglamento, y los Lineamientos del INAI.
      </p>

      <h2 id="responsable">1. Responsable del tratamiento</h2>
      <p>
        <strong>Chalyb</strong>, con sede operativa en México, es el responsable
        del tratamiento de tus datos personales. Para ejercer cualquier derecho o
        hacer preguntas sobre este aviso, escríbenos a través de{' '}
        <Link href={'/contacto' as Route}>/contacto</Link>.
      </p>

      <h2 id="datos">2. Datos que recopilamos</h2>
      <p>Recopilamos los datos estrictamente necesarios para operar el servicio:</p>

      <h3>2.1. Datos de cuenta</h3>
      <ul>
        <li>Nombre completo</li>
        <li>Correo electrónico</li>
        <li>Foto de perfil (si te registras con Google)</li>
        <li>
          Contraseña hasheada con bcrypt — nunca almacenamos el texto plano
        </li>
      </ul>

      <h3>2.2. Datos de pago</h3>
      <ul>
        <li>
          ID de transacción y montos procesados por <strong>Mercado Pago</strong>.
          NO almacenamos los datos de tu tarjeta — esos los maneja Mercado Pago
          directamente conforme a su propio aviso de privacidad.
        </li>
        <li>
          Historial de tier (Free / Pro / VIP) y fecha de cada cambio.
        </li>
      </ul>

      <h3>2.3. Datos de uso</h3>
      <ul>
        <li>
          Eventos de consumo de tokens IA por engine — cuándo, cuántos y qué
          engine los usó.
        </li>
        <li>
          Registros de inicio de sesión (fecha y hora, IP, navegador) — los
          guardamos 90 días para detectar fraude.
        </li>
        <li>
          Selección de engine activo, configuración de bots, preferencias de
          ejecución.
        </li>
      </ul>

      <h3>2.4. Contenido que generas en los Engines</h3>
      <ul>
        <li>
          VODs que subes a ChalybClip, clips generados, transcripciones,
          variantes de captions.
        </li>
        <li>
          Streams enrutados via ChalybStreamManager, layouts guardados, conexiones
          OAuth a plataformas de destino (TikTok, YouTube, Twitch, Kick).
        </li>
        <li>
          Prompts, configuraciones de personas IA, contextos guardados.
        </li>
      </ul>
      <p>
        Guardamos tu contenido cifrado y solo lo procesamos cuando tú lo
        pides. No lo usamos para entrenar modelos públicos ni lo
        compartimos con terceros sin tu permiso.
      </p>

      <h2 id="finalidades">3. Finalidades del tratamiento</h2>
      <p>Tratamos tus datos para:</p>
      <ul>
        <li><strong>Operar el servicio</strong> que contrataste (suscripción, ejecución de engines, pagos).</li>
        <li><strong>Comunicación transaccional</strong>: confirmaciones de pago, alertas de cuota, notificaciones de seguridad.</li>
        <li><strong>Soporte técnico</strong>: responder a tus solicitudes via /contacto.</li>
        <li><strong>Facturación fiscal</strong>: emitir CFDI cuando lo solicites con tu RFC.</li>
        <li><strong>Cumplimiento legal</strong>: responder a requerimientos de autoridades cuando sean legalmente válidos.</li>
        <li><strong>Detección de fraude</strong>: análisis de patrones de pago y uso para prevenir abuso.</li>
        <li><strong>Mejora del producto</strong>: estadísticas agregadas y anónimas — nunca con datos que te identifiquen.</li>
      </ul>
      <p>
        <strong>NO usamos tus datos para:</strong> publicidad de terceros, venta
        de bases de datos, entrenamiento de modelos IA públicos, ni crear perfiles
        con fines ajenos al servicio.
      </p>

      <h2 id="terceros">4. Terceros con los que compartimos datos</h2>
      <p>
        Compartimos lo estrictamente necesario con proveedores que nos ayudan a
        operar el servicio. Todos están sujetos a obligaciones contractuales de
        confidencialidad y procesamiento limitado:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (EUA) — base de datos, autenticación,
          storage. Aloja tu cuenta y contenido. Cumple con SOC2 Type II.
        </li>
        <li>
          <strong>Mercado Pago</strong> (Argentina/México) — procesamiento de
          pagos. Recibe tu correo y monto para emitir el cobro.
        </li>
        <li>
          <strong>Vercel</strong> (EUA) — hosting de la plataforma web. Recibe
          logs de acceso anonimizados.
        </li>
        <li>
          <strong>Resend</strong> (EUA) — envío de correos transaccionales.
          Recibe tu correo y nombre.
        </li>
        <li>
          <strong>Anthropic</strong> (EUA) — proveedor del modelo Claude. Recibe
          los prompts que envías a través de los engines, sin metadata de cuenta
          asociada. Anthropic no entrena con estos datos.
        </li>
        <li>
          <strong>Engines integrados</strong> (ChalybClip, ChalybStreamManager): ver
          sección 5.
        </li>
      </ul>

      <h2 id="engines">5. Datos enviados a los Engines</h2>
      <p>
        Cuando activas un Engine, Chalyb crea una cuenta para ti en él. Le
        enviamos:
      </p>
      <ul>
        <li>Tu user_id de Chalyb (identificador opaco).</li>
        <li>Tu correo electrónico.</li>
        <li>Tu nombre de display.</li>
        <li>Tu tier actual (free / pro / vip) — para que el engine sepa qué funciones habilitarte.</li>
      </ul>
      <p>
        Esa información le permite al Engine crear tu espacio y validar tu acceso.
        Cualquier contenido adicional que generes <strong>dentro</strong> del
        Engine (VODs, clips, configuraciones) se rige por el aviso de privacidad
        de ese Engine en particular, al cual te suscribes en su primera
        activación.
      </p>

      <h2 id="cookies">6. Cookies y tecnologías similares</h2>
      <p>Usamos cookies para:</p>
      <ul>
        <li>
          <strong>Sesión</strong>: mantener tu inicio de sesión activo
          (cookie HTTP-only, segura, SameSite=Lax). Indispensable para usar la
          plataforma.
        </li>
        <li>
          <strong>Preferencias</strong>: recordar tu idioma (es/en), tier
          seleccionado en el selector. Caduca a los 12 meses.
        </li>
        <li>
          <strong>Analítica anónima</strong> (Vercel Analytics): conteo de
          pageviews sin identificarte personalmente. No usa cookies de terceros,
          no rastrea entre sitios.
        </li>
      </ul>
      <p>
        No usamos cookies publicitarias, ni de rastreo entre sitios, ni
        huella digital del navegador (fingerprinting).
      </p>

      <h2 id="retencion">7. Retención de datos</h2>
      <ul>
        <li>
          <strong>Cuenta activa</strong>: tus datos se conservan mientras tengas
          la cuenta abierta.
        </li>
        <li>
          <strong>Después de cerrar cuenta</strong>: borramos tus datos
          personales identificables en un plazo máximo de 30 días naturales.
        </li>
        <li>
          <strong>Excepciones legales</strong>: facturas fiscales (5 años por
          obligación del SAT), logs de fraude/seguridad (90 días después del
          cierre), backups técnicos (hasta 90 días después del borrado
          principal).
        </li>
        <li>
          <strong>Datos agregados/anonimizados</strong>: pueden conservarse
          indefinidamente para fines estadísticos y mejora del servicio. Estos
          datos no permiten reidentificarte.
        </li>
      </ul>

      <h2 id="derechos">8. Tus derechos ARCO</h2>
      <p>
        Conforme a la LFPDPPP, tienes derecho a:
      </p>
      <ul>
        <li><strong>Acceso</strong>: solicitar copia de los datos que tenemos sobre ti.</li>
        <li><strong>Rectificación</strong>: corregir datos inexactos o incompletos.</li>
        <li><strong>Cancelación</strong>: solicitar el borrado de tus datos (sujeto a las excepciones legales mencionadas).</li>
        <li><strong>Oposición</strong>: oponerte a un uso específico de tus datos.</li>
      </ul>
      <p>
        Adicionalmente puedes:
      </p>
      <ul>
        <li><strong>Revocar tu consentimiento</strong> en cualquier momento, lo que termina tu uso del servicio.</li>
        <li><strong>Limitar el uso</strong> a finalidades estrictamente necesarias para el servicio contratado.</li>
        <li>
          <strong>Portar tus datos</strong>: exportarlos en formato JSON
          estructurado para llevarlos a otro proveedor.
        </li>
      </ul>
      <p>
        Para ejercer cualquiera de estos derechos, escríbenos a través de{' '}
        <Link href={'/contacto' as Route}>/contacto</Link> con el asunto
        &laquo;Derechos ARCO&raquo;. Respondemos en máximo <strong>20 días
        hábiles</strong>, conforme al plazo de la LFPDPPP. Si no estás conforme con
        nuestra respuesta puedes presentar una queja ante el{' '}
        <strong>INAI</strong> (Instituto Nacional de Transparencia, Acceso a la
        Información y Protección de Datos Personales).
      </p>

      <h2 id="transferencias">9. Transferencias internacionales</h2>
      <p>
        Algunos de nuestros proveedores (Supabase, Vercel, Resend, Anthropic)
        operan desde Estados Unidos. Al usar Chalyb <strong>autorizas las
        transferencias internacionales necesarias</strong> para que el servicio
        funcione.
      </p>
      <p>
        Estos proveedores cumplen estándares equivalentes o superiores a los que
        exige la LFPDPPP. Mantenemos cláusulas contractuales que los obligan a
        proteger tus datos conforme a estándares internacionales (SOC2, ISO
        27001, GDPR donde aplique).
      </p>

      <h2 id="seguridad">10. Medidas de seguridad</h2>
      <p>Implementamos medidas técnicas y administrativas razonables para proteger tus datos:</p>
      <ul>
        <li>Cifrado en tránsito (HTTPS/TLS 1.3) en toda comunicación.</li>
        <li>Cifrado en reposo para datos sensibles en la base de datos.</li>
        <li>Hashing irreversible para contraseñas (bcrypt).</li>
        <li>Autenticación de dos factores (2FA) opcional para cuentas.</li>
        <li>Row-Level Security en Supabase para aislar datos entre usuarios.</li>
        <li>Service-role keys nunca expuestas al cliente.</li>
        <li>Logs de auditoría para acciones administrativas (cambios de tier, role, accesos a datos de otros usuarios).</li>
        <li>Backups automáticos diarios con retención de 7 días.</li>
        <li>Acceso a producción restringido a personal autorizado con MFA.</li>
      </ul>
      <p>
        Ninguna medida de seguridad es perfecta. Si ocurre una falla
        que ponga en riesgo tus datos personales, te avisaremos en máximo{' '}
        <strong>72 horas</strong>, siguiendo las mejores prácticas internacionales.
      </p>

      <h2 id="menores">11. Menores de edad</h2>
      <p>
        Chalyb no está dirigido a menores de 18 años. No recopilamos
        deliberadamente datos de menores. Si descubrimos que tenemos datos de un
        menor sin autorización paterna o tutorial, los borramos inmediatamente.
        Si eres padre/madre/tutor y crees que tu menor a cargo nos proporcionó
        datos, contáctanos via <Link href={'/contacto' as Route}>/contacto</Link>{' '}
        para resolverlo.
      </p>

      <h2 id="cambios">12. Cambios al aviso</h2>
      <p>
        Podemos actualizar este aviso cuando cambien nuestras prácticas o la
        regulación aplicable. Para cambios sustanciales (nuevos proveedores,
        nuevas finalidades, cambios en transferencias internacionales):
      </p>
      <ul>
        <li>Te notificamos por correo con al menos 14 días naturales de anticipación.</li>
        <li>Publicamos la nueva versión en esta página con fecha actualizada.</li>
        <li>
          Si los cambios afectan finalidades secundarias, tendrás opción de
          oponerte antes de que entren en vigor.
        </li>
      </ul>

      <h2 id="contacto">13. Contacto</h2>
      <p>
        Para cualquier pregunta, ejercer derechos ARCO, o reportar incidentes de
        privacidad:
      </p>
      <ul>
        <li>
          Formulario: <Link href={'/contacto' as Route}>/contacto</Link>
        </li>
        <li>
          Asunto sugerido: &laquo;Privacidad — [tu motivo]&raquo;
        </li>
      </ul>
      <p>
        Respondemos en máximo <strong>20 días hábiles</strong> para solicitudes
        ARCO formales y menos de 24 horas hábiles para preguntas generales.
      </p>

      <div className="legal-callout" style={{ marginTop: 40 }}>
        <strong>Sobre este documento:</strong> esta versión cumple con los
        requisitos mínimos de la LFPDPPP para una SaaS multi-engine en México.
        Si vas a manejar datos de salud, financieros sensibles, o de menores
        directamente, contrata a un Oficial de Privacidad y haz una evaluación
        de impacto específica para esos casos.
      </div>
    </LegalPage>
  );
}
