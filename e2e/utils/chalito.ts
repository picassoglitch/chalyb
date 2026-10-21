// Chalito's screens need its own api (NEXT_PUBLIC_CHALITO_API_BASE). A mock run (E2E_TOOLS_MODE=mock,
// e2e/mock-supabase) builds the server from this same env; without that base, sign-in can only fail.

import type { Locator, Page } from '@playwright/test';

export const noChalitoApi = () =>
  process.env.E2E_TOOLS_MODE === 'mock' && !process.env.NEXT_PUBLIC_CHALITO_API_BASE;

/** What the screen must end on: `ready` with a Chalito api, else the sign-in error (never "Entrando…" forever). */
export const chalitoScreen = (page: Page, ready: Locator): Locator =>
  noChalitoApi() ? page.locator('[data-testid="chalito-sso-failed"][data-reason="failed"]') : ready;
