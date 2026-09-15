#!/usr/bin/env node
// Push the branded auth email templates (docs/email/templates/*.html), their
// subjects (docs/email/subjects.md) and the Chalyb sender to the Supabase
// project, through the Management API. This is the scripted form of Steps 2
// and 3 in docs/email/supabase-auth-setup.md.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-emails.mjs            # dry run: shows what would change
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-emails.mjs --apply    # writes templates + subjects
//   ... --apply --sender                                                       # also sets sender name/email
//   ... --apply --sender --smtp-pass "$RESEND_API_KEY"                         # also (re)sets the SMTP relay
//   ... --apply --urls                                                         # also Site URL + redirect allowlist
//
// Token: https://supabase.com/dashboard/account/tokens (a personal access
// token, NOT the anon or service-role key). Nothing here is ever logged.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'uqcbziwdgbnzehipzjxp';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

// Slot → { template file, subject }. Subjects mirror docs/email/subjects.md.
const SLOTS = {
  confirmation: { file: 'confirm-signup.html', subject: 'Confirma tu cuenta en Chalyb' },
  invite: { file: 'invite-user.html', subject: 'Te invitaron a Chalyb' },
  magic_link: { file: 'magic-link.html', subject: 'Tu link de acceso a Chalyb' },
  email_change: { file: 'change-email.html', subject: 'Confirma tu nuevo correo en Chalyb' },
  recovery: { file: 'reset-password.html', subject: 'Restablece tu contraseña en Chalyb' },
  reauthentication: {
    file: 'reauthentication.html',
    subject: 'Tu código de verificación de Chalyb',
  },
};

const SENDER = { smtp_sender_name: 'Chalyb', smtp_admin_email: 'noreply@chalyb.com' };
const SMTP = { smtp_host: 'smtp.resend.com', smtp_port: '465', smtp_user: 'resend' };
const URLS = {
  site_url: 'https://www.chalyb.com',
  uri_allow_list: [
    'https://www.chalyb.com/auth/callback',
    'https://chalyb.com/auth/callback',
    'http://localhost:3000/auth/callback',
  ].join(','),
};

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const passIdx = process.argv.indexOf('--smtp-pass');
const smtpPass = passIdx > -1 ? process.argv[passIdx + 1] : undefined;

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    'SUPABASE_ACCESS_TOKEN is not set. Create one at https://supabase.com/dashboard/account/tokens',
  );
  process.exit(1);
}
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(method, body) {
  const res = await fetch(API, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${API} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

// Strip the HTML comment header each template carries for humans; Supabase
// would send it as part of the email body otherwise (invisible, but bytes).
function stripLeadingComment(html) {
  return html.replace(/^\s*<!--[\s\S]*?-->\s*/, '');
}

const desired = {};
for (const [slot, { file, subject }] of Object.entries(SLOTS)) {
  const html = await readFile(join(ROOT, 'docs/email/templates', file), 'utf8');
  desired[`mailer_subjects_${slot}`] = subject;
  desired[`mailer_templates_${slot}_content`] = stripLeadingComment(html);
}
if (args.has('--sender')) Object.assign(desired, SENDER);
if (smtpPass) Object.assign(desired, SMTP, { smtp_pass: smtpPass });
if (args.has('--urls')) Object.assign(desired, URLS);

const current = await api('GET');

const changes = [];
for (const [key, value] of Object.entries(desired)) {
  if (key === 'smtp_pass') {
    changes.push(`${key}: (will be set)`);
    continue;
  }
  const before = current[key] ?? null;
  if (before === value) continue;
  const show = (v) =>
    v == null ? '(unset)' : key.endsWith('_content') ? `${v.length} chars` : JSON.stringify(v);
  changes.push(`${key}: ${show(before)} → ${show(value)}`);
}

// Things this script does not change but that still decide the brand.
const notes = [];
if (
  !args.has('--sender') &&
  current.smtp_sender_name &&
  current.smtp_sender_name !== SENDER.smtp_sender_name
) {
  notes.push(
    `sender name is "${current.smtp_sender_name}" — rerun with --sender to set "${SENDER.smtp_sender_name}"`,
  );
}
if (
  !args.has('--sender') &&
  current.smtp_admin_email &&
  current.smtp_admin_email !== SENDER.smtp_admin_email
) {
  notes.push(
    `sender email is "${current.smtp_admin_email}" — rerun with --sender to set "${SENDER.smtp_admin_email}"`,
  );
}
if (!args.has('--urls') && current.site_url && current.site_url !== URLS.site_url) {
  notes.push(
    `site_url is "${current.site_url}" — {{ .SiteURL }} links use it; rerun with --urls to set "${URLS.site_url}"`,
  );
}
if (current.smtp_host !== SMTP.smtp_host) {
  notes.push(
    `custom SMTP is "${current.smtp_host ?? '(off — Supabase default sender)'}" — pass --smtp-pass "$RESEND_API_KEY" to route through Resend`,
  );
}
for (const key of Object.keys(current)) {
  const v = current[key];
  if (typeof v === 'string' && /nexo/i.test(v) && !(key in desired)) {
    notes.push(`${key} still mentions Nexo: ${JSON.stringify(v).slice(0, 120)}`);
  }
}

console.log(`Project ${PROJECT_REF}`);
console.log(
  changes.length
    ? `\n${changes.length} change(s):\n  ${changes.join('\n  ')}`
    : '\nTemplates and subjects already match.',
);
if (notes.length) console.log(`\nAlso:\n  ${notes.join('\n  ')}`);

if (!apply) {
  console.log('\nDry run. Add --apply to write.');
  process.exit(0);
}
if (!changes.length) process.exit(0);

await api('PATCH', desired);
console.log(
  '\nApplied. Send yourself a password reset from an incognito window to check From, body and links.',
);
