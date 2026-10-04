# All-pending prompt · final report (§12)

Combined branch: **`claude/rebuild-p6-final`**. It holds every workstream below, stacked on #41 (the redesign stack with prod's `claude/consumption-caps` merged in). Nothing was deployed, `main` was not touched, no migration was applied anywhere, and no MP or Vercel setting was changed.

**Final gates on `claude/rebuild-p6-final`:** typecheck ✓ · lint 0 errors · unit **575/575** · test:legal **172/172** · check:copy ✓ · test:migrations **59 applied twice** · build ✓ · e2e trial flow **ON 469 passed / 0 failed** · e2e flow **OFF 454 passed / 0 failed**.

Every PR from #46 on was reviewed read-only by a second session (picassoglitch-7a). Each finding came back fixed and re-verified, or is listed in §5.

## 1. Workstreams

| WS | Branch | PR | Status | Tests added |
|---|---|---|---|---|
| WS-0 docs + WS-1 Mercado Pago | claude/rebuild-p6a-mp | [#26](https://github.com/picassoglitch/chalyb/pull/26) | ready (stack) | mp-integration, webhook-notification |
| WS-1-H hotfix on main | claude/mp-integration-fixes | [#27](https://github.com/picassoglitch/chalyb/pull/27) | ready | (hotfix suite) |
| WS-2 prices (IVA-included) | claude/rebuild-p6b-prices | [#28](https://github.com/picassoglitch/chalyb/pull/28) | ready | price-rules, pricing |
| WS-3 7-day trial, day-0 notice, hold rule | claude/rebuild-p6c-trial7 | [#29](https://github.com/picassoglitch/chalyb/pull/29) | ready | trial-7d, billing-core |
| WS-4 plan cards | claude/rebuild-p6d-plan-cards | [#31](https://github.com/picassoglitch/chalyb/pull/31) | ready | plan-cards, plan-features |
| WS-5 VIP anual + paid checkout split | claude/rebuild-p6e-vip-year | [#32](https://github.com/picassoglitch/chalyb/pull/32) | ready | vip-year |
| WS-6 price increase (mockup 89) | claude/rebuild-p6f-price-change | [#33](https://github.com/picassoglitch/chalyb/pull/33) | ready | price-change |
| Owner: trial on every plan | claude/rebuild-p6f-trial-every-plan | [#34](https://github.com/picassoglitch/chalyb/pull/34) | ready | trial-7d (updated) |
| WS-7 Pro Lealtad (flag off) | claude/rebuild-p6g-pro-lealtad | [#35](https://github.com/picassoglitch/chalyb/pull/35) | ready | pro-lealtad |
| WS-8 refunds and chargebacks | claude/rebuild-p6h-refunds-chargebacks | [#36](https://github.com/picassoglitch/chalyb/pull/36) | ready | refunds-chargebacks |
| WS-9 A Mi plan | claude/rebuild-p6i-fix3 | [#37](https://github.com/picassoglitch/chalyb/pull/37) | ready | fix3-pages, e2e fix3 |
| WS-9 B Mis créditos | claude/rebuild-p6i-fix3-b | [#38](https://github.com/picassoglitch/chalyb/pull/38) | ready | fix3-pages, e2e fix3 |
| MP quality (other session) | claude/mp-quality | [#39](https://github.com/picassoglitch/chalyb/pull/39) | ready | mp quality suite |
| WS-9 C Mi perfil | claude/rebuild-p6i-fix3-c | [#40](https://github.com/picassoglitch/chalyb/pull/40) | ready | fix3-pages, e2e perfil-idioma-sesion |
| Prod integration | claude/rebuild-p6-integrate-prod | [#41](https://github.com/picassoglitch/chalyb/pull/41) | ready | billing-core (merged cases) |
| WS-12 legal pages + release gate | claude/rebuild-p6-legal-release | [#43](https://github.com/picassoglitch/chalyb/pull/43) | ready | legal, release-gate, e2e legal |
| WS-13 leftovers | claude/rebuild-p6-leftovers | [#44](https://github.com/picassoglitch/chalyb/pull/44) | ready (draft; e2e covered by the final run) | leftovers, env-example |
| WS-10 landing | claude/rebuild-p6j-landing | [#45](https://github.com/picassoglitch/chalyb/pull/45) (+[#42](https://github.com/picassoglitch/chalyb/pull/42) merged in) | ready | landing, e2e landing, public-site |
| Billing review fixes | claude/rebuild-p6-billing-fixes | [#46](https://github.com/picassoglitch/chalyb/pull/46) | ready | billing-fixes |
| WS-11 tools inside the app | claude/rebuild-p6k-tools | [#47](https://github.com/picassoglitch/chalyb/pull/47) | ready | tools-*, e2e tools/no-leaks |
| WS-12/13 review fixes | claude/rebuild-p6-legal-fixes | [#48](https://github.com/picassoglitch/chalyb/pull/48) | ready | legal (+gate/amount cases) |
| Old P6: ARCO, takedown, change emails, retention | claude/rebuild-p6-legal-p6 | [#49](https://github.com/picassoglitch/chalyb/pull/49) | ready | legal-takedown, legal-notices |
| WS-10 perf + review fixes | claude/rebuild-p6j-landing-perf | [#50](https://github.com/picassoglitch/chalyb/pull/50) | ready | landing (C4 claims) |
| WS-10 globals.css off public routes | claude/rebuild-p6j-landing-perf2 | [#51](https://github.com/picassoglitch/chalyb/pull/51) | merged into final | e2e menu |
| Legal residuals + #49 HIGHs | claude/rebuild-p6-legal-residuals | [#52](https://github.com/picassoglitch/chalyb/pull/52) | merged into final | notice/removal cases |
| #49 review PR B | claude/rebuild-p6-legal-49b | [#53](https://github.com/picassoglitch/chalyb/pull/53) | ready | retention v2, claim/give-up (Postgres) |
| Takedown hardening | claude/rebuild-p6-legal-takedown | [#54](https://github.com/picassoglitch/chalyb/pull/54) | merged into final | takedown-hardening |
| Final integration | claude/rebuild-p6-final | this PR | ready | terms-pending-publish, public-client-namespaces |

**Merge order:** #27 on main, independently. The stack goes #26 → #41 in order, then the final PR, which carries everything after #41. Merging only #41's children one by one also works, but they were integrated and tested together here.

## 2. Flags and config

The authoritative list, with every default and a one-line comment, is **`.env.local.example`** (79 entries); `tests/env-example.test.ts` fails if any variable read under `src/` is missing from it. Feature flags in `src/lib/config/flags.ts` (generated from the code):

| Env var | Default | Read by | Used in |
|---|---|---|---|
| `CFDI_ENABLED` | false | `cfdiEnabled()` | components/app/billing/mi-plan-view.tsx |
| `CHARGEBACK_CLOSE_AFTER_DAYS` | see code | `chargebackCloseAfterDays()` | lib/billing/disputes-server.ts |
| `CHARGEBACK_MEASURES_ENABLED` | false | `chargebackMeasuresEnabled()` | lib/billing/subscription-store.ts, lib/billing/disputes-server.ts |
| `CHARGEBACK_REFUSE_NEW_SUBSCRIPTIONS` | false | `chargebackRefuseNewSubscriptions()` | lib/billing/start-subscription.ts |
| `E2E_LEGAL_DRAFTS_AS_PUBLISHED` | false | `legalDraftsAsPublished()` | components/legal/legal-doc-page.tsx |
| `E2E_USE_MOCK_ADAPTERS` | false | `mockAdaptersAllowed()` | — |
| `FREE_INCLUDES_CLIPS` | true | `freeIncludesClips()` | lib/billing/entitlement.ts, lib/billing/plans-props.ts |
| `LEALTAD_ENABLED` | false | `lealtadEnabled()` | components/app/billing/mi-plan-view.tsx, app/api/billing/change/route.ts (+5) |
| `LEALTAD_OPEN_TO_NEW_CUSTOMERS` | true | `lealtadOpenToNewCustomers()` | components/app/billing/mi-plan-view.tsx, app/api/billing/change/route.ts (+5) |
| `LEALTAD_RETURN_WINDOW_DAYS` | see code | `lealtadReturnWindowDays()` | lib/billing/start-subscription.ts |
| `LEGAL_PUBLISH` | false | `legalPublishRequested()` | — |
| `MP_PAUSE_IN_TRIAL_VERIFIED` | false | `mpPauseInTrialVerified()` | app/api/cron/billing/route.ts |
| `MP_PREAPPROVAL_AMOUNT_PUT_VERIFIED` | false | `mpPreapprovalAmountPutVerified()` | lib/billing/price-change-server.ts, lib/billing/lealtad-server.ts |
| `NODE_ENV` | see code | `mockAdaptersAllowed()` | — |
| `PAID_CHECKOUT_ENABLED` | false | `paidCheckoutEnabled()` | components/app/billing/mi-plan-view.tsx, components/app/billing/free-plan.tsx (+9) |
| `PAID_CHECKOUT_ENABLED` | false | `paidCheckoutRequested()` | instrumentation.ts |
| `PARTNER_PROGRAM_TERMS_URL` | unset (null) | `partnerProgramTermsUrl()` | — |
| `PLAN_FEATURE_CLIP_LIMITS_ENFORCED` | false | `planFeatureClipLimitsEnforced()` | lib/billing/plans-props.ts |
| `PRICE_INCREASE_NOTICES_ENABLED` | false | `priceIncreaseNoticesEnabled()` | lib/billing/price-change-server.ts |
| `PRICE_INCREASE_NO_ANSWER` | see code | `priceIncreaseNoAnswer()` | components/app/billing/billing-banner.tsx, app/api/cron/billing/route.ts (+1) |
| `PROFILE_NOTIFICATION_PREFS` | false | `profileNotificationPrefs()` | app/[locale]/(dashboard)/app/settings/perfil/page.tsx, lib/auth/profile-actions.ts |
| `PRO_BADGE_MOST_POPULAR` | false | `proBadgeMostPopular()` | lib/billing/plans-props.ts |
| `PRO_INCLUDES_ALL_TOOLS` | true | `proIncludesAllTools()` | components/tools/tool-locked-state.tsx, app/[locale]/(dashboard)/app/page.tsx (+5) |
| `SUPPORT_SLA_CONFIRMED` | false | `supportSlaConfirmed()` | app/[locale]/(dashboard)/app/help/page.tsx, app/[locale]/(dashboard)/app/settings/page.tsx |
| `SUPPORT_WHATSAPP_URL` | unset (null) | `supportWhatsappUrl()` | app/[locale]/(dashboard)/app/help/page.tsx |
| `TRIAL_DAY6_REMINDER` | false | `trialDay6ReminderEnabled()` | components/app/billing/billing-banner.tsx, app/api/cron/billing/route.ts |
| `TRIAL_FLOW_ENABLED` | false | `trialFlowEnabled()` | components/app/billing/free-plan.tsx, components/tools/tool-locked-state.tsx (+13) |
| `TRIAL_FLOW_ENABLED` | false | `trialFlowRequested()` | instrumentation.ts |
| `TRIAL_PLAN_CHOICE_ENABLED` | true | `trialPlanChoiceEnabled()` | lib/config/settings.ts |
| `USD_MARKET_ENABLED` | false | `usdMarketEnabled()` | lib/billing/price-display.ts |
| `VERCEL_ENV` | see code | `legalDraftsAsPublished()` | components/legal/legal-doc-page.tsx |
| `VERCEL_ENV` | see code | `mockAdaptersAllowed()` | — |
| `VIP_YEAR_ENABLED` | true | `vipYearEnabled()` | components/app/billing/mi-plan-view.tsx, components/landing/json-ld.tsx (+7) |

Other config read outside `flags.ts`: `PRICES_INCLUDE_IVA` (default true), `PCT_ROUNDING`, `SHOW_REFERENCE_PRICE` (false), `REFERENCE_PRICE_SITE`/`_DATE`/`_PROMO_END`/`_UNTIL` (`src/config/pricing.ts`); `MP_ENV`, MP keys and the webhook secret (`src/lib/payments/mp-config.ts`); `QUEBEC_PAID_BLOCK`; `CONSENT_ENCRYPTION_KEY`; `LEGAL_PRIVACY_EMAIL`, `LEGAL_COPYRIGHT_EMAIL`; `TOOL_ALERT_EMAIL`.

## 3. Verified as already fixed on `c163dfd`

WS-1 audited the MP integration against `c163dfd` in [`docs/qa/MP-INTEGRATION-FINDINGS-2026-10-02.md`](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/MP-INTEGRATION-FINDINGS-2026-10-02.md). Items already correct there were kept, with a pinning test rather than a rewrite:
- the signature check is timing-safe and fails closed (`webhook-verify.ts`);
- payments are idempotent through UNIQUE `mp_payment_id`;
- the amount gate refuses a grant on mismatch (`one-off-settlement.ts`).
The B33/B35/B36 gaps (one MP environment per deployment, IPN + merchant_order) were not fixed on `c163dfd`; they are fixed in #27/#26.

## 4. Choices §4 doesn't cover

| Topic | Inputs in conflict | Choice |
|---|---|---|
| Trial scope | Law/Términos §2, LANDING/FIX-3: Pro only, "VIP no tiene prueba" · owner 2026-10-03: any plan, first time | **Owner.** `PRICING.trial.plans` = 4 plans. Copy says "cualquier plan". A legal **publish blocker** stays until Law updates Términos §2/§4.1. |
| Charge notice timing | Prod: last cron run ≥5 d before · owner/Law: day 0 | Day 0 (sent at signup). If it isn't delivered by charge − 5 d, the charge is held. |
| Grace after the trial | Prod 0 · stack's renewal grace | 0 after the trial; renewal grace of 7 d from our own `last_charge_at`. |
| Late in-trial plan switch | No spec | **Owner:** the first charge moves to notice + 5 d (the trial end moves too). |
| Lealtad rounding line | Law requires verbatim text, which says "descuento" without "mes 1" | Kept verbatim; the test exempts that one line; flagged in #35. |
| Extra credits expiry | UI "no vencen" · Términos §9.3 "[VIGENCIA]" | UI shows what the system does ("no vencen"); Law must align §9.3. |
| Card can't be fingerprinted at trial start | Fail open vs closed | Fail closed: `CARD_UNVERIFIED` 409, no silent trial. |
| Dispute measures | §10.6/§10.8 vs attorney sign-off | Built, behind `CHARGEBACK_MEASURES_ENABLED=false` and `CHARGEBACK_REFUSE_NEW_SUBSCRIPTIONS=false`. |
| Landing tool claims | Mockups show "Todo incluido" · C4/C15 | Claims only with `allToolsClaimAllowed()` (off); NoClaim wording otherwise. |
| Landing LCP 2.5 s | §7 target · real paint 0.13–0.37 s | Not met in Lighthouse simulation (≈3.2 s: design-CSS round trips + framework JS); Perf 92, A11y/BP/SEO 100, CLS 0. Documented, not forced via inlineCss (measured worse). |
| Public client messages | — | Public pages ship only their own namespaces (`src/i18n/client-messages.ts`), with a guard test. |
| Terms-change notice | ≥30 d rule vs failed sends | A version applies only after every eligible user got the notice + 30 d; bad addresses give up after 5 tries / 72 h; provider outages never count. |
| Takedown "Retirar" with no Clips adapter (prod) | Hide jobs vs engine | Block + notice from the admin-confirmed normalized link; UI and email say the engine must remove existing clips. |

## 5. OPS and owner items

**Migrations to apply (OPS-2), in order** (prod already has 0046–0050):
`0051_plan_keys_vip_year` → `0052_pro_lealtad` → `0053_refunds_chargebacks` → `0054_profile_prefs` → `0055_legal_p6` → `0056_tool_status` → `0057_subscription_first_charge` → `0058_legal_notices_removals` → `0059_takedown_evidence` → `0060_legal_retention_v2`.

**Before turning money flags on:**
- OPS-4 webhook host.
- OPS-19 MP test accounts.
- OPS-20 amounts check.
- OPS-14 sandbox:
  - amount PUT (Pro Lealtad needs it);
  - pause in the trial;
  - refund API;
  - dispute deadline;
  - Orders `reference_id` + `/v1/orders/{id}/refund` shape (#46 #10);
  - whether MP re-signs retries with a fresh ts (#46 #5).
- OPS-17 accountant: IVA-included totals, CFDI.
- OPS-12 Resend webhook.
- OPS-7 crons:
  - billing daily;
  - `/api/cron/legal` daily 15:30 UTC;
  - **tools-health** needs a sub-daily scheduler (Hobby crons are daily only).

**Launch sequence (OPS-10):**
1. Fill every bracket: 119 left in the drafts, and the build-time gate refuses publishing while any remain.
2. Real `LEGAL_ENTITY_*` (validated: no placeholders, a real RFC shape).
3. Attorney sign-off.
4. `LEGAL_PUBLISH=true` → `PAID_CHECKOUT_ENABLED=true` → `TRIAL_FLOW_ENABLED=true`.

**For Law / the attorney:**
- Términos §2/§4.1 trial plans (now any plan), and the trial-end grace wording in §8 (both are publish blockers).
- §9.3 credits expiry.
- §10.6/§10.8 measures (flags off).
- Pro Lealtad R items.
- Chargeback rows in `audit_events` survive the 72-month purge (`consent_events` must, per the 10-year cobros clause): confirm in Aviso §9.1.
- The claimant IP is stored as an unsalted SHA-256 (pseudonymous; an HMAC would make "never the IP" literal).

**Owner decisions still open:**
- `PRO_YEAR_FIRST_YEAR_PROMO` (O-1, not implemented).
- `PRO_TOOL_SCOPE_ALIGNED` (O-9; tool claims stay off until it's flipped).
- "Más popular" data (O-13).
- Price-increase option (O-2).
- Holiday calendar extras (O-18).
- `LEALTAD_RETURN_WINDOW_DAYS` (O-15).

**Known LOW residuals (not blocking):**
- The AbortSignal isn't threaded through the adapter signatures (needed when real engines land, OPS-13).
- The takedown IP header could prefer `x-vercel-forwarded-for`.
- The tools-health cron's race timers aren't cleared.

## 6. Screenshots (1440 and 390)

| Mockups | Where |
|---|---|
| 40–44 landing | [fold 1440](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/landing/landing-1440-fold.png?raw=true) · [fold 390](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/landing/landing-390-fold.png?raw=true) · [full 1440](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/landing/landing-1440-full.png?raw=true) · [full 390](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/landing/landing-390-full.png?raw=true) |
| 50–62 tools | [`docs/qa/tools/`](https://github.com/picassoglitch/chalyb/tree/claude/rebuild-p6-final/docs/qa/tools) (Clips 50–52, Señales 53–56, En vivo 57–59, Tus herramientas 61; both widths) |
| 70–74 Mi plan, Mis créditos, Mi perfil | [`docs/qa/fix3/`](https://github.com/picassoglitch/chalyb/tree/claude/rebuild-p6-final/docs/qa/fix3) |
| 80–85 plan cards | [anual 1440](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/plans/80-planes-anual-1440.png?raw=true) · [anual 390](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/plans/80-planes-anual-390.png?raw=true) · [mensual 1440](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/plans/81-planes-mensual-1440.png?raw=true) · [mensual 390](https://github.com/picassoglitch/chalyb/blob/claude/rebuild-p6-final/docs/qa/plans/81-planes-mensual-390.png?raw=true) |
| 86–88 Pro Lealtad | Flag off by default. The panel layout was checked at 320/390/1440 during WS-7 (no spill or overflow) but not committed; capture it on a preview with `LEALTAD_ENABLED=true` |
| 89 price change | Behind `PRICE_INCREASE_NOTICES_ENABLED=false`; covered by `price-change.test.ts` (verbatim modal and email) |
