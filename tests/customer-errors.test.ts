import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CUSTOMER_ERROR_CODES,
  codeForIntegrationFailure,
  isCustomerErrorCode,
} from '@/lib/errors/customer-errors';

const REASONS = [
  'not_configured',
  'engine_error',
  'auth_error',
  'duplicate',
  'network',
  'not_provisioned',
  'db_write_failed',
  'no_integration',
  'missing_profile_email',
  undefined,
  'something new',
];

test('every integration failure maps to a customer code', () => {
  for (const reason of REASONS) {
    for (const phase of ['provision', 'launch'] as const) {
      assert.ok(
        isCustomerErrorCode(codeForIntegrationFailure(reason, phase)),
        `${reason}/${phase}`,
      );
    }
  }
});

test('every code has copy in both locales', () => {
  for (const locale of ['es', 'en']) {
    const m = JSON.parse(
      readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'),
    );
    for (const code of CUSTOMER_ERROR_CODES) assert.ok(m.errors.tool[code], `${locale}: ${code}`);
  }
});

test('the owner-approved Clips provisioning copy is verbatim', () => {
  const m = JSON.parse(readFileSync(new URL('../messages/es.json', import.meta.url), 'utf8'));
  assert.equal(
    m.errors.tool.PROVISION_FAILED_CLIPS,
    'No pudimos preparar tus Clips. Intenta de nuevo en un momento.',
  );
});
