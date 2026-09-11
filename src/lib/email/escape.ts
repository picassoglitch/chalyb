// Tiny HTML escape — used in email templates to keep user input from breaking
// out of the surrounding markup. Five chars cover everything the email
// templates need (no inline event handlers possible because we control all
// attribute scaffolding ourselves).

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
