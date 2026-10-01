// E2E harness (rebuild P0-15).
//
// Runs against a local `pnpm start` or a deployed preview:
//   E2E_BASE_URL=https://<preview>.vercel.app pnpm e2e
//
// Role accounts come from env only (E2E_FREE_EMAIL/…_PASSWORD and the Pro,
// VIP, Admin equivalents; optional TRIAL, PRO_ANNUAL, PAST_DUE). A role whose
// variables are missing has its specs skipped with a message, never failed.
// Specs that change billing or engine state run only with E2E_ALLOW_MUTATIONS=1
// against a preview using Mercado Pago sandbox — never against production.

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop-chromium',
      dependencies: ['setup'],
      testIgnore: /smoke\//,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-360',
      dependencies: ['setup'],
      testIgnore: /smoke\//,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 740 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      // "Abrir" must work in WebKit too (P0-1).
      name: 'desktop-webkit',
      dependencies: ['setup'],
      testMatch: /clips-launch\.spec\.ts/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'smoke',
      testMatch: /smoke\/.*\.spec\.ts/,
      dependencies: ['setup'],
      timeout: 12 * 60_000,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
