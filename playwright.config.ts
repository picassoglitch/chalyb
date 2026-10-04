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

import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Local secrets for e2e runs live in .env.e2e.local (gitignored by .env.*.local):
// the E2E_* accounts, E2E_BASE_URL and, for a protected Vercel preview,
// E2E_VERCEL_BYPASS (Project → Settings → Deployment Protection → Protection
// Bypass for Automation).
if (existsSync('.env.e2e.local')) process.loadEnvFile('.env.e2e.local');

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const bypass = process.env.E2E_VERCEL_BYPASS;

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
    // Lets the runner through Vercel Deployment Protection on previews; the
    // cookie variant keeps it for navigations the header doesn't reach.
    extraHTTPHeaders: bypass
      ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'samesitenone' }
      : undefined,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop-chromium',
      dependencies: ['setup'],
      testIgnore: [/smoke\//, /admin-mutations\.spec\.ts/],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-360',
      dependencies: ['setup'],
      testIgnore: [/smoke\//, /admin-mutations\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 740 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      // Owner-panel actions that change shared state (hide a tool, the
      // Mensual toggle, a gifted month) run once, after every other spec,
      // so no parallel test sees the change (P5).
      name: 'admin-mutations',
      dependencies: ['desktop-chromium', 'mobile-360'],
      testMatch: /admin-mutations\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
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
