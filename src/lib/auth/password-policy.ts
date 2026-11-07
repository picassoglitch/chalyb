// The one minimum for any password a user sets (sign-up, reset). Supabase Auth's
// own policy (OPS-16) must match it; sign-in stays lenient for older accounts.
export const PASSWORD_MIN_LENGTH = 8;

export type NewPasswordError = 'short' | 'mismatch';

export function checkNewPassword(password: string, confirm?: string): NewPasswordError | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'short';
  if (confirm !== undefined && password !== confirm) return 'mismatch';
  return null;
}
