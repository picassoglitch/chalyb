# Money truth — where every peso on screen comes from

One question, one answer. This is the map, plus the things that are still an
operations problem rather than a code problem.

## The helper

`src/lib/billing/money.ts` (pure) and `src/lib/billing/money-data.ts` (the
query) are the only place these three rules are written down:

| Rule                 | Value                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| What day is "hoy"    | Midnight to midnight in `America/Mexico_City` (`PLATFORM_TIMEZONE`)                        |
| What counts as money | `payments.status` in `approved`, `accredited`, `processed` (`SETTLED_PAYMENT_STATUSES`)    |
| How USD becomes MXN  | `MANUAL_USD_MXN_RATE = 17`, and the surface must print `FX_MANUAL_NOTE` next to the figure |

Everything that shows a "hoy" or "este mes" figure reads it:

- the top metric strip and the activity rail, via `tickStrip` / `tickRail`
  in `src/lib/data/telemetry.ts`
- `/dashboard` (Centro de mando) — "Dinero del mes"
- `/dashboard/billing` (Dinero) — "Dinero hoy", gross, P&L, paying customers
- `/dashboard/revenue` (Ingresos por engine) — "Dinero hoy", "Este mes"
- `/app/billing` — the subscriber's own totals, through the same
  `summariseMoney()`

**If you add a surface that shows money, read the helper.** Do not write
another `SUM(amount_cents)`; that is how the strip came to say $10 while the
revenue card said $0 on the same screen.

### The grant gate is not this

`SETTLED_PAYMENT_STATUSES` decides what a _dashboard_ counts. It never
decides what a payment _buys_. Granting still requires an exact
`status === 'approved'` plus the amount/currency check in
`src/lib/payments/webhook-verify.ts`. Widening the read set cannot widen
entitlements — keep it that way.

## What a `payments` row means

`kind` (migration 0039) names the product:

| `kind`         | What it is                              | What `tier` means on that row                 |
| -------------- | --------------------------------------- | --------------------------------------------- |
| `plan`         | one-off tier purchase (legacy checkout) | the tier bought                               |
| `subscription` | a recurring charge of an MP preapproval | the tier the subscription pays for            |
| `pack`         | a token top-up; the plan is untouched   | the buyer's **current** tier — not a purchase |

Read `kind` before believing `tier`. A pack bought by a Free user is stored
with `tier = 'FREE'`; rendering that as "Plan Free · $149.00" is the bug
migration 0039 exists to stop.

## Verifying a payment end to end

1. Find the row: `select kind, status, amount_cents, currency, created_at
from payments where mp_payment_id = '<MP id>';`
2. `/app/billing` for that user must show it, with a product label matching
   `kind` and a status badge matching `status`.
3. If `created_at` is today in Mexico City, `/dashboard/billing` → "Dinero
   hoy" and the top strip must both include it, and must agree.
4. If it is missing from `/app/billing` but present in the table, the page
   now tells you: a red banner means the read failed (RLS, connectivity),
   not that there are no payments. The reason is in the function logs under
   `[/app/billing]`.

## OPS leftovers — not fixable in code

### 1. The webhook has to be able to write in production

Nothing in this repo can make Mercado Pago deliver. If approved payments are
not producing `payments` rows at all, check, in this order:

- `MERCADOPAGO_WEBHOOK_SECRET` is set on Vercel **and** matches the secret in
  the Mercado Pago dashboard. A missing secret is a deliberate 500 (fail
  closed) — `/api/mp/webhook` logs
  `MERCADOPAGO_WEBHOOK_SECRET is not set`. MP retries for ~3 days, so
  fixing the secret backfills the missed notifications.
- The notification URL registered in the MP dashboard points at
  `https://chalyb.com/api/mp/webhook` (see `docs/payments/mercadopago.md` §5 for the full dashboard checklist).
- `SUPABASE_SERVICE_ROLE_KEY` is present — the webhook writes with the admin
  client and cannot fall back to anything else.
- Vercel function logs for `[mp/webhook]`. A signature rejection is a 401
  and says which check failed.

### 2. Migrations 0039 and 0040 have to be applied

`pnpm db:push`, or paste them into the Supabase SQL editor. Both are
idempotent and re-runnable. Until 0039 runs, the ledger readers fall back to
the pre-0039 column set and rows render without a product label — degraded,
not broken. Until 0040 runs, the five catalogue engines still display their
old `Chalyb*` names.

### 3. The FX rate is manual

`MANUAL_USD_MXN_RATE = 17` is a constant, not a quote. Every surface that
applies it prints `FX_MANUAL_NOTE`. To automate: fetch a daily rate into a
`platform_fx` table and read it in `toMxnCents`, keeping the disclosure
until the fetch is actually running.

### 4. Operating costs are typed in by hand

`MONTHLY_OPERATING_COSTS` in `src/lib/billing/operating-costs.ts` is a
hardcoded list (Anthropic, Supabase, Resend, Vercel). Only the Mercado Pago
commission is computed. The page says so. Real numbers need a job per
provider writing into a `platform_costs` table.

### 5. Revenue cannot be split per engine

`payments` has no `engine_id`, and `engine_health.revenue_cents` — which
`/dashboard/revenue` used to read — is seeded to 0 by migration 0010 and
never written by anything. `/dashboard/revenue` says "no conectado" instead
of showing zeros. To make it real: write `engine_id` on the payment at
checkout (or map plan → included engines) and aggregate on that.
