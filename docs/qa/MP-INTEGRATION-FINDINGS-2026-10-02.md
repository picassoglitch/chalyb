# Chalyb Mercado Pago integration findings — 2026-10-02
Context: trying to run MP's "Medir la calidad de la integración" (needs a TEST-credential Order ID from last 7 days).

## F1 (blocker) — Test/prod credential mixing
Subscription checkout fails with: "Algo salió mal… Una de las partes con la que intentas hacer el pago es de prueba."
Cause: preference/subscription created in one environment while payer account is the other (test token + prod payer, or vice versa). MP blocks it; no test payment completes, so no valid test Order ID is ever generated.
Fix: run the checkout on TEST credentials end-to-end — TEST access token for preference creation AND a test payer account + test card. Keep env consistent; don't let prod token build a preference a test buyer pays.

## F2 — Wrong subscription amount
Rendered checkout showed "Chalyb Pro $868.84 / Total por mes $868.84" instead of the $749/mo price. Test preference is built with the wrong amount. Verify the plan/preference amount source.

## F3 — Webhooks 0% delivery
Developers → Webhooks (Producción, today): "0% Notificaciones entregadas", "No encontramos notificaciones", URL https://chalyb.com/api/mp/webhook. Delivery failing. Verify endpoint reachability, signature handling, and check Test ambiente events too.

Note: the real approved payment (Operación 182026865254, Order checkout_merchant_order-8a9c2069e9a47b05353cffc1cbdcc6c4082e4460) is a legacy Checkout merchant_order, not the newer Orders API — may matter for the quality tool.

---

## 2026-10-03 — Empirical confirmation with user's MP test buyer

Ran the full subscription checkout on live www.chalyb.com as the free QA account, then authorized at Mercado Pago with the user-provided TEST buyer (username TESTUSER416143052555502560) and the MP sandbox Mastercard test card (APRO).

- Chalyb checkout price shown: **$868.84 MXN/mes (IVA incluido)** — confirms F2 ($749 × 1.16). **No free trial was offered** — checkout went straight to a paid monthly charge, so the Apple-style 1-month-free Pro trial is NOT live.
- MP preapproval URL: https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_id=ff79ae72688645a79524d658e2585a57&activation=true
- MP fatal URL: .../checkout/v1/subscription/redirect/841d6e3b-.../fatal/?preference-id=1243156223-b5f37310-...
- MP error (verbatim): **"Algo salió mal… Una de las partes con la que intentas hacer el pago es de prueba."** → confirms F1 (test/prod credential mixing).
- Embedded-card attempt (verbatim): **"Mercado Pago no pudo activar la suscripción: CC_VAL_433 Credit card validation has failed — revisa los datos de la tarjeta o prueba con otra."**
- Result: **no payment / order / subscription confirmation ID issued.** No valid test Order ID can be generated from the live site. Requires a preview build with MP_ENV=test (already in the hotfix prompt).
