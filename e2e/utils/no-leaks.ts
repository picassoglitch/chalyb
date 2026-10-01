// What a customer must never see (rebuild prompt §1.2, §6.6, BUILD-SPEC §4.3).

import { expect, type Page } from '@playwright/test';

export const FORBIDDEN_TEXT: { label: string; re: RegExp }[] = [
  { label: 'env var name', re: /_ADMIN_TOKEN|_SSO_SECRET|CHALYB_ADMIN_TOKEN/ },
  { label: 'config key', re: /admin_api_base|engine_subs|external_user_id/ },
  { label: 'log hint', re: /logs de Vercel|Vercel logs|revisa los logs|\[\/app\/usage\]/i },
  { label: 'setup leak', re: /configuración quedó incompleta/ },
  { label: 'SSO', re: /\bSSO\b/ },
  { label: 'ID en', re: /\bID en \w/ },
  { label: 'placeholder', re: /placeholder/i },
  { label: 'old product name', re: /Chaly(?!b\b)[A-Za-z]+/ },
  { label: 'engine', re: /\bengines?\b/i },
  { label: 'modo demo', re: /modo demo|demo mode/i },
  { label: 'simulación', re: /simulaci[oó]n|simulation/i },
  { label: 'Disponible / Requiere Pro', re: /\bDisponible\b|Requiere Pro/ },
  { label: 'próximamente / beta', re: /pr[oó]ximamente|coming soon|\bbeta\b/i },
];

/** Visible text only — admin diagnostics are collapsed <details>, and a
 *  closed <details> body is not part of innerText. */
export async function expectNoLeaks(page: Page, where = page.url()) {
  const text = await page.locator('body').innerText();
  const hits = FORBIDDEN_TEXT.filter(({ re }) => re.test(text)).map(
    ({ label, re }) => `${label}: “${text.match(re)?.[0]}”`,
  );
  expect(hits, `customer-visible leaks on ${where}`).toEqual([]);
}
