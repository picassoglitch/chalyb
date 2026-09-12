# Supabase

Chalyb runs on project **`uqcbziwdgbnzehipzjxp`**
(`https://uqcbziwdgbnzehipzjxp.supabase.co`). This is the **original
production database** — the Nexo AI project under Quantor's Org — with its
users, subscriptions and payments intact. It was never a fresh project.

Nothing in the code names a project. Every reference goes through
`NEXT_PUBLIC_SUPABASE_URL`, so pointing at a different project is config in
three places and no code change at all:

| Where              | What                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `.env.local`       | local dev — copy from `.env.local.example`, add the two keys                             |
| Vercel env         | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| GCP Secret Manager | each engine's `<slug>-database-url` — the engines talk to the same Postgres              |

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS completely. It is server-side only:
never in a client component, never in a `NEXT_PUBLIC_` var.

## Migrations

The database had 0001–0027 applied through the dashboard, never through the
CLI, so the CLI's ledger started empty. The first `db push` therefore re-ran
0001–0009 against a live schema: the `if not exists` guards made most of it a
no-op, but 0002 and 0005 recreated `bots`, `bot_health`, `bot_personas` and
`profiles.selected_bot_id` — tables that had long since been renamed — and
0010 then failed trying to rename `bots` onto the real `engines`.

The one-time repair, already done:

1. `supabase migration repair --status applied 0010 … 0027` (there is no 0021) — tell the ledger what was already there.
2. Drop the four stray objects 0002/0005 recreated.
3. `db push` — applies only 0028 onward.

From here it is normal:

```sh
pnpm install
pnpm supabase login      # once
pnpm db:link             # asks for the DATABASE password — Project Settings → Database
pnpm db:push
```

Filenames are Supabase's applied-migration ledger. Never rename one, and never
squash them: this database has a real history.

## Auth settings that must match

In the dashboard, under Authentication:

- **Site URL** → `https://chalyb.com` (`http://localhost:3000` for local).
- **Redirect allowlist** → the same, plus any preview domains. Auth email
  links are built from these, not from `NEXT_PUBLIC_APP_URL` — that one is
  the app's own public origin (Mercado Pago back_urls, absolute links in email
  the app sends itself, robots and sitemap).
- **Custom SMTP** → Resend, with the sender identical to `RESEND_FROM_EMAIL`.
  If they differ, auth email arrives under one name and app email under
  another. See [`../email/supabase-auth-setup.md`](../email/supabase-auth-setup.md).

## First admin

`SUPER_ADMIN_EMAILS` forces those addresses to `SUPER_ADMIN` regardless of
what the `profiles` row says. It is the backstop that stops a fresh database
from having nobody who can administer it. Sign up normally with that address
and the role is applied on read.
