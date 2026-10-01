# Coverage for `claude-prompt-chalyb-full-rebuild.md` (FINAL)

**Baseline:** `picassoglitch/chalyb` `main` @ `3f27ef3` (merge of PR #18, 2026-09-22 13:06 CT). Re-checked 2026-09-30 21:55 CT: main HEAD is still `3f27ef3`, so every "open" item below is still open on main. Evidence was gathered read-only (GitHub API) and from the QA reports in `/workspace/chalyb-qa/` (→ `docs/qa/`).

## A. QA bugs → phase/fix → proving test
| ID | Bug (source) | Evidence on main | Status | Fix | Proving test |
|---|---|---|---|---|---|
| B01 | "Abrir"/"Abrir prueba" does nothing (QA 09-22 P1) | `engine-launch-button.tsx` awaits `getEngineLaunchUrl` before `window.open`; no null check | open | P0-1 | e2e popup-allowed + popup-blocked; unit null-window |
| B02 | `external_user_id` empty; "Crear tu cuenta" silent (QA 09-22) | `launch-actions.ts` doesn't provision; factory throws English "User has not been provisioned…" | open | P0-2 | unit provision/409/5xx/concurrency; e2e preview |
| B03 | Raw/English/env-name toasts (QA 09-22) | factory errors include `CHALYBCLIP_ADMIN_TOKEN missing`, `slug=…`, "modo placeholder" | open | P0-4 | grep no `err.message` → toast; customer-copy test |
| B04 | Config leak + "configuración quedó incompleta" (QA 09-22; = BUILD-SPEC B2) | `AccessPanel` in `app/engines/[slug]/page.tsx` | open | P0-5, P3-14 | e2e no-leaks Free/Pro/VIP; `SetupState` one-button test |
| B05 | `/app/usage` diagnostic strip (QA 09-22) | `app/usage/page.tsx` warning codes + "revisa los logs de Vercel" | open | P0-6 | e2e no-leaks `/app/usage` |
| B06 | "modo demo"/"Disponible" for Free; card vs page permissions differ (QA 09-22; = BUILD-SPEC B1) | `app/page.tsx` "Prueba los engines en modo demo", "Disponible" badge | open | P0-3, P0-7, P2-1 | `getEntitlements` matrix; text scan "Disponible/Requiere Pro" |
| B07 | Launch not refused server-side | `launch-actions.ts` checks only that the `engine_subscriptions` row exists | open | P0-3, P2-1 | unit entitlement matrix; e2e Free on Pro tool |
| B08 | "ChalyClip"-style names (QA; brand rule) | `display-names.ts`, migrations 0036/0040, `messages/es.json` | open | P0-8 | customer-copy `Chaly[A-Z]`; e2e rendered scan |
| B09 | `/engines` 404 (QA 09-22) | no route/redirect | open | P0-9, P4-3 | e2e 307 then 308 → `/#herramientas` |
| B10 | EN logout in Spanish (QA 09-22) | `sidebar-sign-out.tsx` hardcodes "Cerrar sesión" | open | P0-10 | e2e `/en/app` "Sign out" |
| B11 | Admin sees "Free" on `/app/billing` (QA 09-22) | "Plan activo: {session.tier}" | open | P0-11, P2-12 | e2e Admin |
| B12 | Sitemap/robots non-www (QA 09-22) | `siteUrl()` → `NEXT_PUBLIC_APP_URL` (`https://chalyb.com` in example) | open | P0-12 + OPS-4/11 | unit sitemap/robots origin |
| B13 | No canonical/hreflang (QA 09-22) | layout has no `metadataBase`/`alternates` | open | P0-12, P4-8 | e2e canonical + hreflang |
| B14 | Alias 404s `/planes` `/privacidad` `/terminos` `/sign-up` (QA 09-22) | not in `next.config.ts` / `vercel.json` | open | P0-13 → P2 (SCR-12), P6-1 | e2e aliases |
| B15 | Billing history empty after MP payment (Payments QA 09-17) | webhook + `payments.kind` exist; delivery unverified | verify first | P2-5, P2-12 + OPS-1/4 | sandbox payment → row; replay idempotent |
| B16 | Admin revenue $10 vs $0 | fixed by PR #17 money truth | already fixed | — (P5-3 keeps it) | — |
| B17 | "$10 cobro de prueba" → 1000 tokens copy (Payments QA) | not located in a quick read | verify first | P2-12 | grep + fix or "not reproducible" in PR |
| B18 | Manual money figures / −18,094.6% margin (Admin reframe 09-17) | money strip reworked in PR #17; margin card unverified | verify first | P5-3 | zero/near-zero base unit test |
| B19 | Admin nav overload | PR #17 six items + Labs | already fixed | — (P5 re-maps to BUILD-SPEC 6) | — |
| B20 | Top bar 3 metrics / rail home-only | PR #17 | already fixed | — | — |
| B21 | Fake badges/counts | PR #17 | already fixed | — (P5-7 `ExampleTag`) | — |
| B22 | Dangerous team controls exposed | PR #17 behind "Más" | already fixed | — (P5-2 `ConfirmStep`) | — |
| B23 | Empty states; "+12% vs ayer" at $0 (Admin reframe) | unverified after PR #17 | verify first | P5-1, P5-3 | zero-base delta "—" unit test |
| B24 | Settings read-only vs "settings that save" (Admin reframe) | `/dashboard/settings` read-only on purpose | open | P5-6 (BUILD-SPEC: toggle + tool switch save; rest read-only, Q31) | unit override; e2e toggle |
| B25 | Dinero Pagos/Suscripciones/Costos split (Admin reframe) | partial sub-views on main | verify first | P5-3 | e2e Dinero first-screen answer |
| B26 | EN admin settings chrome in Spanish | fixed `dd205822f` (logout remainder = B10) | already fixed | — | — |
| B27 | non-www → www | Vercel domain 308 live (incl. `/api/*`) | infra, live | — (OPS-4 MP URL) | — |
| B28 | Engine secrets must match | infra | OPS only | OPS-5 | — |
| B29 | Users who see "Abrir" without provisioning | depends on B02 + data | verify first | P0-2 + OPS-6 | e2e preview + reconcile |
| B30 | Billing page jargon, Spanish-only | `app/billing/page.tsx` hardcoded ES, "MP #id", route paths | open | P2-12 | jargon test; parity |
| B31 | Landing claims (sin tarjeta, simulación, 7-day ChalyClip, no IVA) | current landing components/messages | open | P4-1 | customer-copy + price-rule scans |
| B32 | Clips can't be generated on any plan (BUILD-SPEC §4.1 B3, QA 09-30) | no hub job API; no normalized job states; credit debit before success | open | P0-16, P3-2 | mock-adapter e2e all roles; `@smoke` ≥ 3 clips < 10 min; no-debit-on-failure unit |

**Totals:** 32 items: 18 open (B01–B14, B24, B30, B31, B32), 6 verify first (B15, B17, B18, B23, B25, B29), 7 already fixed or infra-only (B16, B19–B22, B26, B27), 1 OPS only (B28). Every open or verify-first item has a fix ID and a proving test.

## B. BUILD-SPEC sections → prompt
| BUILD-SPEC | Prompt |
|---|---|
| §0 rules, §0.1 IVA note, §0.3 no unfinished tools | §1 Hard Rules 7, 13, 14; §4 "Unfinished tools are not shown"; P0-3/P0-7; P3 tool visibility |
| §1 tokens + §1.6 components | §5 (+ AA fixes, Q28) |
| §2 i18n keys | §6.1; every SCR uses BUILD-SPEC keys |
| §3 glossary | §4 glossary |
| §4 Fase 0 (B1–B3, work, acceptance) | P0 (P0-3, P0-5, P0-16; DONE WHEN §4.3) |
| §5 Fase 1 (shell, Inicio, Mi cuenta "Ver mi plan") | P1 (SCR-01/08/07) |
| §6.1–§6.12 Fase 2 (PRICING, price rules, Planes, steps 1–3, Listo, banners, cancel, **§6.10 Mi plan**, emails + bounce rule, acceptance) | P2 (config, P2-1…P2-13, SCR-12…18, SCR-30 six-state table, SCR-E; DONE WHEN §6.12) |
| §7.1–§7.8 Fase 3 (Clips, Señales, En vivo, Más herramientas incl. Asistente/Pronósticos/Inmuebles/Inversiones, Mis resultados, §7.6 states, Ayuda, Avisos) | P3 (P3-1…P3-16, SCR-02…06, 19…26) |
| §8 Fase 4 landing | P4 (SCR-10/11, P4-1…P4-8) |
| §9 Fase 5 panel (27/28/29 + Actividad, Herramientas, Ajustes) | P5 (P5-1…P5-7) |
| §10 Fase 6 legal pages, flows, `consent_events`, final list | P6 (P6-1…P6-9) + P2-2 (table) |
| §11.1–§11.9 legal requirements with automated tests | P2-10, P2 consent, P2-6, P2-7, P3-5, P3-9, P3-10, P3-11, P2-11, P6-9; collected as `test:legal` (P6-10) |
| §12 D1–D12 | §12 Q1 (D1), Q2 (D2), Q5 (D3), Q6 (D4), Q10 (D5), Q16 (D6), Q18 (D7), Q13 (D8), D9 resolved as 6 (P3-2), Q21 (D10), Q22 (D11), Q23 (D12) |
| §13 mockup index + work order | §3 mockup index; §8 phase intro (no real charge before D1, D2 and the attorney's signature) |

## C. REVISION-LEGAL findings → code (or decision)
| Finding | Needs code? | Where |
|---|---|---|
| C1 Señales/Inversiones = general info, not advice | yes | P3-5 (uniform signals, no user data, no copy-trading, disclaimer, affiliations), P3-11 (user-written rules, withdrawal-key rejection, pause); attorney confirmation = Q21/Q33 |
| C2 trial path vs legal package | yes | P2 (checkbox, real amount + period, 7-day notice, cancel visibility); §9-B |
| C3 IVA unconfirmed | config + gate | `PRICES_INCLUDE_IVA`, IVA breakdown, real-charge gate; Q1, OPS-17 |
| A1 liability cap/exclusions | no (text) | Q33 |
| A2 price changes (30 days, express acceptance) | yes | P6-6 |
| A3 notices, bounce rule, annual reminder | yes | P2-6, P2-8, SCR-17, Email 4/5/6 |
| A4 Pronósticos / LFJS | yes | P3-9; Q22, Q23 |
| A5 privacy (simplified notice, automated decisions, 72 months) | yes | P2-4 human review, P6-7 retention job, P6-8 Mis datos + simplified notice |
| A6 LFDA takedown + AI likeness | yes | P3-10 likeness gate, P6-8 takedown + re-upload block; Q35 |
| A7 Quebec | flag | P2-11 `QUEBEC_PAID_BLOCK`; Q2 |
| M1 browsewrap | yes | SCR-13 clickwrap; P6-9 scan |
| M2 review/correct + copy | yes | SCR-15 Resumen with change links; Email 1 with versions + links |
| M3 retention offer | yes | P2-7, SCR-18 |
| M4 Terms changes | yes | P6-5 |
| M5 retiring essential features | partial | P5-5 ConfirmStep; Q34 |
| M6 chargeback suspension | yes | P2-5 |
| M7 seller data + security before paying | yes | P2-13, SCR-15 "Quién vende"; extra security line = Q25 |
| M8 anti-review clauses | test | P6-9 |
| M9 evidence + retention + NOM-151 | yes | P2-2, P6-7; OPS-10 |
| M10 PROFECO registration, M11 NMX | no | OPS-10 |
| M12 PROFECO phones | no (text) | legal docs |
| M13 Inmuebles antilavado | no (Chalyb takes no payments) | P3-12 note; Q33 |
| M14 US, M15 Canada | no | Q33 / OPS-10 |

## D. Owner overrides requested by the parent (all applied)
Price display (real amount + period big; $624 small; no "2 meses gratis"; no strikethrough, only "vs. $8,988 pagando mes a mes" as BUILD-SPEC allows) → P2-10, SCR-12/14/15, SCR-10 · Required unchecked checkbox + evidence log → SCR-15, P2-2, §9-B O2 · Reminders (trial day 23, annual 30 + 7, 7 days before every renewal, bounce hold + alternate channel) → P2-6, P2-8, SCR-17, SCR-E, tests · Cancel always visible next to the offer → P2-7, SCR-18 · Default clips 6 → P3-2, SCR-03 · "Ver mi plan" → SCR-07 · Guardrails with tests → P3-5, P3-9, P3-10, P3-11 · Flags `PRICES_INCLUDE_IVA` (true), `QUEBEC_PAID_BLOCK` (true), `TRIAL_PLAN_CHOICE_ENABLED` (ON) → P2 config; Q1–Q3.

## E. Inputs read for the FINAL version
- `/workspace/chalyb-app-reimagine/BUILD-SPEC.md` (597 lines, 21:33 CT): all sections §0–§13.
- `html/00…30-*.html` (regenerated 21:34) + `style.css`; `mockups/00…30-*.png` incl. `09-overview-completo`; generators `build.py`, `render.py`, `more_shared.py`, `more_public.py`, `more_signup.py`, `more_app.py`, `more_admin.py`, `more_overview.py`.
- `trial-to-paid-path.md` (21:18, Law-corrected): appended verbatim as §9-D (verified byte-equal).
- `legal/README.md`, `terminos-y-condiciones.md`, `terminos-de-suscripcion.md`, `aviso-de-privacidad.md`, `uso-aceptable-y-contenido.md`, `aceptacion-ux.md` (§2–§9 verbatim as §9-C, verified byte-equal; §10–§11 referenced), `REVISION-LEGAL.md` (C1–C3, A1–A7, M1–M15, §5).
- `/workspace/chalyb/claude-prompt-chalyclip-free-trial.md` (older trial prompt; §9-A, overridden per §9-B).
- `/workspace/chalyb-qa/*.md`, `admin-ux/*.png`; repo `main` @ `3f27ef3`.

**Missing inputs at finish:** none. Still open: owner/attorney decisions (§12 Q1–Q35) and the bracket values in the legal texts (OPS-10). Those are decisions and data, not missing specs.
