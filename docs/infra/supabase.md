# Supabase

Chalyb runs on project **`uqcbziwdgbnzehipzjxp`**
(`https://uqcbziwdgbnzehipzjxp.supabase.co`). This is the **original
production database** — the pre-rebrand project under Quantor's Org — with its
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

### Engine migrations land here too (Chalito)

nexo-ai has one ledger (`supabase_migrations.schema_migrations`), and
`supabase db push` refuses when the database holds versions this folder
doesn't. So this repo is the **only writer**: every migration applied to
nexo-ai, the hub's or an engine's, has its file here.

**Chalito** (`picassoglitch/chalito`) writes and tests its migrations in its
own repo (pgTAP and the rehearsal on the local stack), and they reach nexo-ai
**only through a PR to this repo**:

- Copy `supabase/migrations/2026*.sql` from Chalito's `main` **byte for byte**,
  same filenames. Never edit a copy here; a fix is a new Chalito migration.
- Show the checksums in the PR: `sha256sum supabase/migrations/2026*.sql` on
  both sides must be identical.
- Never run `supabase db push` from the Chalito repo against nexo-ai.

Version formats are mixed: the hub's files are four digits (`0001`…), Chalito's
are 14-digit timestamps (`20261004000100`…). The CLI orders versions as
strings, so every hub version sorts before every Chalito one. Consequences:

- A new four-digit hub migration (`0068`) sorts *before* versions already
  applied, so it needs `supabase db push --include-all`. Safe here: Chalito's
  migrations only create the `chalito` and `chalito_private` schemas, their
  roles, `chalito-*` cron jobs and `realtime.messages` policies for `chalito:*`
  topics, and touch no hub table. Better: name new hub migrations with
  `pnpm db:new` (timestamped), and plain `db push` works again.
- `scripts/new-engine.mjs` numbers from the four-digit files only, and
  `pnpm test:migrations` (PGlite) applies only the four-digit files. Chalito's
  need `pg_cron` and `realtime.messages`; they're tested in the Chalito repo.

**Taquito** (`picassoglitch/de-taquitos-a-imperio`) also writes to nexo-ai.
Its 14-digit `taquito_*` files are carried here the same way: byte for byte
from its `main`, only once they match what the ledger recorded.
`20261006090116_lock_chalyclip_public_tables` was applied directly and was in
no repo; its file was recovered from the ledger's stored statements (see its
header).

Four Taquito versions (`20261015004244`, `20261015021851`, `20261015023749`,
`20261015023902`) were applied without their comments. Their files here are
Taquito's `main` as is: the repo is the source of truth, and the SQL is
identical to what ran (comments don't change the schema).

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
