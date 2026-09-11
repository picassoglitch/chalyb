# Supabase

Chalyb runs on project **`uqcbziwdgbnzehipzjxp`**
(`https://uqcbziwdgbnzehipzjxp.supabase.co`) — a fresh project, separate from
anything the old deployment used.

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

## Standing up the schema

The Supabase CLI is a pinned dev dependency, so nothing needs installing:

```sh
pnpm install
pnpm supabase login      # opens a browser for an access token, once
pnpm db:link             # asks for the DATABASE password — Project Settings → Database
pnpm db:push
```

The password prompt at `db:link` wants the Postgres password, not your
dashboard login. They are different, and the error for the wrong one does not
say which it wanted.

The migrations apply in filename order and end in the correct state on an
empty database. Two things about them that look wrong but are not:

- **Several are named `nexoclip` / `nexoobs` / `nexocrypto`.** That is what
  those rows were called when the migrations ran. `0030` renames them to the
  Chalyb slugs. Filenames are Supabase's applied-migration ledger — renaming
  one makes the ledger disagree with the files, so they stay.
- **The engines land as `coming_soon`, not `active`** (`0028`). That is the
  desired end state right now: their backends are still being rebuilt on GCP,
  and the launch guard in `src/app/auth/launch/[slug]/route.ts` keeps users
  out of an engine that is not serving.

### Squashing

Because this project is new, `0001`–`0031` could be collapsed into a single
baseline that creates the final state directly, instead of creating
Nexo-named rows and renaming them two migrations later. Worth doing — but only
while the project is empty. Once `supabase db push` has run, the ledger
records those 31 versions and replacing them means reconciling by hand.

So: squash **before** the first push, or not at all.

## Auth settings that must match

In the dashboard, under Authentication:

- **Site URL** → `https://chalyb.com` (`http://localhost:3000` for local).
- **Redirect allowlist** → the same, plus any preview domains. Auth email
  links are built from these, not from `NEXT_PUBLIC_SITE_URL` — that one is
  only used for absolute links in email the app sends itself.
- **Custom SMTP** → Resend, with the sender identical to `RESEND_FROM_EMAIL`.
  If they differ, auth email arrives under one name and app email under
  another. See [`../email/supabase-auth-setup.md`](../email/supabase-auth-setup.md).

## First admin

`SUPER_ADMIN_EMAILS` forces those addresses to `SUPER_ADMIN` regardless of
what the `profiles` row says. It is the backstop that stops a fresh database
from having nobody who can administer it. Sign up normally with that address
and the role is applied on read.
