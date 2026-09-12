# Supabase

Chalyb runs on project **`uqcbziwdgbnzehipzjxp`**
(`https://uqcbziwdgbnzehipzjxp.supabase.co`). This is the **original
production database**, carried over from before the rebrand (it still appears
in the Supabase console under the old organisation and project name, "Nexo AI"
under Quantor), with its users, subscriptions and payments intact. It was never
a fresh project — renaming it in the console is cosmetic and changes no
connection string.

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
  only used for Mercado Pago `back_urls` / `notification_url` and for absolute
  links in email the app sends itself.
- **Custom SMTP** → Resend, with the sender identical to `RESEND_FROM_EMAIL`.
  If they differ, auth email arrives under one name and app email under
  another. See [`../email/supabase-auth-setup.md`](../email/supabase-auth-setup.md).

## First admin

`SUPER_ADMIN_EMAILS` forces those addresses to `SUPER_ADMIN` regardless of
what the `profiles` row says. It is the backstop that stops a fresh database
from having nobody who can administer it. Sign up normally with that address
and the role is applied on read.

## What `profiles` lets a user write

Migration `0032` splits `public.profiles` in two.

**Self-writable**, by the signed-in user over the anon key: `full_name`,
`avatar_url`, `preferred_locale`, `email`, `selected_engine_id`. Row-level
security still scopes every one of those to the caller's own row.

**Service-role only**: `role`, `tier`, `org_id`, `token_bonus_balance`,
`welcome_gift_claimed_at`, `chalybclip_trial_started_at`, `tier_period_end`,
`tier_cancel_at`, and `id` itself. Anything that grants access or money.

Before `0032` the second list was self-writable too — `profiles_update_own`
had no `with check`, so a `PATCH /rest/v1/profiles?id=eq.<me>` with
`{"role":"SUPER_ADMIN","tier":"VIP"}` was simply honoured.

Two layers enforce it: column grants (PostgREST refuses before the table is
touched) and a `BEFORE UPDATE` trigger comparing OLD to NEW. Nothing in the
app changed — every server action that writes a privileged column already used
`createAdminClient()`.

**Adding a column to `profiles`?** It is not self-writable by default, because
`0032` revoked the blanket table grant. Opt it in deliberately:

```sql
grant update (my_new_column) on public.profiles to authenticated;
```

and if it is privileged, add its name to the `v_guarded` array in `0032` so a
re-run of that migration does not hand it back.

## Testing the database rules

```sh
pnpm test:rls                              # boots a throwaway cluster
DATABASE_URL=postgres://… pnpm test:rls    # or run against one you have
```

`supabase/tests/privilege_guard_test.sql` asserts the split above, the
idempotency of `grant_token_pack`, and that a failed token grant leaves no
purchase row behind. Every check raises on failure, so the exit code is the
verdict. It needs `psql`; it does not need the app or Node.
