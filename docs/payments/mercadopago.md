# Mercado Pago — setup and go-live

What the hub sells, which Mercado Pago product each thing uses, and every
step between an empty Mercado Pago account and a real monthly charge. The
code side is already in place; this is the operator's checklist.

## What is sold, and through what

| Product                 | Mercado Pago product                                                | Where it starts                                          | What activates it                                              |
| ----------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Plan Pro / VIP, monthly | **Suscripciones** (`/preapproval`)                                  | `createTierSubscription` in `subscription-actions.ts`    | webhook topic `subscription_preapproval` → status `authorized` |
| Token packs, one-off    | **Checkout Pro via Orders** (`POST /v1/orders`, `type: \"online\"`) | `createTokenPackCheckout` in `token-checkout-actions.ts` | webhook topic `orders` → status `processed`                    |

Why this split and not something else:

- **Subscriptions for the plans.** Pro and VIP are quoted per month and the
  page promises "se cobra solo". Only a preapproval does that: the user
  authorises a card once on Mercado Pago's page and Mercado Pago charges it
  every month, retries failed charges, and pauses the subscription when
  retries run out. Selling a plan as a one-off Checkout Pro payment (what the
  hub did before) means nobody is ever charged a second month.
- **"Sin plan asociado, estado pendiente."** Of the three subscription
  contracts Mercado Pago offers this is the one that needs no card form on
  our side: we create the preapproval with the price and `status: "pending"`
  and redirect to its `init_point`. Mercado Pago hosts the card entry (PCI is
  theirs), and the amount is fixed server-side per user, so there is no
  shared plan object to keep in step with `pricing.ts`.
- **Checkout Pro for packs.** A pack is a top-up, not a plan. Checkout Pro
  gives the buyer every method Mercado Pago supports in Mexico (cards, OXXO,
  SPEI, account balance). Subscriptions are card-only.
- **Via the Orders API, not Preferences.** The application form now offers
  "API de Orders" and "API de Preferences", the latter marked as being
  discontinued. The pack checkout creates an order (`POST /v1/orders`,
  `type: "online"`, `processing_mode: "manual"`) and redirects to its
  `checkout_url`; the webhook reads the `orders` topic. Payments made through
  the old preferences flow still settle through the `payment` topic.
- **Not Checkout Bricks / API.** Embedding the card form buys nothing here:
  the products are two plans and three packs, and hosting the form means
  taking on the PCI questionnaire and 3DS handling for no conversion gain.

Prices live in one place, `src/lib/payments/pricing.ts`, in MXN. The webhook
refuses to grant anything whose charged amount or currency differs from it.

## 1. Create the application

Mercado Pago Developers → **Tus integraciones** → **Crear aplicación**:
https://www.mercadopago.com.mx/developers/panel/app

| Field                                         | Value                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Nombre                                        | `Chalyb` (what the buyer sees on the card-authorisation page)                                          |
| ¿Qué tipo de solución de pago vas a integrar? | **Pagos online**                                                                                       |
| ¿Estás usando una plataforma de e-commerce?   | **No**                                                                                                 |
| ¿Qué producto estás integrando?               | **Checkout Pro**. One application serves both products; the choice only steers the dashboard's guides. |
| Modelo de integración                         | **Soy vendedor** (you collect for yourself, not for other sellers)                                     |

One application, one set of credentials, both products. Do not create a
second application for subscriptions.

If you use the official Claude Code plugin the same thing can be done from
the terminal: `claude plugin marketplace add mercadopago/mercadopago-claude-marketplace`,
`claude plugin install mercadopago@mercadopago-claude-marketplace`, then
`/mp-connect` to sign in and ask it to create the application. It talks to
`https://mcp.mercadopago.com/mcp` over OAuth; that host has to be reachable
from wherever Claude Code runs.

## 2. Credentials

Application → **Credenciales de prueba** first, **Credenciales de producción**
when going live. Two values matter:

- **Access Token** → `MERCADOPAGO_ACCESS_TOKEN`. Server-side only.
- **Public Key** → `MERCADOPAGO_PUBLIC_KEY`. Not used today (only embedded
  checkout needs it); safe to set.

Production credentials are issued once the application passes Mercado Pago's
**Calidad de integración** check and the account has completed its business
verification (**Activar credenciales de producción** in the application).

## 3. Webhook

Application → **Webhooks** → **Configurar notificaciones**:

| Field             | Value                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| URL de producción | `https://chalyb.com/api/mp/webhook`                                                                                                             |
| URL de prueba     | your tunnel or preview URL + `/api/mp/webhook` (see §5)                                                                                         |
| Eventos           | **Orders** (token packs), **Suscripciones** (plans) and **Pagos** (legacy one-off purchases and subscription charges). Nothing else is handled. |

Then **Clave secreta** on the same page → `MERCADOPAGO_WEBHOOK_SECRET`. The
receiver rejects every notification until this is set, on purpose: without
it anyone could POST a payment id and be granted a plan. There is one
secret per application, shared by the test and production URLs.

The receiver validates `x-signature` (HMAC-SHA256 over
`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), then fetches the resource
from Mercado Pago's API and never trusts the notification body. Topics:

| Topic                             | Fetches                         | Effect                                                                          |
| --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `subscription_preapproval`        | `GET /preapproval/{id}`         | `authorized` → tier on; `paused`/`cancelled` → tier ends at `next_payment_date` |
| `subscription_authorized_payment` | `GET /authorized_payments/{id}` | monthly charge → row in `payments`, then re-sync                                |
| `orders`                          | `GET /v1/orders/{id}`           | token pack → tokens once the order is `processed`                               |
| `payment`                         | `GET /v1/payments/{id}`         | legacy one-off tier → tier; a subscription charge → ledger                      |

Retries: the receiver answers `500` only when _our_ side failed (database,
Mercado Pago unreachable) so Mercado Pago retries; anything that cannot be
fixed by retrying (unknown reference, wrong amount) is a `200` with the
reason in the body and a row in the command-center notifications.

## 4. Environment

`.env.local` and Vercel → Project → Settings → Environment Variables:

```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-…      # or TEST-… while testing
MERCADOPAGO_PUBLIC_KEY=…
MERCADOPAGO_WEBHOOK_SECRET=…
NEXT_PUBLIC_APP_URL=https://chalyb.com  # must be HTTPS for subscriptions
```

`NEXT_PUBLIC_APP_URL` is the origin used for the preapproval's `back_url`
and the preference's `back_urls` / `notification_url`. Mercado Pago requires
HTTPS for a preapproval's `back_url`; the subscription button refuses to
start on an `http://` origin and says why.

Apply the migration that backs subscriptions:

```sh
pnpm db:push        # applies supabase/migrations/0036_mp_subscriptions.sql
```

## 5. Testing

Mercado Pago has no sandbox: test credentials run against the production
API with **test users** whose money is not real.

1. Application → **Cuentas de prueba** → create two: a **vendedor** and a
   **comprador** (country México). Mercado Pago gives each an email and a
   password.
2. Sign in to Mercado Pago Developers **as the test vendedor** in a private
   window, open its own application's credentials, and use _that_ access
   token as `MERCADOPAGO_ACCESS_TOKEN` (the test seller is who collects).
   With the official plugin: `/mp-integrate test-setup` does steps 1–2.
3. Sign in to the hub with a Supabase account whose email is the **test
   comprador's** email. A preapproval carries `payer_email`, and with test
   credentials the payer must be a test user, or Mercado Pago answers
   "Both payer and collector must be real or test users".
4. Expose the dev server over HTTPS and point `NEXT_PUBLIC_APP_URL` and the
   test webhook URL at it:
   ```sh
   ngrok http 3000   # then NEXT_PUBLIC_APP_URL=https://<id>.ngrok-free.app
   ```
5. `/app/subscription` → **Pro**. On Mercado Pago's page, log in as the test
   comprador and pay with a test card, cardholder name `APRO`:
   - Mastercard `5474 9254 3267 0366`, CVV `123`, any future expiry
   - Visa `4075 5957 1648 3764`, CVV `123`
   - Cardholder `OTHE` rejects the charge, `FUND` rejects for insufficient
     funds — use these to see the `rejected` path.
6. Watch it land: `/app/billing` shows the charge, `/app/subscription` shows
   the renewal date, `/dashboard/notifications` shows "Suscripción PRO
   activa", and `/api/_diag/mp` (admin) confirms which token is in use.
7. Cancel from `/app/subscription`: Mercado Pago's preapproval goes to
   `cancelled`, the plan stays until the renewal date, then lapses to Free.

Notification delivery history and failures: Application → **Webhooks** →
**Historial** (or `notifications_history` through the plugin).

## 6. Go live

1. Application → **Calidad de integración** → run the check on a real test
   payment; fix what it flags.
2. **Activar credenciales de producción** (business data + identity).
3. Swap the three `MERCADOPAGO_*` values on Vercel for the production ones,
   confirm the production webhook URL and both topics, redeploy.
4. Make one real Pro subscription with a real card, confirm the tier flips,
   then cancel it from `/app/subscription` and confirm the preapproval shows
   `cancelled` in Mercado Pago.

## What to know about the money

- **A cancellation keeps the plan to the end of the paid period.** Cancelling
  tells Mercado Pago to stop, and `profiles.tier_ends_at` is set to the next
  charge date Mercado Pago had scheduled. The plan lapses to Free on that
  date, on read, with no job to fail.
- **A failed monthly charge.** Mercado Pago retries on its own schedule and
  moves the preapproval to `paused` when it gives up. The webhook then ends
  the plan at the missed charge date, which is already past, so access ends
  at once — nothing was paid for. The user reactivates by subscribing again.
- **Upgrading Pro → VIP** authorises a new preapproval; once it is
  `authorized` the hub cancels the old one at Mercado Pago. If that cancel
  fails, a critical notification names the preapproval to cancel by hand.
- **Legacy one-off purchases** (plans bought before subscriptions existed)
  keep working: their tier has no end date and the old `<userId>|<TIER>`
  reference is still honoured by the webhook. They never renew.
- **Refunds and chargebacks** are handled in the Mercado Pago dashboard. The
  `payments.raw` column keeps the full payload for disputes.
