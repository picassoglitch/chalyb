# Supabase Auth → Resend SMTP relay

Right now Supabase Auth emails (signup confirmation, password reset, magic links,
email change, invites) go out from Supabase's default sender — `noreply@mail.app.supabase.io`
or similar. We want them branded under our `chalyb.com` domain via Resend.

On the Free plan there's no HTTP Auth Hook, but Supabase exposes a **custom
SMTP server** setting that routes ALL auth emails through whatever provider
you give it. Resend speaks SMTP, so this is the cleanest path.

> **Time to set up**: ~10 minutes total. Two dashboards, zero code.

## Pre-flight checks

You should already have:

- ✅ Resend account with `chalyb.com` verified (DNS records green)
- ✅ `RESEND_API_KEY` already set on Vercel for the existing contact/payment emails
- ✅ Admin access to your Supabase project dashboard

## Step 1 — Resend: create a domain-scoped sending API key

The same `RESEND_API_KEY` you have today works, but creating a separate key
for Supabase is good hygiene (you can revoke either independently). Optional
but recommended.

1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. **Create API key** → permission **"Sending access"** → domain **`chalyb.com`**
3. Name it `supabase-auth-smtp` so you recognize it later
4. Copy the key — starts with `re_...`. **You only see it once.** Paste somewhere safe.

## Step 2 — Supabase: configure custom SMTP

1. Open your Supabase project → **Authentication** → **Emails** → **SMTP Settings**
2. Toggle **Enable Custom SMTP** ON
3. Fill in exactly:

   | Field                               | Value                                                            |
   | ----------------------------------- | ---------------------------------------------------------------- |
   | **Sender email**                    | `noreply@chalyb.com`                                             |
   | **Sender name**                     | `Chalyb`                                                         |
   | **Host**                            | `smtp.resend.com`                                                |
   | **Port**                            | `465`                                                            |
   | **Username**                        | `resend`                                                         |
   | **Password**                        | the `re_...` key from Step 1 (or your existing `RESEND_API_KEY`) |
   | **Minimum interval between emails** | `1 seconds` (default — fine)                                     |

4. **Save**

That's it for routing. Every auth email from now on will leave Supabase's
backend → hit Resend's SMTP → arrive at the user with `From: Chalyb <noreply@chalyb.com>`.

## Step 3 — Customize the email body templates

The SMTP swap fixes the `From:` header. The email BODY still uses Supabase's
default copy ("Hi there! Confirm your signup..."). To make them match our
brand we paste branded HTML into Supabase's template editor.

In the same screen (**Authentication → Emails**) you'll see **6 template
slots**:

- Confirm signup
- Invite user
- Magic link
- Change email address
- Reset password
- Reauthentication (a 6-digit `{{ .Token }}` code, not a link)

For each one:

1. Click the template name
2. Set **Subject** to the value from `subjects.md` below
3. Paste the matching HTML from `templates/*.html` (this folder)
4. Save

The HTML files use Supabase's Go template variables (`{{ .ConfirmationURL }}`,
`{{ .Email }}`, `{{ .Token }}`, `{{ .SiteURL }}`, etc.). Supabase substitutes
them automatically at send time.

## Step 3.5 — URL Configuration

In **Authentication → URL Configuration**:

- **Site URL**: `https://chalyb.com`
- **Redirect URLs** (add both):
  - `https://chalyb.com/auth/callback`
  - `http://localhost:3000/auth/callback` (for local testing)

These are used by **Google OAuth and signup confirmation**, which legitimately
mint a session via `/auth/callback`.

### Password reset does NOT use `/auth/callback`

Important: the **Reset password** template links straight to our own page with
the raw token:

```
{{ .SiteURL }}/es/reset-password?token_hash={{ .TokenHash }}&type=recovery
```

Clicking it creates **no session** — it just opens the form. The token is
verified (`verifyOtp`) only when the user submits a new password, and we sign
out immediately after. This is deliberate: a reset link must never double as a
silent login into the app. So the reset link does NOT need a redirect-allowlist
entry (it points at the Site URL itself), and it must NOT be left as the default
`{{ .ConfirmationURL }}`, which would route through `/auth/callback` and create
a roaming session.

## Step 4 — Test

1. Use an incognito browser → go to `/sign-in` → request a password reset on
   a real email you own
2. Check your inbox — the email should come from `Chalyb <noreply@chalyb.com>`
   and look like the branded template (dark theme + acid green accent)
3. If it lands in spam: most likely you skipped DKIM verification at Resend
   (Step 0). Open Resend → Domains → check that all 3 records (SPF/DKIM/DMARC)
   show green ticks.

## Why not the HTTP Auth Hook?

Supabase's HTTP-based "Send Email Hook" is **Pro plan only** ([pricing](https://supabase.com/pricing)).
On Free you can use Postgres function hooks but they can't make outbound HTTP
calls without Wrappers extension which is also Pro.

When you upgrade to Pro the cleanest move is to add a `/api/auth-hooks/send-email`
endpoint that uses our existing `templates.ts` directly — that way templates
live in code instead of being copy-pasted into the Supabase UI. For now SMTP
relay is the right trade.

## Troubleshooting

**Symptom**: emails still come from `mail.app.supabase.io`

- Re-check: the "Enable Custom SMTP" toggle has to be **ON** (it's easy to fill
  the fields then forget the toggle).

**Symptom**: emails fail with `535 Authentication failed`

- The username MUST be `resend` (literal string), not your email. The
  password is the `re_...` API key, not your Resend account password.

**Symptom**: emails arrive but the `From` says `onboarding@resend.dev`

- Sender email in Supabase needs to be on a Resend-verified domain. If you
  typed `noreply@chalyb.com` but the domain isn't verified yet, Resend
  rewrites the from address. Verify the domain first.

**Symptom**: emails go to spam

- DKIM record missing or stale. Resend → Domains → chalyb.com → check all
  3 DNS records are green. Some DNS providers cache for 24h.

**Symptom**: rate-limited (Resend returns 429)

- Resend Free is 100/day. For higher volume of auth emails (post-launch),
  upgrade to Pro at Resend ($20/mo, 50k/month).
