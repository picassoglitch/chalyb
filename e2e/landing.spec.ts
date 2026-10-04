// Landing `/` acceptance (LANDING-SPEC §11): section order, one h1, the hero
// CTA above the fold, CTA links with `from`, banned words, legal captions,
// no broken internal links, no analytics before consent, and the signed-in
// nav. Read-only against any target; runs on desktop and at 360 px.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';

const TRIAL_FLOW = process.env.E2E_TRIAL_FLOW === '1';
const ANALYTICS = /\/_vercel\/insights|va\.vercel-scripts\.com/;

/** Hides the consent banner so it doesn't cover what a test clicks. */
async function dismissConsent(page: Page) {
  const banner = page.getByRole('dialog');
  if (await banner.isVisible().catch(() => false))
    await banner.getByRole('button', { name: 'Solo necesarias' }).click();
}

test('sections run hero → herramientas → como → galería → para quién → precios → preguntas → idea → final → footer', async ({
  page,
}) => {
  await page.goto('/');
  const order = await page.evaluate(() => {
    const main = document.querySelector('main');
    const sections = [...(main?.querySelectorAll(':scope > section') ?? [])].map(
      (s) => s.id || s.getAttribute('aria-labelledby') || '?',
    );
    const footer = document.querySelector('footer');
    const footerAfterMain =
      !!main &&
      !!footer &&
      !!(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { sections, footerAfterMain };
  });
  expect(order.sections).toEqual([
    'hero',
    'herramientas',
    'como',
    'gallery-title',
    'who-title',
    'precios',
    'preguntas',
    'idea',
    'final',
  ]);
  expect(order.footerAfterMain).toBe(true);
});

test('exactly one h1', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toContainText('Tú duermes.');
});

test('the hero CTA is fully visible without scrolling at 390×844', async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto('/');
  await expect(page.locator('[data-cta="hero_trial"]')).toBeInViewport({ ratio: 1 });
  await page.close();
});

test('hero_trial goes to sign-up with the trial intent, the toggle interval and from', async ({
  page,
}) => {
  await page.goto('/');
  const href = await page.locator('[data-cta="hero_trial"]').getAttribute('href');
  expect(href).toBe(
    TRIAL_FLOW
      ? '/sign-in?mode=signup&plan=pro&intent=trial&interval=year&from=hero_trial'
      : // Without the trial flow there is no trial claim (K-7).
        '/sign-in?mode=signup&plan=pro&interval=year&from=hero_trial',
  );
});

test('after switching to Mensual, the Pro button carries interval=month and from=pricing_pro', async ({
  page,
}) => {
  await page.goto('/');
  await dismissConsent(page);
  const plans = page.locator('#precios');
  const year = plans.getByRole('radio', { name: /^Anual/ });
  test.skip((await year.count()) === 0, 'Anual is only offered with paid checkout on');
  await expect(year).toHaveAttribute('aria-checked', 'true');
  await plans.getByRole('radio', { name: /^Mensual/ }).click();
  await expect(plans.getByTestId('plan-cards')).toHaveAttribute('data-interval', 'month');
  const href = await plans
    .locator('section[aria-labelledby="pc-pro"] a.ch-pc__btn')
    .getAttribute('href');
  const url = new URL(href!, 'https://x');
  expect(url.pathname).toBe('/sign-in');
  expect(url.searchParams.get('interval')).toBe('month');
  expect(url.searchParams.get('from')).toBe('pricing_pro');
  expect(url.searchParams.get('plan')).toBe('pro');
});

const BANNED = [
  '2 meses gratis',
  'próximamente',
  'beta',
  'coming soon',
  'garantizado',
  'gana dinero',
  'rendimiento',
  'te conviene',
  'copiar automáticamente',
  'mes gratis',
  'equivale',
  'Mejor oferta',
];

function expectNoBannedWords(text: string, where: string) {
  for (const word of BANNED)
    expect(text, `"${word}" in the landing's ${where}`).not.toMatch(
      new RegExp(`(?<![\\p{L}\\d])${word}(?![\\p{L}\\d])`, 'iu'),
    );
  // "apuesta" only inside the two exact legal captions.
  const rest = text.replace(/no es asesoría de apuestas|ni de apuestas/gi, '');
  expect(rest, `"apuesta" outside the legal captions in the ${where}`).not.toMatch(/apuesta/i);
}

test('the visible copy has none of the banned words', async ({ page }) => {
  await page.goto('/');
  // Collapsed FAQ answers count too.
  await page.locator('details').evaluateAll((ds) => ds.forEach((d) => d.setAttribute('open', '')));
  expectNoBannedWords(await page.locator('body').innerText(), 'copy');
});

test('the HTML (with its serialized payload) has none of the banned words', async ({ page }) => {
  await page.goto('/');
  expectNoBannedWords(await page.content(), 'HTML');
});

test('the Señales card says "Informativo, no es asesoría financiera."', async ({ page }) => {
  await page.goto('/');
  const card = page
    .locator('#herramientas li')
    .filter({ has: page.locator('h3', { hasText: /^Señales$/ }) });
  test.skip((await card.count()) === 0, 'Señales is not active');
  await expect(card).toContainText('Informativo, no es asesoría financiera.');
});

test('"Precios en MXN, IVA incluido." under the cards and in the footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#precios')).toContainText('Precios en MXN, IVA incluido.');
  await expect(page.locator('footer')).toContainText('Precios en MXN, IVA incluido.');
});

test('every internal link on / answers below 400', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs, 'no href="#"').not.toContain('#');
  const paths = [
    ...new Set(
      hrefs
        .filter((h) => h.startsWith('/') && !h.startsWith('//'))
        .map((h) => h.split('#')[0] || '/'),
    ),
  ];
  expect(paths.length).toBeGreaterThan(5);
  const broken: string[] = [];
  for (const path of paths) {
    const res = await request.get(path);
    if (res.status() >= 400) broken.push(`${res.status()} ${path}`);
  }
  expect(broken).toEqual([]);
});

test('no Vercel analytics request before consent is accepted', async ({ page }) => {
  const analytics: string[] = [];
  page.on('request', (r) => {
    if (ANALYTICS.test(r.url())) analytics.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  // Interact the way a visitor would: CTAs, the toggle, an FAQ, scrolling.
  await page.locator('#preguntas summary').nth(1).click();
  await page.mouse.wheel(0, 4000);
  await page.waitForLoadState('networkidle');
  expect(analytics).toEqual([]);

  await page.getByRole('dialog').getByRole('button', { name: 'Aceptar todas' }).click();
  await expect.poll(() => analytics.length).toBeGreaterThan(0);
});

test.describe('signed in', () => {
  asRole('free');

  test('the nav says "Abrir Chalyb" and goes to /app', async ({ page }) => {
    await page.goto('/');
    for (const link of [page.locator('.pub-nav__in'), page.locator('.pub-nav__cta')]) {
      await expect(link).toHaveText('Abrir Chalyb');
      await expect(link).toHaveAttribute('href', '/app');
    }
  });
});
