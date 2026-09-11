import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth/session';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata = {
  title: 'Términos de servicio',
  description:
    'Términos y condiciones para usar Chalyb y sus engines (ChalybClip, ChalybStreamManager y futuros productos).',
};

// force-dynamic so Vercel's CDN never serves a stale 404 from before the
// route existed. The page is cheap (no DB, just getCurrentUser for nav
// state), so per-request rendering has no real cost.
export const dynamic = 'force-dynamic';

const LAST_UPDATED = '17 junio 2026';

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  return (
    <LegalPage
      title="Términos de servicio"
      lastUpdated={LAST_UPDATED}
      isAuthenticated={user !== null}
    >
      <div className="legal-toc">
        <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          Contenido
        </strong>
        <ol>
          <li><a href="#aceptacion">Aceptación de los términos</a></li>
          <li><a href="#definiciones">Definiciones</a></li>
          <li><a href="#cuenta">Tu cuenta</a></li>
          <li><a href="#planes">Planes y suscripciones</a></li>
          <li><a href="#pagos">Pagos, renovación y cancelación</a></li>
          <li><a href="#reembolsos">Política de reembolsos</a></li>
          <li><a href="#engines">Engines y productos integrados</a></li>
          <li><a href="#uso">Uso aceptable</a></li>
          <li><a href="#contenido">Tu contenido y licencias</a></li>
          <li><a href="#propiedad">Propiedad intelectual de Chalyb</a></li>
          <li><a href="#disponibilidad">Disponibilidad del servicio</a></li>
          <li><a href="#responsabilidad">Limitación de responsabilidad</a></li>
          <li><a href="#terminacion">Suspensión y terminación</a></li>
          <li><a href="#cambios">Cambios a estos términos</a></li>
          <li><a href="#ley">Ley aplicable y jurisdicción</a></li>
          <li><a href="#contacto">Contacto</a></li>
        </ol>
      </div>

      <p>
        Bienvenido a Chalyb. Estos términos de servicio (los &laquo;Términos&raquo;) son un
        acuerdo entre tú (el &laquo;Usuario&raquo;) y <strong>Chalyb</strong>,
        operado desde México. Al crear una cuenta, comprar una suscripción o usar
        cualquiera de nuestros productos, aceptas estos Términos en su totalidad.
        Si no estás de acuerdo, no uses el servicio.
      </p>

      <h2 id="aceptacion">1. Aceptación de los términos</h2>
      <p>
        El acceso a Chalyb y a los Engines está condicionado a tu aceptación de
        estos Términos. Cada vez que iniciamos un cambio sustancial, te avisamos
        por correo y publicamos la versión actualizada en esta página al menos{' '}
        <strong>14 días naturales</strong> antes de que entren en vigor. Si sigues
        usando el servicio después de esa fecha, aceptas los cambios.
      </p>

      <h2 id="definiciones">2. Definiciones</h2>
      <ul>
        <li>
          <strong>Plataforma</strong>: el sitio web <code>chalyb.com</code>,
          incluyendo el panel de operación (<code>/app</code>), el dashboard
          administrativo (<code>/dashboard</code>), las APIs públicas, y las
          páginas de marketing.
        </li>
        <li>
          <strong>Engine</strong>: cada producto independiente integrado a la
          Plataforma. Al momento de esta versión: <strong>ChalybClip</strong> (generador
          de clips a partir de streams/VODs) y <strong>ChalybStreamManager</strong>
          (control central de transmisiones en vivo). Cada Engine se ejecuta en
          infraestructura propia bajo su propia licencia y política de uso.
        </li>
        <li>
          <strong>Suscripción</strong>: acceso recurrente mensual a la Plataforma
          y a uno o más Engines según el plan contratado.
        </li>
        <li>
          <strong>Tier</strong>: nivel de acceso. Tiers actuales:
          <code>FREE</code>, <code>PRO</code>, <code>VIP</code>. Las
          capacidades de cada uno están publicadas en{' '}
          <Link href={'/app/subscription' as Route}>/app/subscription</Link>.
        </li>
        <li>
          <strong>Contenido</strong>: cualquier dato que subas, generes a través de
          un Engine, o ingreses en la Plataforma (VODs, prompts, configuraciones,
          credenciales OAuth de terceros, etc.).
        </li>
      </ul>

      <h2 id="cuenta">3. Tu cuenta</h2>
      <p>
        Para usar los Engines necesitas una cuenta. Al registrarte:
      </p>
      <ul>
        <li>Debes ser mayor de 18 años o tener autorización del titular legal.</li>
        <li>Te comprometes a dar información real y mantenerla actualizada.</li>
        <li>
          Eres responsable de la seguridad de tu cuenta — contraseña, sesiones
          activas y, si lo activaste, el segundo factor (2FA).
        </li>
        <li>
          Una cuenta es individual. No la compartas. Para acceso de equipo usa el
          panel{' '}
          <Link href={'/dashboard/team' as Route}>/dashboard/team</Link> con los
          roles configurados.
        </li>
      </ul>
      <p>
        Nos reservamos el derecho de suspender cuentas creadas con datos falsos,
        que abusan del Free tier (múltiples cuentas de la misma persona),
        o que vulneran las reglas de uso aceptable.
      </p>

      <h2 id="planes">4. Planes y suscripciones</h2>
      <p>
        Ofrecemos tres tiers actualmente:
      </p>
      <ul>
        <li>
          <strong>Free</strong>: $0 MXN. Acceso a todos los Engines en modo
          simulación. Sin ejecución en vivo. Cuotas reducidas.
        </li>
        <li>
          <strong>Pro</strong>: $749 MXN / mes. Ejecución en vivo de UN Engine a
          tu elección, cuotas extendidas, soporte por correo.
        </li>
        <li>
          <strong>VIP</strong>: $2,499 MXN / mes. Ejecución en vivo de
          todos los Engines activos, cuotas máximas, soporte prioritario.
        </li>
      </ul>
      <p>
        Los precios pueden cambiar — te avisamos por correo al menos 30 días
        naturales antes de aplicar el nuevo precio a tu suscripción activa. Si no
        estás de acuerdo, puedes cancelar antes de la fecha de cambio sin cargo
        adicional.
      </p>

      <h2 id="pagos">5. Pagos, renovación y cancelación</h2>
      <p>
        Los pagos se procesan a través de <strong>Mercado Pago</strong>. Al activar
        una suscripción pagada autorizas el cargo recurrente mensual al método de
        pago que registraste. La renovación es automática hasta que canceles.
      </p>
      <p>
        <strong>Cancelar</strong>: desde{' '}
        <Link href={'/app/subscription' as Route}>/app/subscription</Link> →
        &laquo;Cancelar plan&raquo;. La cancelación es <strong>inmediata</strong> para
        efectos de no renovación, pero <strong>mantienes acceso al plan vigente
        hasta el final del período ya pagado</strong>. Después bajas
        automáticamente a Free.
      </p>
      <p>
        Si el cargo recurrente falla (tarjeta vencida, fondos insuficientes,
        rechazo del banco), te notificamos por correo e intentamos cobrar tres
        veces durante los siguientes 7 días. Si los tres intentos fallan,
        suspendemos temporalmente la ejecución en vivo hasta que resuelvas el
        pago. Tus datos no se borran durante este período.
      </p>

      <h2 id="reembolsos">6. Política de reembolsos</h2>
      <p>
        Reembolsamos el <strong>100% del primer cargo</strong> si lo solicitas
        dentro de los <strong>7 días naturales</strong> posteriores. Después de ese
        plazo, los cargos no son reembolsables, pero puedes cancelar la
        renovación en cualquier momento.
      </p>
      <p>
        Para solicitar un reembolso escribe a través de{' '}
        <Link href={'/contacto' as Route}>/contacto</Link> con el asunto
        &laquo;Reembolso&raquo; e incluye el ID de pago. Procesamos los reembolsos
        elegibles en un plazo de 5 a 10 días hábiles, sujeto a los tiempos de
        Mercado Pago.
      </p>

      <h2 id="engines">7. Engines y productos integrados</h2>
      <p>
        Cada Engine es un producto independiente que opera bajo su propia
        licencia y reglas técnicas. Cuando activas un Engine desde Chalyb:
      </p>
      <ul>
        <li>
          Aceptas también los términos específicos del Engine, si los publica. Te
          los mostramos al momento de la primera activación.
        </li>
        <li>
          Chalyb provisiona una cuenta para ti en el Engine y mantiene la
          sincronización del tier (Free / Pro / VIP).
        </li>
        <li>
          La ejecución de jobs (clips, transmisiones, llamadas a IA) la realiza
          la infraestructura del Engine. Los logs, fallas o disputas técnicas
          relacionadas con esa ejecución se atienden a través de Chalyb, que
          coordina con el operador del Engine.
        </li>
      </ul>
      <p>
        <strong>ChalybClip</strong> en particular procesa contenido de video que tú
        subes o que descargas de fuentes externas. Eres responsable de tener los
        derechos sobre ese contenido (ver Sección 9).
      </p>

      <h2 id="uso">8. Uso aceptable</h2>
      <p>NO PUEDES usar Chalyb ni los Engines para:</p>
      <ul>
        <li>Actividades ilegales bajo la ley mexicana o de tu jurisdicción.</li>
        <li>
          Procesar contenido que infrinja derechos de autor, marcas registradas
          o derechos de imagen de terceros sin autorización.
        </li>
        <li>
          Generar o distribuir contenido que promueva odio, violencia, abuso o
          desinformación deliberada.
        </li>
        <li>
          Hacer scraping masivo, ataques de fuerza bruta, o intentar evadir
          cuotas y límites técnicos.
        </li>
        <li>
          Revender el acceso a Chalyb o a un Engine sin autorización escrita
          previa.
        </li>
        <li>
          Usar la Plataforma para entrenar modelos de IA competidores sin
          acuerdo escrito.
        </li>
      </ul>
      <p>
        Las violaciones detectadas pueden resultar en suspensión temporal,
        terminación de la cuenta sin reembolso, y/o reporte a las autoridades
        correspondientes.
      </p>

      <h2 id="contenido">9. Tu contenido y licencias</h2>
      <p>
        <strong>Tú eres dueño de tu contenido.</strong> No reclamamos propiedad
        sobre los VODs que subes, los clips que ChalybClip genera para ti, los
        prompts que escribes, ni los streams que enrutas vía ChalybStreamManager.
      </p>
      <p>
        Para operar el servicio, sin embargo, nos otorgas una <strong>licencia
        limitada, no exclusiva, libre de regalías</strong> para:
      </p>
      <ul>
        <li>
          Almacenar, procesar y transmitir tu contenido en la infraestructura
          necesaria para ejecutar los Engines (servidores propios, Supabase,
          proveedores de cómputo GPU).
        </li>
        <li>
          Generar derivados técnicos (clips, transcripciones, miniaturas,
          variantes de captions, embeddings vectoriales) cuando los solicites a
          través de un Engine.
        </li>
        <li>
          Usar metadatos agregados y anonimizados (no tu contenido en sí) para
          mejorar nuestros productos.
        </li>
      </ul>
      <p>
        Esta licencia termina cuando borras el contenido o cierras tu cuenta,
        con un margen razonable para purgar copias técnicas de respaldos
        (hasta 90 días).
      </p>

      <h2 id="propiedad">10. Propiedad intelectual de Chalyb</h2>
      <p>
        El nombre, logo, código fuente, diseño, y la lógica de Chalyb y de los
        Engines son propiedad de sus respectivos titulares. Tu suscripción te
        otorga el derecho de <strong>usar</strong> el servicio, no de copiarlo,
        redistribuirlo, descompilarlo, ni crear obras derivadas.
      </p>

      <h2 id="disponibilidad">11. Disponibilidad del servicio</h2>
      <p>
        Hacemos nuestro mejor esfuerzo por mantener Chalyb y los Engines
        disponibles 24/7, pero <strong>no garantizamos uptime contractual</strong>.
        Podemos tener:
      </p>
      <ul>
        <li>
          Mantenimientos programados (te avisamos por correo con al menos 24
          horas de anticipación).
        </li>
        <li>
          Interrupciones por causas fuera de nuestro control (cortes de
          proveedores cloud, ataques DDoS, fallas de red).
        </li>
        <li>
          Cambios en features, APIs o engines mientras evolucionamos la
          plataforma. Mantenemos retrocompatibilidad razonable y avisamos cambios
          que rompen integraciones existentes con al menos 60 días.
        </li>
      </ul>

      <h2 id="responsabilidad">12. Limitación de responsabilidad</h2>
      <div className="legal-callout">
        <strong>Esta sección limita lo que puedes reclamarnos legalmente.</strong>{' '}
        Léela con atención.
      </div>
      <p>
        En la máxima medida permitida por la ley aplicable:
      </p>
      <ul>
        <li>
          Chalyb provee el servicio &laquo;tal cual&raquo; (<em>as-is</em>), sin
          garantías expresas o implícitas más allá de las que la ley exige.
        </li>
        <li>
          No somos responsables de daños indirectos, incidentales o
          consecuenciales (lucro cesante, pérdida de datos, daño a la imagen,
          etc.) derivados del uso o imposibilidad de uso del servicio.
        </li>
        <li>
          Nuestra responsabilidad total acumulada por cualquier reclamo está
          limitada al monto que tú pagaste a Chalyb durante los{' '}
          <strong>12 meses inmediatamente anteriores</strong> al evento que da
          origen al reclamo.
        </li>
        <li>
          Nada en estos Términos limita responsabilidades que la ley mexicana
          declare no renunciables (por ejemplo, derechos del consumidor bajo la
          LFPC).
        </li>
      </ul>

      <h2 id="terminacion">13. Suspensión y terminación</h2>
      <p>
        <strong>Tú puedes terminar</strong> tu cuenta en cualquier momento. Cancela
        la suscripción desde{' '}
        <Link href={'/app/subscription' as Route}>/app/subscription</Link>, luego
        solicita el borrado de cuenta a través de{' '}
        <Link href={'/contacto' as Route}>/contacto</Link>. Eliminamos tus datos
        personales en un plazo máximo de 30 días naturales, conservando solo lo
        que la ley exige (facturas fiscales, logs anti-fraude).
      </p>
      <p>
        <strong>Nosotros podemos terminar</strong> tu cuenta inmediatamente,
        sin reembolso, si:
      </p>
      <ul>
        <li>Violas las reglas de uso aceptable (Sección 8).</li>
        <li>No pagas dos ciclos consecutivos después de los avisos.</li>
        <li>Detectamos uso fraudulento o malicioso del servicio.</li>
      </ul>

      <h2 id="cambios">14. Cambios a estos términos</h2>
      <p>
        Podemos modificar estos Términos para reflejar cambios legales, nuevos
        productos, ajustes de precio o aclaraciones operativas. Para cambios
        sustanciales:
      </p>
      <ul>
        <li>
          Publicamos la nueva versión en esta página con la fecha de &laquo;Última
          actualización&raquo;.
        </li>
        <li>
          Te enviamos un correo al menos 14 días naturales antes de que entren
          en vigor.
        </li>
        <li>
          Si sigues usando el servicio después de la fecha indicada, aceptas la
          nueva versión.
        </li>
        <li>
          Si no estás de acuerdo, puedes cancelar antes de esa fecha sin penalización.
        </li>
      </ul>

      <h2 id="ley">15. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes de los <strong>Estados Unidos
        Mexicanos</strong>, sin considerar conflicto de leyes. Para cualquier
        controversia que no se pueda resolver por la vía amigable, las partes se
        someten a la jurisdicción de los tribunales competentes de{' '}
        <strong>Ciudad de México</strong>, renunciando expresamente a cualquier
        otro fuero que pudiera corresponderles.
      </p>
      <p>
        Si eres consumidor en términos de la Ley Federal de Protección al
        Consumidor (LFPC), conservas todos los derechos que esa ley te otorga,
        incluyendo el derecho de presentar quejas ante la PROFECO.
      </p>

      <h2 id="contacto">16. Contacto</h2>
      <p>
        Para cualquier pregunta sobre estos Términos, escríbenos a través de{' '}
        <Link href={'/contacto' as Route}>/contacto</Link>. Respondemos en menos
        de 24 horas hábiles.
      </p>

      <div className="legal-callout" style={{ marginTop: 40 }}>
        <strong>Sobre este documento:</strong> esta versión es una base operativa
        razonable para una SaaS multi-engine en México. Para usos en disputas
        reales, contratos enterprise, o expansión a otras jurisdicciones,
        consulta a un abogado especializado para revisarlo y adaptarlo a tu
        situación específica.
      </div>
    </LegalPage>
  );
}
