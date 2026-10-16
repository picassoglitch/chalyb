// Chalito "Aprobar computadora" (ADR 0028 §3): the desktop app opens
// /app/chalito/computadoras/aprobar#c=<codeId>. The code id lives in the
// fragment, so the hub never receives it (no request to this origin carries
// it), and a signed-out person keeps it across the sign-in round-trip (the
// sign-in page stashes it in this tab; the approval page reads it back).
// Read-only: the code id is made up, so the Chalito api answers "not found".

import { test, expect, type Request } from '@playwright/test';
import { asRole } from './utils/roles';

const CODE_ID = 'e2eHandoffCodeId0123456789ab';
const PATH = '/app/chalito/computadoras/aprobar';

/** Requests to the hub itself (pages, RSC, api routes) whose URL or body has the code id. */
const leaks = (requests: Request[], origin: string) =>
  requests.filter(
    (r) =>
      r.url().startsWith(origin) &&
      (r.url().includes(CODE_ID) || (r.postData() ?? '').includes(CODE_ID)),
  );

test.describe('signed out', () => {
  test('the fragment survives the sign-in redirect, and the hub never sees it', async ({
    page,
    baseURL,
  }) => {
    const requests: Request[] = [];
    page.on('request', (r) => requests.push(r));
    await page.goto(`${PATH}#c=${CODE_ID}`);
    await page.waitForURL(/\/sign-in/);
    expect(new URL(page.url()).searchParams.get('next')).toContain(
      '/app/chalito/computadoras/aprobar',
    );
    const stashed = await page.evaluate(() =>
      window.sessionStorage.getItem('chalito.pairing.handoff.v1'),
    );
    expect(JSON.parse(stashed ?? '{}')).toMatchObject({ codeId: CODE_ID });
    expect(leaks(requests, new URL(baseURL!).origin)).toEqual([]);
  });
});

test.describe('signed in', () => {
  asRole('pro');

  test('opens the approval screen from the link; the hub never sees the code id', async ({
    page,
    baseURL,
  }) => {
    const requests: Request[] = [];
    page.on('request', (r) => requests.push(r));
    await page.goto(`${PATH}#c=${CODE_ID}`);
    // A made-up code: the screen falls back to typing the code, saying why.
    await expect(
      page
        .getByTestId('approve-input')
        .or(page.getByTestId('gate-unpaired'))
        .or(page.getByTestId('activate')),
    ).toBeVisible({ timeout: 30_000 });
    expect(leaks(requests, new URL(baseURL!).origin)).toEqual([]);
  });
});
