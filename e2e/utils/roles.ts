// The QA accounts, from env only (rebuild prompt §7.2). Never inline them.

import { test } from '@playwright/test';

export const ROLES = [
  'free',
  'trial',
  'pro',
  'pro_annual',
  'past_due',
  'cancelled',
  'vip',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

const ENV_PREFIX: Record<Role, string> = {
  free: 'E2E_FREE',
  trial: 'E2E_TRIAL',
  pro: 'E2E_PRO',
  pro_annual: 'E2E_PRO_ANNUAL',
  past_due: 'E2E_PAST_DUE',
  cancelled: 'E2E_CANCELLED',
  vip: 'E2E_VIP',
  admin: 'E2E_ADMIN',
};

export function credentials(role: Role): { email: string; password: string } | null {
  const email = process.env[`${ENV_PREFIX[role]}_EMAIL`];
  const password = process.env[`${ENV_PREFIX[role]}_PASSWORD`];
  return email && password ? { email, password } : null;
}

export function storageStatePath(role: Role): string {
  return `e2e/.auth/${role}.json`;
}

/** Use inside a describe: signs the block in as `role`, or skips it with a
 *  clear reason when that role's account isn't configured. */
export function asRole(role: Role) {
  // Only the credentials decide: the session file itself is written by the
  // setup project, which runs after this is evaluated.
  test.skip(
    !credentials(role),
    `${ENV_PREFIX[role]}_EMAIL/_PASSWORD not set — skipping ${role} specs`,
  );
  test.use({ storageState: storageStatePath(role) });
}

export const mutationsAllowed = () => process.env.E2E_ALLOW_MUTATIONS === '1';
