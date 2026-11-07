// QA 2026-11-06: sign-up asked for 8 characters while recovery said 6. Every
// screen that sets a password must read the same minimum from one constant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PASSWORD_MIN_LENGTH, checkNewPassword } from '../src/lib/auth/password-policy';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const messages = (locale: string) => JSON.parse(read(`messages/${locale}.json`));

test('the minimum is 8 characters', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
});

test('checkNewPassword: length boundary and confirmation', () => {
  assert.equal(checkNewPassword(''), 'short');
  assert.equal(checkNewPassword('abc123'), 'short'); // the old 6-char minimum
  assert.equal(checkNewPassword('abc1234'), 'short');
  assert.equal(checkNewPassword('abc12345'), null);
  assert.equal(checkNewPassword('abc12345', 'abc12345'), null);
  assert.equal(checkNewPassword('abc12345', 'abc12346'), 'mismatch');
  // Too short wins over mismatch: the user fixes length first.
  assert.equal(checkNewPassword('abc', 'xyz'), 'short');
});

for (const locale of ['es', 'en']) {
  test(`${locale}: password copy takes the minimum from the constant`, () => {
    const auth = messages(locale).auth;
    const keyed = [
      auth.signIn.passwordPlaceholderSignup,
      auth.signIn.passwordHintSignup,
      auth.signIn.errorShortPassword,
      auth.signIn.errorWeakPassword,
      auth.resetPassword.passwordPlaceholder,
      auth.resetPassword.errorWeakPassword,
    ];
    for (const s of keyed) {
      assert.match(s, /\{min\}/, `missing {min}: ${s}`);
      assert.doesNotMatch(s, /\d/, `hardcoded number: ${s}`);
    }
    // The sign-in placeholder is shown to older accounts too: no number at all.
    assert.doesNotMatch(auth.signIn.passwordPlaceholder, /\d/);
    const all = JSON.stringify(auth);
    assert.doesNotMatch(all, /\b6 (caracteres|characters|letras|letters)/);
  });
}

test('auth forms use the shared constant, not a literal length', () => {
  for (const file of [
    'src/components/auth/email-auth-form.tsx',
    'src/components/auth/reset-password-form.tsx',
  ]) {
    const src = read(file);
    assert.match(src, /from '@\/lib\/auth\/password-policy'/, file);
    assert.doesNotMatch(src, /password\.length\s*<\s*\d/, `${file}: literal length check`);
    assert.doesNotMatch(src, /minLength=\{\d+\}/, `${file}: literal minLength`);
  }
});
