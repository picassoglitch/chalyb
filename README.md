# Chalyb

A technology team and AI automation platform. HQ in Mexico City.

This is the hub: the public site, the user dashboard, the admin command
center, billing, and the SSO + provisioning contract that every engine speaks.
The engines themselves live in their own repos and deploy to GCP.

## Stack

- Next.js 16 (App Router) + TypeScript, Tailwind v4
- Supabase (Auth + Postgres)
- Mercado Pago (payments), Resend (transactional email)
- next-intl (ES default, EN)
- Vercel hosts the hub; the engines run on Cloud Run

## Local dev

```sh
cp .env.local.example .env.local   # fill from your password manager
pnpm install
pnpm dev
```

`http://localhost:3000` (ES) and `http://localhost:3000/en` (EN).

## How the pieces fit

The hub owns identity, tiers and tokens. An **engine** is a separate product
in its own repo with its own backend; the hub provisions a tenant in it and
signs an HMAC token to log the user straight in.

|                                 |                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/engines/integrations/` | the SSO + provisioning contract. `factory.ts` implements it; `definitions.ts` lists every engine |
| `supabase/migrations/`          | schema. Applied in order — filenames are the ledger, never rename one                            |
| `infra/terraform/`              | the GCP estate: one Cloud Run service per engine, workers, jobs, secrets, budget                 |
| `infra/engine-template/`        | what a new engine repo copies to become deployable                                               |

## Adding an engine

One entry in `definitions.ts`, one in the Terraform `engines` map, one
migration. Start with:

```sh
node scripts/new-engine.mjs chalybscribe "ChalybScribe" --icon 📝
```

Full path, including the new repo and going live:
[`docs/infra/adding-an-engine.md`](docs/infra/adding-an-engine.md).

## Docs

- [`docs/infra/supabase.md`](docs/infra/supabase.md) — which project, standing
  up the schema, and the auth settings that have to match
- [`docs/infra/gcp-migration.md`](docs/infra/gcp-migration.md) — the GCP
  architecture and why each piece is shaped the way it is
- [`docs/infra/adding-an-engine.md`](docs/infra/adding-an-engine.md)
- [`infra/terraform/README.md`](infra/terraform/README.md) — bootstrap and apply
- [`docs/email/`](docs/email/) — Resend + Supabase auth email setup

## State of play

The engines are `coming_soon` in the database and their backends are being
rebuilt on GCP after the self-hosted machine that ran them died. The launch
guard in `src/app/auth/launch/[slug]/route.ts` keeps users out of an engine
that is not serving, so the hub is safe to run while that work lands.
