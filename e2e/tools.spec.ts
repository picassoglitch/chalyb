// P3 tool flows against the mock adapters. The server under test runs with
// E2E_USE_MOCK_ADAPTERS=1 and TOOL_HUB_MODE_<SLUG>=mock for every tool; this
// spec with E2E_TOOLS_MODE=mock. State (risk acks, notices) lives in the
// mock Supabase for the whole run, so each step accepts either side of a
// one-time gate.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { expectNoLeaks } from './utils/no-leaks';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const MOCK = process.env.E2E_TOOLS_MODE === 'mock';
const TOOLS = ['Clips', 'Señales', 'En vivo', 'Asistente', 'Pronósticos', 'Inmuebles', 'Inversiones'];

/** The risk notice (aceptacion-ux §6): blocks until the box is ticked. */
async function passRiskGate(page: Page) {
  const gate = page.getByRole('dialog', { name: 'Antes de empezar' });
  if (!(await gate.isVisible().catch(() => false))) return;
  const cta = gate.getByRole('button', { name: 'Entendido, continuar' });
  await expect(cta).toBeDisabled();
  await gate.getByRole('checkbox', { name: /las decisiones y los riesgos son míos/ }).check();
  await cta.click();
  await expect(gate).toHaveCount(0);
}

async function clean(page: Page, info: Parameters<typeof expectNoOverflow>[1]) {
  await expectNoLeaks(page);
  await expectNoOverflow(page, info);
  await expectAccessible(page);
}

test.describe('as pro', () => {
  asRole('pro');
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set (server must run the tools in mock mode)');

  test('Más herramientas: every tool included, each opens its own screens', async ({ page }, info) => {
    const res = await page.request.get('/app/engines', { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toMatch(/\/app\/herramientas$/);
    await page.goto('/app/herramientas');
    await expect(page.getByRole('heading', { level: 1, name: 'Más herramientas' })).toBeVisible();
    for (const name of TOOLS) {
      const card = page.locator('.ch-tool', { has: page.getByRole('heading', { name, exact: true }) });
      await expect(card.getByText('Incluido en tu plan')).toBeVisible();
      await expect(card.getByRole('link', { name: `Abrir ${name}` })).toBeVisible();
    }
    await expect(page.getByText(/Disponible|Próximamente|Llega pronto/i)).toHaveCount(0);
    await page.getByRole('link', { name: 'Abrir Señales' }).click();
    await expect(page).toHaveURL(/\/app\/senales$/);
    // The old tool page sends an included tool to its own screens.
    await page.goto('/app/engines/chalybobs');
    await expect(page).toHaveURL(/\/app\/en-vivo$/);
    await page.goto('/app/herramientas');
    await clean(page, info);
  });

  test('Señales: risk notice → coins → channels → listo, disclaimer always on', async ({ page }, info) => {
    const refused = await page.request.post('/api/tools/consent', {
      data: { kind: 'risk', slug: 'chalybcrypto', checked: false, locale: 'es' },
    });
    expect(refused.status(), 'no box, no consent').toBe(422);
    await page.goto('/app/senales');
    await passRiskGate(page);
    await expect(page.getByRole('heading', { level: 1, name: '¿Qué monedas te interesan?' })).toBeVisible();
    const btc = page.getByRole('button', { name: /BTC/ });
    if ((await btc.getAttribute('aria-pressed')) !== 'true') await btc.click();
    await page.getByRole('link', { name: 'Continuar' }).click();
    await expect(page.getByText('¿Cómo te avisamos?')).toBeVisible();
    await page.getByRole('checkbox', { name: 'En la app' }).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/app\/senales\/listo$/);
    await expect(page.getByRole('note')).toContainText('no es asesoría financiera');
    await expect(page.getByText(/copiar automáticamente|seguir señales|te conviene/i)).toHaveCount(0);
    await clean(page, info);
  });

  test('En vivo: start, switch scene, toggle mic, end with the confirm', async ({ page }, info) => {
    await page.goto('/app/en-vivo');
    await expect(page.getByText('OBS conectado')).toBeVisible();
    const stop = page.getByRole('button', { name: /Terminar transmisión/ });
    if (await stop.isVisible().catch(() => false)) {
      await stop.click();
      await page.getByRole('button', { name: 'Sí, terminar' }).click();
    }
    await page.getByRole('button', { name: /Iniciar transmisión/ }).click();
    await expect(stop).toBeVisible();
    await page.getByRole('button', { name: /Juego/ }).click();
    await expect(page.getByRole('button', { name: /Juego/ })).toHaveAttribute('aria-pressed', 'true');
    const mic = page.getByRole('switch', { name: 'Micrófono' });
    const before = await mic.getAttribute('aria-checked');
    await mic.click();
    await expect(mic).not.toHaveAttribute('aria-checked', before ?? '');
    await clean(page, info);
    await stop.click();
    await expect(page.getByRole('dialog', { name: '¿Terminar tu transmisión?' })).toBeVisible();
    await page.getByRole('button', { name: 'Seguir' }).last().click();
    await expect(stop).toBeVisible();
    await stop.click();
    await page.getByRole('button', { name: 'Sí, terminar' }).click();
    await expect(page.getByRole('button', { name: /Iniciar transmisión/ })).toBeVisible();
  });

  test('Asistente: 3 steps, and it always says it is automatic', async ({ page }, info) => {
    await page.goto('/app/herramientas/asistente');
    const edit = page.getByRole('button', { name: 'Cambiar' });
    if (await edit.isVisible().catch(() => false)) await page.goto('/app/herramientas/asistente?paso=1');
    if (await page.getByLabel('Nombre de tu negocio').isVisible().catch(() => false)) {
      await page.getByLabel('Nombre de tu negocio').fill('Tacos Doña Rosa');
      await page.getByRole('radio', { name: 'WhatsApp' }).check();
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: '¿Qué debe saber?' })).toBeFocused();
      await page.getByLabel('Lo que debe saber tu Asistente').fill('Abrimos de 9 a 18. Tacos a $20.');
      await page.getByRole('button', { name: 'Continuar' }).click();
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Pruébalo' })).toBeVisible();
    await page.getByLabel('Tu mensaje').fill('¿A qué hora abren?');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.ch-bubble').last()).toContainText('asistente automático');
    await clean(page, info);
  });

  test('Pronósticos: forecasts only, with the fixed footer', async ({ page }, info) => {
    await page.goto('/app/herramientas/pronosticos');
    await passRiskGate(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Pronósticos de hoy' })).toBeVisible();
    await expect(page.getByText('Esto es informativo. No es asesoría de apuestas.')).toBeVisible();
    await expect(page.locator('main a[href^="http"]')).toHaveCount(0);
    await clean(page, info);
  });

  test('Inmuebles: create a card and share it', async ({ page }, info) => {
    await page.goto('/app/herramientas/inmuebles');
    await page.getByLabel('Título').fill('Casa con jardín en Querétaro');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/paso=2/);
    await page.getByLabel('Detalles').fill('3 recámaras, 2 baños, 180 m².');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tu ficha está lista' })).toBeVisible();
    await page.evaluate(() => {
      // No share sheet in a headless browser: exercise the copy fallback.
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
    });
    await page.getByRole('button', { name: 'Compartir' }).click();
    await expect(page.getByText('Enlace copiado')).toBeVisible();
    await clean(page, info);
  });

  test('Inversiones: withdrawal keys refused; rules need the box; pause works', async ({ page }, info) => {
    await page.goto('/app/herramientas/inversiones');
    await passRiskGate(page);
    if (await page.getByLabel('Clave de API').isVisible().catch(() => false)) {
      await page.getByLabel('Clave de API').fill('key-withdraw-123');
      await page.getByLabel('Clave secreta').fill('secret-123456');
      const connect = page.getByRole('button', { name: 'Conectar' });
      await expect(connect).toBeDisabled();
      await page.getByRole('checkbox', { name: /consentimiento expreso/ }).check();
      await connect.click();
      await expect(page.locator('.ch-err')).toHaveText(/Esta clave permite retiros/);
      await page.getByLabel('Clave de API').fill('key-trade-123');
      await connect.click();
    } else if (await page.getByRole('button', { name: 'Escribir otra regla' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Escribir otra regla' }).click();
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Escribe tu regla' })).toBeVisible();
    await page.getByLabel('Activo').fill('BTC');
    await page.getByLabel('Cuándo (en tus palabras)').fill('si BTC baja de 60,000 USD');
    await page.getByLabel('Monto máximo por orden (MXN)').fill('500');
    await page.getByLabel('Horario').fill('lunes a viernes');
    await page.getByRole('button', { name: 'Continuar' }).click();
    const activate = page.getByRole('button', { name: 'Activar' });
    await expect(activate).toBeDisabled();
    await page.getByRole('checkbox', { name: /las órdenes y sus riesgos son míos/ }).check();
    await activate.click();
    const rule = page.locator('.ch-row', { hasText: 'si BTC baja de 60,000 USD' }).first();
    await expect(rule.getByText('Activa')).toBeVisible();
    await rule.getByRole('button', { name: 'Pausar' }).click();
    await expect(rule.getByText('En pausa')).toBeVisible();
    await clean(page, info);
  });

  test('Avisos: bell, mark all read, a billing notice stays until its charge', async ({ page }, info) => {
    await page.goto('/app/avisos');
    await expect(page.getByRole('heading', { level: 1, name: 'Avisos' })).toBeVisible();
    await expect(page.getByText('Tu plan se renueva en 7 días')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Borrar: Tu plan se renueva en 7 días' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Borrar: / }).first()).toBeVisible();
    const markRead = page.getByRole('button', { name: 'Marcar como leídos' });
    if (await markRead.isVisible().catch(() => false)) await markRead.click();
    // Other specs may add notices meanwhile; the ones that were here are read.
    await expect(page.locator('.ch-notice', { hasText: 'Tu plan se renueva en 7 días' })).toHaveAttribute('data-unread', 'false');
    // The bell says "Avisos", or "Avisos (n sin leer)" if another spec just added one.
    await expect(page.getByRole('link', { name: /^Avisos( \(\d+ sin leer\))?$/ }).first()).toBeAttached();
    await clean(page, info);
  });

  test('Mis resultados: in progress, search and no match', async ({ page }, info) => {
    await page.goto('/app/clips');
    await page.getByLabel(/Pega el enlace/).fill('https://www.youtube.com/watch?v=resultados');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Crear mis clips' }).click();
    // Wait for the job to exist before leaving the page.
    await expect(page).toHaveURL(/\/app\/clips\/[^/?]+$/);
    await page.goto('/app/resultados');
    await expect(page).toHaveURL(/\/app\/history$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis resultados' })).toBeVisible();
    await expect(page.getByText(/Creando… \d+%|\d+ clips/).first()).toBeVisible();
    await page.getByLabel('Buscar en mis resultados').fill('nada-que-coincida');
    await expect(page.getByText('No encontramos “nada-que-coincida”. Prueba con otra palabra.')).toBeVisible();
    await page.getByLabel('Buscar en mis resultados').fill('resultados');
    await expect(page.locator('.ch-result').first()).toBeVisible();
    await clean(page, info);
  });

  test('Ayuda: a person first, no WhatsApp without its link, cobro goes to the form', async ({ page }, info) => {
    await page.goto('/app/ayuda');
    await expect(page).toHaveURL(/\/app\/help$/);
    await expect(page.getByRole('heading', { name: 'Hablar con una persona' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);
    await page.getByText('Tengo un problema con un cobro').click();
    const cobro = page.getByRole('link', { name: 'Problema con un cobro' });
    await expect(cobro).toHaveAttribute('href', /\/contacto\?categoria=cobro$/);
    // Términos §7.5: email, date and amount; name and message optional.
    await cobro.click();
    await expect(page.getByLabel('Fecha del cobro')).toBeVisible();
    await expect(page.getByLabel('Monto del cobro (MXN)')).toBeVisible();
    await expect(page.getByLabel('Nombre (opcional)')).not.toHaveAttribute('required', '');
    await expect(page.getByText(/Pedir un reembolso nunca te perjudica/)).toBeVisible();
    await clean(page, info);
  });
});

test.describe('as free', () => {
  asRole('free');
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set');

  test('Más herramientas: Pro tools offer the trial, never a lock', async ({ page }, info) => {
    await page.goto('/app/herramientas');
    const offers = page.getByText('Incluido en Pro', { exact: true });
    await expect(offers.first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Pruébalo gratis|Volver a Pro|Ver planes/ }).first()).toBeVisible();
    await expect(page.getByText(/Disponible|bloquead/i)).toHaveCount(0);
    // A Pro-only tool's own screens send Free back to the offer.
    await page.goto('/app/herramientas/inversiones');
    await expect(page).toHaveURL(/\/app\/engines\/chalybtrade$/);
    await clean(page, info);
  });
});
