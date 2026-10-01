// The owner panel keeps its look until P5 (P1-1). Record the baseline once
// against the environment you compare in (the snapshots are gitignored:
// they depend on that environment's data):
//   pnpm e2e e2e/dashboard-visual.spec.ts --update-snapshots
// Later runs must match within 0.1%.

import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

test.describe('as admin', () => {
  asRole('admin');
  test('/dashboard is visually unchanged', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'one baseline, desktop');
    test.skip(
      !existsSync(info.snapshotPath('dashboard.png')) && info.config.updateSnapshots === 'missing',
      'no /dashboard baseline recorded for this environment yet (run with --update-snapshots)',
    );
    await page.goto('/dashboard');
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.001,
      animations: 'disabled',
    });
  });
});
