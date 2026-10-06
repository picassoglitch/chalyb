# Launch runbook: taking the rebuild live

How to take `claude/rebuild-p6-final` to production safely, from the code as it is. It covers migrations 0051 → 0060, environment variables, crons, the order in which to turn on the flags (OPS-10), and the Mercado Pago sandbox checks that unlock the rest.

Plain rules for the whole document:
- Nothing here contains a secret. Where a value is a secret, it says so; set it in Vercel → Settings → Environment Variables and nowhere else.
- Vercel reads environment variables when a deployment starts. **Every flag change below needs a redeploy** (Deployments → ⋯ → Redeploy) before it takes effect, and so does every rollback.
- "Fails closed" means: if the value is missing, the feature refuses to run instead of running unsafely.

---

## 0. Go-live checklist (one page)

Tick each line in order. Don't start a line until the one above it is done.

**Before deploying**
- [ ] Production database has 0046–0050 (it does today). Apply **0051 → 0060 in order**, running each pre-check first and each post-check after (§1).
- [ ] `consent_events` is still append-only for the app: §1.11 query returns all `false`.
- [ ] Every "Production: required" variable in §2 is set in Vercel → Production, and the secrets are only there.
- [ ] `NEXT_PUBLIC_APP_URL=https://www.chalyb.com` (OPS-4; www, not the apex).
- [ ] Mercado Pago webhooks point at `https://www.chalyb.com/api/mp/webhook` in both prod and test mode (OPS-4), and the signing secret matches `MERCADOPAGO_WEBHOOK_SECRET`.
- [ ] Resend webhook (delivered, bounced) points at `/api/resend/webhook` with `RESEND_WEBHOOK_SECRET` (OPS-12).
- [ ] The external scheduler for `/api/cron/tools-health` is set (§3), with the `CRON_SECRET` bearer.

**Deploy with every flag off.** Check that:
- [ ] `/legal/terms`, `/legal/privacy` show today's documents; `/legal/subscription` and `/legal/acceptable-use` show the "en revisión" page.
- [ ] The billing and legal crons answer 200 with the secret and 401 without (§3).
- [ ] The Mercado Pago sandbox results table (§5) is filled in on a Preview deployment.

**Turn things on, one step at a time** (§4), checking each step before the next:
- [ ] Legal texts filled and signed → `LEGAL_PUBLISH=true`.
- [ ] `PAID_CHECKOUT_ENABLED=true`.
- [ ] `TRIAL_FLOW_ENABLED=true`.
- [ ] Later, each behind its own condition: `PRICE_INCREASE_NOTICES_ENABLED`, `MP_*_VERIFIED`, `LEALTAD_ENABLED`, `CHARGEBACK_*`.

---

## 1. Migrations 0051 → 0060

Apply in this exact order (Supabase SQL editor, or `npx supabase db push --linked` after `supabase link`). Production already has 0046–0050. Every one of these is idempotent: re-running it changes nothing. `pnpm test:migrations` applies all of them twice to an empty Postgres and checks the key behaviors; run it before applying.

For each: what it does, a **pre-check** (run before; it must return what's shown), a **post-check** (run after) and whether it can be undone.

### 1.1 `0051_plan_keys_vip_year.sql`
Widens the allowed `subscriptions.plan_key` and `pending_plan_key` values to `pro_month, pro_year, vip_month, vip_year, pro_lealtad`.

Pre-check (must return 0 rows; any row would break the new CHECK):
```sql
select id, plan_key, pending_plan_key from public.subscriptions
where (plan_key is not null and plan_key not in ('pro_month','pro_year','vip_month','vip_year','pro_lealtad'))
   or (pending_plan_key is not null and pending_plan_key not in ('pro_month','pro_year','vip_month','vip_year','pro_lealtad'));
```
Post-check (2 rows):
```sql
select conname from pg_constraint
where conname in ('subscriptions_plan_key_check','subscriptions_pending_plan_key_check');
```
Reversible: yes. Re-add the previous CHECK lists. Only safe while no row uses `vip_year` or `pro_lealtad`.

### 1.2 `0052_pro_lealtad.sql`
Adds `subscriptions.loyalty_step` (0–6, default 0), `loyalty_mp_amount_cents` and `loyalty_reset_at`, plus `payments.loyalty_step`. Pro Lealtad stays off behind `LEALTAD_ENABLED`.

Pre-check: none needed (new columns with a default).
Post-check (4 rows):
```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and ((table_name='subscriptions' and column_name in ('loyalty_step','loyalty_mp_amount_cents','loyalty_reset_at'))
  or (table_name='payments' and column_name='loyalty_step'));
```
Reversible: yes (drop the columns). That loses Lealtad history, so only before Lealtad is ever turned on.

### 1.3 `0053_refunds_chargebacks.sql`
Creates `chargebacks` and `account_restrictions` (RLS on: owners read their own rows; only the service role writes), and adds `payments.refund_reason`, limited to the legal cases `legal_7_2_a … legal_7_2_i`.

Pre-check (both `null`, so nothing to collide with):
```sql
select to_regclass('public.chargebacks'), to_regclass('public.account_restrictions');
```
Post-check:
```sql
select relname, relrowsecurity from pg_class where relname in ('chargebacks','account_restrictions');  -- both true
select has_table_privilege('authenticated','public.chargebacks','INSERT');                            -- false
```
Reversible: yes while both tables are empty. After that they are evidence; don't drop them.

### 1.4 `0054_profile_prefs.sql`
Adds `profiles.timezone`, `notify_critical`, `notify_daily` and `notify_viral`. Users may update only these columns (same column grant as 0032). The default `preferred_locale` for NEW rows becomes `es`; existing rows are untouched.

Pre-check: none needed.
Post-check:
```sql
select has_column_privilege('authenticated','public.profiles','timezone','UPDATE');   -- true
select has_column_privilege('authenticated','public.profiles','tier','UPDATE');       -- false (unchanged)
select column_default from information_schema.columns where table_name='profiles' and column_name='preferred_locale';  -- 'es'::text
```
Reversible: yes (drop the columns, revoke the grant, set the default back to `'en'`).

### 1.5 `0055_legal_p6.sql`
Creates `arco_requests` (owners read their own), `takedown_notices` and `blocked_content` (service role only), and `legal_retention_purge(timestamptz)`. 0060 replaces that function.

Pre-check: none needed (new objects).
Post-check:
```sql
select relname, relrowsecurity from pg_class where relname in ('arco_requests','takedown_notices','blocked_content');  -- all true
select has_table_privilege('authenticated','public.takedown_notices','INSERT');                                      -- false
select count(*) from pg_policies where tablename in ('takedown_notices','blocked_content');                        -- 0
```
Reversible: yes while empty. After that it's legal evidence; keep it.

### 1.6 `0056_tool_status.sql`
Creates `tool_status`: one row per tool, written by the health check. It seeds `chalybclip`, `chalybcrypto` and `chalybobs`, and has RLS on with no policies (service role only).

Post-check:
```sql
select slug, state from public.tool_status order by slug;  -- 3 rows, state 'ok'
```
Reversible: yes (drop the table; the tool screens then show no outage state).

### 1.7 `0057_subscription_first_charge.sql`
Adds `subscriptions.first_charge_at`. Rows from before stay `null` and keep today's behavior, so **no current customer loses access on deploy**.

Post-check:
```sql
select count(*) filter (where first_charge_at is null) as old_rows, count(*) from public.subscriptions;  -- old_rows = all existing rows
```
Reversible: yes (drop the column).

### 1.8 `0058_legal_notices_removals.sql`
Creates `legal_change_notices`, the `legal_change_notice_recipients()` function (replaced again in 0060) and `content_removals`. It also adds `takedown_notices.source_url`, `source_fingerprint` and `removed_job_count`.

Post-check:
```sql
select to_regclass('public.legal_change_notices'), to_regclass('public.content_removals');           -- both not null
select has_function_privilege('authenticated','public.legal_change_notice_recipients(text,text,text,uuid,integer)','EXECUTE');  -- false
select has_function_privilege('service_role','public.legal_change_notice_recipients(text,text,text,uuid,integer)','EXECUTE');   -- true
```
Reversible: yes while empty.

### 1.9 `0059_takedown_evidence.sql`
Adds `takedown_notices.claimant_ip_hash` (must be 64 hex characters or null) and `claimant_user_agent` (≤ 500 characters). The IP itself is never stored.

Pre-check: none needed (new columns).
Post-check:
```sql
select column_name from information_schema.columns
where table_name='takedown_notices' and column_name in ('claimant_ip_hash','claimant_user_agent');  -- 2 rows
```
Reversible: yes (drop the columns).

### 1.10 `0060_legal_retention_v2.sql`
- Replaces `legal_retention_purge` with `(timestamptz, boolean)`: it counts 72 months from the chargeback's `opened_at`, adds a dry-run mode, and audits each active restriction it lifts.
- Adds `email_dispatches.attempts` and `first_attempt_at`.
- Adds `claim_notice_dispatch()` (claim, retry, or give up as `undeliverable` after 5 counted tries or 72 hours) and `release_notice_attempt()` (a provider outage doesn't count as a try).
- Replaces `legal_change_notice_recipients()` so `undeliverable` counts as done.
- Adds `legal_change_notices.undeliverable_alert_at`.

0060 has not been applied anywhere yet and was edited in place during review; apply the version on `claude/rebuild-p6-final`.

Post-check:
```sql
select p.oid::regprocedure from pg_proc p where proname in ('legal_retention_purge','claim_notice_dispatch','release_notice_attempt');
-- legal_retention_purge(timestamp with time zone,boolean), claim_notice_dispatch(...), release_notice_attempt(uuid)
select has_function_privilege('authenticated','public.claim_notice_dispatch(uuid,text,text,text,text,integer,interval)','EXECUTE');  -- false
select public.legal_retention_purge(now(), true);  -- dry run: counts only, deletes nothing
```
Reversible: partly. The functions can be re-created from 0055/0058, and the columns dropped. The retention change is the Aviso de privacidad §9.1 reading; don't revert it without the lawyer.

### 1.11 After all of them: the consent log is still append-only
```sql
select has_table_privilege('authenticated','public.consent_events','UPDATE') as auth_update,
       has_table_privilege('authenticated','public.consent_events','DELETE') as auth_delete,
       has_table_privilege('service_role','public.consent_events','UPDATE')  as svc_update,
       has_table_privilege('service_role','public.consent_events','DELETE')  as svc_delete;
-- all four: false (0042 revokes them; a trigger also refuses UPDATE/DELETE)
```

---

## 2. Environment variables

Source of truth: `.env.local.example` (a test, `tests/env-example.test.ts`, fails if the code reads a variable that isn't listed there). Set values in Vercel per environment.

Legend:
- **🔒 secret:** never in code, logs, screenshots or PR text; only in Vercel and your local `.env.local`.
- **⛔ fails closed:** without it, the feature refuses to run.

### 2.1 Must be set before launch

| Variable | Production | Preview | Development | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required | required | required | Not a secret. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | required | required | Public by design. |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | required | required | required | Bypasses RLS: server only. |
| `NEXT_PUBLIC_APP_URL` | `https://www.chalyb.com` | preview URL | `http://localhost:3000` | MP `notification_url`/back URLs, email links, sitemap. Use **www** (OPS-4). |
| `MERCADOPAGO_ACCESS_TOKEN` 🔒 ⛔ | prod pair (`APP_USR-`) | test pair (`TEST-`/test seller) | test pair | Checkout refuses without it (`isCheckoutReady`, `src/lib/payments/mercadopago.ts`). |
| `MERCADOPAGO_PUBLIC_KEY` ⛔ | prod pair | test pair | test pair | Not a secret, but the card form won't render without it. |
| `MERCADOPAGO_WEBHOOK_SECRET` 🔒 ⛔ | required | required | optional | Webhook refuses unsigned or unverifiable calls; checkout refuses without it. |
| `MP_ENV` | `prod` (default on Vercel Production) | `test` | `test` | With `prod`, both credentials must be `APP_USR-`, or checkout refuses (`mpEnvProblems`, `src/lib/payments/mp-config.ts`). |
| `MP_TEST_PAYER_EMAIL` | unset | required when `MP_ENV=test` | same | Test buyer (OPS-19). |
| `MP_EXPECTED_SELLER_ID` | recommended | optional | optional | The token must belong to this seller. |
| `RESEND_API_KEY` 🔒 | required | required | optional | Without it emails are skipped. Legal notices treat that as a provider failure, not the person's (0060), so nobody becomes "undeliverable". |
| `RESEND_WEBHOOK_SECRET` 🔒 | required | required | optional | Delivery/bounce statuses drive the charge-notice hold rule (OPS-12). |
| `CRON_SECRET` 🔒 ⛔ | required | required | optional | Every cron returns 401 without it; it also blocks paid checkout (`paidCheckoutBlockers`, `src/lib/config/flags.ts`). |
| `CONSENT_ENCRYPTION_KEY` 🔒 ⛔ | required | required | required for checkout tests | Encrypts IP/UA in `consent_events`; paid checkout is refused without it. |
| `LEGAL_ENTITY_NAME`, `_RFC`, `_ADDRESS`, `_PHONE`, `_EMAIL`, `_HOURS`, `_COMPLAINTS` ⛔ | required before paid checkout | test values | test values | Seller identity shown before paying. Brackets, TBD/TODO/XXX/PENDIENTE, a malformed RFC or the generic `XAXX010101000`/`XEXX010101000` count as missing (`sellerValueOk`). |
| `LEGAL_EVIDENCE_HASH_KEY` 🔒 | required | recommended | optional | HMAC key for the copyright-notice sender's IP hash (`/api/legal/takedown`). Without it the notice is accepted but stored with no IP hash. 32+ random bytes; changing it breaks matching against old hashes. |
| `SUPER_ADMIN_EMAILS` | your address | your address | your address | Anyone listed is a super admin. |
| `PRICES_INCLUDE_IVA` | `true` | `true` | `true` | Defaults to true in code; set it explicitly (OPS-17). |
| `*_ADMIN_TOKEN`, `*_SSO_SECRET` 🔒 (CHALYBCLIP, CHALYBOBS, CHALYBCRYPTO) | required | required | as needed | Must equal the engine side, or provisioning and SSO launches fail. |
| `TOOL_HUB_MODE_<SLUG>` | `off` unless an engine API exists (`a`) | same | `mock` allowed | `mock` is never allowed on the production deployment; on previews only with `E2E_USE_MOCK_ADAPTERS=1`. |

### 2.2 Recommended

| Variable | Notes |
|---|---|
| `RESEND_FROM_EMAIL`, `RESEND_CONTACT_TO` | Sender and contact inbox (defaults exist). |
| `LEGAL_PRIVACY_EMAIL`, `LEGAL_COPYRIGHT_EMAIL` | Where ARCO requests and copyright notices land (Law's brackets); fall back to the contact inbox. |
| `TOOL_ALERT_EMAIL` | Tool outage alerts; falls back to the contact inbox. |
| `NEXT_PUBLIC_CANONICAL_ORIGIN` | Defaults to `https://www.chalyb.com`. |
| `ANTHROPIC_ADMIN_KEY` 🔒, `ANTHROPIC_USD_TO_MXN` | Owner-panel cost metrics only. |

### 2.3 Flags: all off at launch (see §4 to turn them on)
`LEGAL_PUBLISH`, `PAID_CHECKOUT_ENABLED`, `TRIAL_FLOW_ENABLED`, `PRICE_INCREASE_NOTICES_ENABLED`, `LEALTAD_ENABLED`, `MP_PAUSE_IN_TRIAL_VERIFIED`, `MP_PREAPPROVAL_AMOUNT_PUT_VERIFIED`, `CHARGEBACK_MEASURES_ENABLED`, `CHARGEBACK_REFUSE_NEW_SUBSCRIPTIONS`, `SHOW_REFERENCE_PRICE`, `USD_MARKET_ENABLED`, `TRIAL_DAY6_REMINDER`, `PRO_BADGE_MOST_POPULAR`, `PLAN_FEATURE_CLIP_LIMITS_ENFORCED`, `CFDI_ENABLED`, `SUPPORT_SLA_CONFIRMED`, `PROFILE_NOTIFICATION_PREFS`.

These keep their documented defaults (true): `VIP_YEAR_ENABLED`, `TRIAL_PLAN_CHOICE_ENABLED`, `QUEBEC_PAID_BLOCK`, `PRO_INCLUDES_ALL_TOOLS`, `FREE_INCLUDES_CLIPS`, `LEALTAD_OPEN_TO_NEW_CUSTOMERS`.

**Never set in Production or Preview:** `E2E_LEGAL_DRAFTS_AS_PUBLISHED` (refused on Vercel production anyway), `E2E_USE_MOCK_ADAPTERS`.

---

## 3. Crons

All three use the same check: header `Authorization: Bearer <CRON_SECRET>`, compared in constant time. With no `CRON_SECRET` set, they answer 401 to everyone. Vercel adds the header to its own cron calls automatically when `CRON_SECRET` is set on the project.

| Route | Schedule | Who calls it | What it does |
|---|---|---|---|
| `/api/cron/billing` (`src/app/api/cron/billing/route.ts`) | daily 15:00 UTC (09:00 CDMX), `vercel.json` | Vercel Cron | Charge notices, the bounce hold rule, plan changes taking effect, ending unpaid plans, MP re-sync, the chargeback sweep, pack reconcile. Must run every day (OPS-7). |
| `/api/cron/legal` (`src/app/api/cron/legal/route.ts`) | daily 15:30 UTC, `vercel.json` | Vercel Cron | 1) Counter-notice restores, 2) the 72-month retention purge (`?dry=1` only counts), 3) resends failed ARCO answers, 4) the ≥30-day Terms-change emails (capped at 2,000 per run, throttled, stops before the time limit). |
| `/api/cron/tools-health` (`src/app/api/cron/tools-health/route.ts`) | **every 60 s**, NOT in `vercel.json` | An external scheduler (Vercel Hobby crons are daily only) | One health check per tool the hub runs; alerts the owner after 5 minutes down. |

Set up the tools-health scheduler (any uptime or cron service that can send a header), then check:
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.chalyb.com/api/cron/tools-health                                      # 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" https://www.chalyb.com/api/cron/tools-health   # 200
curl -s -H "Authorization: Bearer $CRON_SECRET" 'https://www.chalyb.com/api/cron/legal?dry=1'   # JSON; retention.dry_run = true
```
Run the `curl` commands from your own terminal with the secret in your shell, never pasted into a document or chat.

---

## 4. Turning the flags on (OPS-10)

Each step: what must be true first, how to turn it on, what to check after, and how to roll back. Every change needs a redeploy.

### Step 1: `LEGAL_PUBLISH=true`
**Before:**
- Every bracket in `docs/design/app-reimagine/legal/*.md` is filled; there are ~119 today.
- A licensed Mexican attorney has signed.
- Each current version is marked `"published": true` with an `effective` date in `src/lib/legal/registry.json`.
- `pnpm legal:hash` has been run and committed.
- `pnpm test:legal --strict` passes.

**The gate:**
- The flag does nothing while any blocker remains (`legalPublishBlockers`, `src/lib/config/flags.ts`).
- The build fails if the flag is on with blockers left (`scripts/legal-publish-gate.mjs`).
- Today's blockers also include the trial being on VIP while Términos de Suscripción §2 says Pro only. Law must align the text, or the config must change.

**After, check:**
- `/legal/subscription` and `/legal/acceptable-use` show the full text, not "en revisión".
- The sitemap lists them.
- Sign-up cites the new documents.
- `LEGAL_BASE_URL=https://www.chalyb.com pnpm test:legal --strict` passes.

**Roll back:** set `LEGAL_PUBLISH=false` and redeploy. Pages go back to the review stub, and paid checkout and the trial switch off with it, because they depend on this flag.

### Step 2: `PAID_CHECKOUT_ENABLED=true`
**Before:**
- Step 1 is live.
- Every `LEGAL_ENTITY_*`, `CONSENT_ENCRYPTION_KEY` and `CRON_SECRET` is set (`paidCheckoutBlockers` must be empty).
- The §5 sandbox results have no ✗ on the paid path.

**After, check:**
- A real-card purchase of Pro mensual on production. The consent row exists, the MP preapproval amount equals the card price, and the webhook marked the subscription authorized.
- Mi plan shows it, and cancel works in 2 clicks.
- Refund it from Dueño → Personas → (the person) → Reembolsar.

**Roll back:** `PAID_CHECKOUT_ENABLED=false` + redeploy. New purchases stop; existing subscriptions keep renewing.

### Step 3: `TRIAL_FLOW_ENABLED=true`
**Before:** step 2 is live. The trial needs paid checkout, and turns itself off without it.

**After, check:**
- A sandbox or real trial: $0 today.
- The day-0 "Aviso de cobro" email arrives with the right date and amount.
- The consent record stores the 7-day trial.
- `/app/billing` shows the trial.
- The next billing cron run lists it.

**Roll back:** `TRIAL_FLOW_ENABLED=false` + redeploy. Running trials keep their dates and notices; no new trials start.

### Later steps (each independent)

| Flag | Turn on only when | Check after | Roll back |
|---|---|---|---|
| `PRICE_INCREASE_NOTICES_ENABLED` | Owner chose (a)/(b) and filled Términos §5.3 (O-2, OPS-23); `PRICE_INCREASE_NO_ANSWER` set to match. | First notices land exactly 30 days before each renewal; the modal shows. | Set false: no new notices. Ones already sent stand and must be honored. |
| `MP_PAUSE_IN_TRIAL_VERIFIED` | §5 test S2 passed. | A bounced trial notice pauses instead of opening an admin item. | Set false: back to admin items. |
| `MP_PREAPPROVAL_AMOUNT_PUT_VERIFIED` | §5 test S1 passed (both lowering and raising). | An accepted price increase changes the next charge. | Set false: changes become admin items again. |
| `LEALTAD_ENABLED` | `MP_PREAPPROVAL_AMOUNT_PUT_VERIFIED` is true, D21 is decided and Law's R items are signed (OPS-24). MXN only. | The Lealtad option shows; a sandbox schedule steps down monthly. | Prefer `LEALTAD_OPEN_TO_NEW_CUSTOMERS=false`: no new customers, and existing schedules and their Mi plan block continue. `LEALTAD_ENABLED=false` also stops new sales, but hides existing customers' Mi plan block; the billing cron keeps charging and stepping their schedules either way. |
| `CHARGEBACK_MEASURES_ENABLED`, `CHARGEBACK_REFUSE_NEW_SUBSCRIPTIONS` | The attorney signed REVISION S.3. | A bad-faith case after the 10-business-day notice restricts the account, and download still works. | Set false: restrictions are ignored at read time (no data change). |

---

## 5. Mercado Pago sandbox procedure

Run on a **Preview** deployment with `MP_ENV=test`, the test seller's credentials, `MP_TEST_PAYER_EMAIL` set to the test buyer, and the test-mode webhook pointing at the preview's `/api/mp/webhook`. Use MP's test cards (holder `APRO` approves). Record every result in the table at the end.

**T1 · Setup (OPS-19)**
1. MP Developers → Cuentas de prueba: create a test seller and a test buyer.
2. Put the seller's access token and public key into the Preview env, with `MP_ENV=test`.
3. Open `/app/subscription` as a normal user. The card form loads.

**T2 · Amounts (OPS-20)**
1. In the MP dashboard (prod and test), confirm Chalyb uses no `preapproval_plan`. List any you find, without editing them.
2. Subscribe to Pro mensual with the trial on. In MP, the preapproval shows `transaction_amount` 997.00 MXN and a `start_date` 7 days ahead.
3. Subscribe to VIP mensual with paid checkout: 3,799.00 MXN, charged today.
4. Confirm existing $749 / $2,499 preapproval amounts are unchanged.

**T3 · Integration quality**
Within 7 days of an approved Order, run MP's "Medir la calidad de la integración" with that Order ID. Note the score.

**S1 · Changing a running preapproval's amount (OPS-14 #1)**
1. `PUT /preapproval/{id}` lowering `auto_recurring.transaction_amount`.
2. Then raise it.
3. For each: is it applied without the payer re-authorizing? Does MP email the payer?

**S2 · Pause during the trial (OPS-14 #2)**
1. Pause a trial preapproval before its `start_date`.
2. Check that no charge happens on the original date.
3. Resume after `next_payment_date`: does it charge now, skip, or set a new date?

**S3 · USD (OPS-14 #3)**
Can the test seller charge in USD?

**S4 · Refund API (OPS-14 #4)**
An admin refund from Dueño → Personas → (the person) → Reembolsar reaches MP and the ledger shows it.

**S5 · Disputes (OPS-14 #5)**
Find MP's chargeback deadline and evidence format for a test dispute. Put the deadline in the PR or the doc (aceptacion-ux §10.5 "VERIFICAR").

**S6 · Orders `reference_id` and refund shape (#46, finding #10)**
1. Pay a credit pack (Orders API).
2. Confirm `transactions.payments[].reference_id` equals the Payments API id of that payment.
3. Make a partial refund through `POST /v1/orders/{id}/refund`. MP accepts the request shape the code sends (from the SDK's `Order.refund` types), and the ledger records it once.

**S7 · Webhook retries re-signed? (#46, finding #5)**
1. Make the preview's webhook answer non-200 once; for example, rotate the secret temporarily.
2. Let MP retry after more than 10 minutes, and check whether the retry carries a fresh `ts` in `x-signature`.
3. If it reuses the old one, the retry is refused as stale (`MP_SIGNATURE_MAX_SKEW_MS`, 10 minutes, in `src/lib/payments/webhook-verify.ts`). Subscriptions are still caught by the billing cron re-sync, and packs by the pack reconcile. Note which it is.

### Results

| Test | Date | Result (✓/✗ + note) | Unlocks |
|---|---|---|---|
| T1 setup | | | everything below |
| T2 amounts | | | Step 2 (paid checkout) |
| T3 quality score | | | (MP certification) |
| S1 amount PUT, lower | | | `MP_PREAPPROVAL_AMOUNT_PUT_VERIFIED` (with S1 raise) |
| S1 amount PUT, raise | | | `MP_PREAPPROVAL_AMOUNT_PUT_VERIFIED`, then `LEALTAD_ENABLED` |
| S2 pause in trial | | | `MP_PAUSE_IN_TRIAL_VERIFIED` |
| S3 USD | | | `USD_MARKET_ENABLED` (plus the accountant, OPS-17) |
| S4 refund API | | | Step 2 confidence; admin refunds |
| S5 dispute deadline | | | `CHARGEBACK_*` (plus the attorney) |
| S6 Orders reference_id + refund | | | Selling credit packs with refunds |
| S7 retries re-signed | | | Nothing to unlock; if ✗, rely on the cron re-sync and pack reconcile (already on) |

Record results in `docs/payments/mercadopago.md` as well (OPS-14), then flip the matching flag (§4) and redeploy.
