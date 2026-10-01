// PR screenshots (rebuild prompt §0.4): every screen a phase touched, at
// 1440px (desktop-chromium) and 360px (mobile-360), per role. Opt-in:
//   E2E_SCREENSHOTS=1 pnpm e2e e2e/screenshots.spec.ts
// Files land in screenshots/<project>/<role>/<page>.png (gitignored).

import { test } from '@playwright/test';
import { asRole, type Role } from './utils/roles';

const PUBLIC = ['/', '/contacto', '/legal/terms'];
const PRIVATE = [
  '/app',
  '/app/herramientas',
  '/app/engines/chalybclip',
  '/app/engines/chalybcrypto',
  '/app/engines/chalybobs',
  '/app/clips',
  '/app/clips/formato?link=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dshot',
  '/app/senales',
  '/app/senales/avisos?coins=BTC,ETH',
  '/app/senales/listo',
  '/app/en-vivo',
  '/app/herramientas/asistente',
  '/app/herramientas/pronosticos',
  '/app/herramientas/inmuebles',
  '/app/herramientas/inversiones',
  '/app/history',
  '/app/help',
  '/app/avisos',
  '/app/billing',
  '/app/usage',
  '/en/app',
];

const shoot = process.env.E2E_SCREENSHOTS === '1';
const name = (path: string) => path.replace(/^\//, '').replace(/\W+/g, '_') || 'root';

test.describe('public', () => {
  test.skip(!shoot, 'E2E_SCREENSHOTS=1 not set');
  for (const path of PUBLIC) {
    test(`shot ${path}`, async ({ page }, info) => {
      await page.goto(path);
      await page.screenshot({ path: `screenshots/${info.project.name}/public/${name(path)}.png`, fullPage: true });
    });
  }
});

for (const role of ['free', 'pro', 'vip', 'admin'] as Role[]) {
  test.describe(role, () => {
    test.skip(!shoot, 'E2E_SCREENSHOTS=1 not set');
    asRole(role);
    for (const path of PRIVATE) {
      test(`shot ${path}`, async ({ page }, info) => {
        await page.goto(path);
        await page.screenshot({ path: `screenshots/${info.project.name}/${role}/${name(path)}.png`, fullPage: true });
      });
    }
  });
}
