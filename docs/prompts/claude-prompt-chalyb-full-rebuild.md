# Chalyb — full rebuild (ONE mega-prompt, shipped in phases)

> 🛑 **READ FIRST · 2026-10-03:** this prompt is now **history/reference**. The prompt Claude runs is `docs/prompts/claude-prompt-chalyb-all-pending.md` (package `all-pending-2026-10-03`, built on `claude/rebuild-p5-admin`). It **supersedes every amount and every trial rule** in this file. Where the two differ, the all-pending prompt wins. See **§UPDATE 2026-10-03** below.

> **Status: FINAL — 2026-09-30 21:50 CT; updated 2026-10-02 with P0-17 (Mercado Pago fixes B33–B35, OPS-19/20).** Built from the complete inputs: `BUILD-SPEC.md` (Fases 0–6, tokens, glossary, §6.10 paid Mi plan, §11 legal requirements with deploy-blocking tests, §12 owner decisions, §13 mockup index), mockups 00–30 (HTML + PNG + `style.css`), `trial-to-paid-path.md` (revised by Law), the Law-edited `legal/` package and `legal/REVISION-LEGAL.md`. **There are no DESIGN PENDING or LEGAL PENDING sections.** What remains open is owner or attorney *decisions*. Each one ships as a flag/config with a documented default and is listed in §12 OPEN QUESTIONS. The legal texts are complete, but they still carry owner values in brackets (`[RAZÓN SOCIAL]`, `[RFC]`…) and need a licensed attorney's signature, so publishing them and enabling real charges are OPS-10, enforced in code by `LEGAL_PUBLISH` + a placeholder gate. Every screen keeps its own `SCR-NN` subsection keyed to its mockup number. **Precedence:** `legal/aceptacion-ux.md` (legal UX) → BUILD-SPEC → mockups → `trial-to-paid-path.md` → the older owner trial prompt (§9-A, superseded where §9-B says so).

Repo: `picassoglitch/chalyb` (branch from `main`; main was verified read-only at `3f27ef3`, 2026-09-22). Live: https://www.chalyb.com. Product: a Spanish-first, all-in-one hub of tools.

---

## §UPDATE 2026-10-03 · what changed (short)

- **Master prompt:** `docs/prompts/claude-prompt-chalyb-all-pending.md` supersedes **every amount and every trial rule** here (P0-17 B34, P2, P4, §9-A…§9-D, §10 B34 row, OPS-3, OPS-20, §12 Q-items about prices or trial length). Phases P0–P5 are built on the stack ending at `claude/rebuild-p5-admin` (`c163dfd`). Old P6 (legal pages + release gate) now runs as all-pending **WS-12**, and the items here that it doesn't override stay as reference.
- **Prices:** `PRICING-CARDS-SPEC.md` is the single source of truth: Pro $997 MXN al mes, Pro anual $9,970 MXN al año, VIP $3,799 MXN al mes, VIP anual $36,325 MXN al año, Pro Lealtad (§15, behind `LEALTAD_ENABLED=false`). These are totals with IVA included (`PRICES_INCLUDE_IVA=true`). No amount is typed by hand.
- **Trial:** **7 days**, Pro mensual and Pro anual only (VIP, VIP anual and Pro Lealtad have none). The charge notice goes out on **day 0** (≥5 days before the charge) with the hold rule (Términos §2.7 bis). The checkout preselects Pro mensual, never the anual. The **30-day / "1 mes" trial is superseded everywhere in this file.**
- **P0-17 B34:** the "$749 / $7,490" expectation is superseded. **The charge must equal the displayed price from the PRICING-CARDS-SPEC config** (`planPrice(planKey).totalCents`). A mismatch fails closed. The B33/B35/B36 MP fixes (MP_ENV, `notification_url`, IPN + `merchant_order`) are still required and live in all-pending WS-1 (they are **not** in the P0–P5 stack).
- **Refunds/chargebacks, price increase, Lealtad:** new rules from Law (`legal/PRICING-2026-10-03-REVISION.md` §R, §S) are in all-pending WS-6, WS-7 and WS-8. Nothing here about chargebacks (e.g. suspending on dispute) applies any more.
- **No tickets:** no Linear or other tickets for Chalyb, ever; documents only.
- Backup of this file before the update: `/workspace/chalyb/_backup-full-rebuild-2026-10-03.md` (box).


## 0. HOW TO RUN THIS PROMPT

1. **Do one phase per PR, in order: P0 → P6 (= BUILD-SPEC Fase 0 → Fase 6).** Branch `claude/rebuild-pN-<slug>`. Don't start a phase until the previous one is merged, unless the phase says it has no dependency.
2. **Start each phase by re-reading:** §1 HARD RULES, the phase section, and the `SCR-NN` subsections and design files it references. Then check the "Verify first" items against the current code. Some bugs may already be fixed by then; if so, skip them and say so in the PR.
3. Every phase ends with the **standard gates** in §7 plus its own **DONE WHEN**. A phase isn't done until every DONE WHEN line is true.
4. The PR description lists: what changed per numbered fix, any migration (file name + what it does), new config keys, new env var NAMES (never values), screenshots at 1440px and 360px for every touched screen, the bug IDs it closes (from §10), and anything deliberately left for OPS (§11).
5. When this prompt and the code disagree about what exists, the code wins. Adapt to it, say how in the PR, and don't invent missing infrastructure silently.
6. This repo runs **Next.js 16.2 + React 19 + next-intl 4 + Supabase + Tailwind v4 + Mercado Pago SDK + Resend + `@vercel/analytics`**. Per `AGENTS.md`: *"This is NOT the Next.js you know"*. Read the relevant guide in `node_modules/next/dist/docs/` before writing routing, metadata, middleware (`src/proxy.ts`) or caching code.

---

## 1. HARD RULES (apply to every phase)

1. **Code only.** No deploys, no production migrations (`pnpm db:push` against prod is OPS), no creating real Mercado Pago plans, no changing secrets or env values on Vercel/Supabase/MP. Use MP sandbox/test credentials and mocks in tests.
2. **Never show env vars, tokens, config keys, table/column names, `admin_api_base`, `[engine_subs]`-style tags, log hints ("revisa los logs de Vercel"), internal error strings or stack traces to customers.** Technical detail goes to server logs only. Server components never pass env values as props to client components.
3. **Don't invent prices, numbers or facts.** Prices, credits, trial length, reminder days and grace days come from config. Where a value is undecided, read it from config with a `TODO(owner)` comment and list it in OPEN QUESTIONS. Never hard-code mockup demo values (María López, 1,200 créditos, "Visa ••4821", "hace 10 minutos", "Encontramos 9", "Noche de preguntas", "+52 55 •••• 4821").
4. **Naming.** "Chalyb" appears in customer UI only as the logo/wordmark and in the product name "Chalyb Pro". The tools are **Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles, Inversiones**. **"ChalyClip", "ChalybClip", "ChalyCrypto", "ChalyOBS", "ChalyBot", "ChalyPicks", "ChalyRealtor", "ChalyTrade", "ChalyStreamManager" and the word "engine(s)" must not appear in customer UI, emails, toasts or page titles.** Internal slugs, routes, env vars, DB values and identifiers stay unchanged (`chalybclip`, `/app/engines/chalybclip`, `CHALYBCLIP_ADMIN_TOKEN`, `engine_subscriptions`). The admin area (`/dashboard`) may keep technical words.
5. **No technical jargon in customer UI:** no "engine", "tier", "SSO", "token(s)" (customer word is **"créditos"**), "slug", "placeholder", "webhook", "simulación/modo demo", "MP #<id>", raw route paths like "/app/subscription", "FX", or English error strings.
6. **Spanish first.** Every customer string lives in `messages/es.json` with an EN counterpart in `messages/en.json` (the §6.1 parity test enforces it). Legal documents are Spanish. Dates are shown in America/Mexico_City, written out ("30 de octubre de 2026", never 30/10/26). Amounts are shown as "$7,490 MXN". Stored timestamps are UTC.
7. **Prices are IVA incluido** (`PRICES_INCLUDE_IVA=true` by default; owner/accountant confirmation is Q1, and the displayed totals switch via config only). Every price shown to a customer (landing, Planes, plan picker, card step, Mi plan, receipts, emails) is followed by "MXN, IVA incluido", or sits in a block that says "Precios en MXN, IVA incluido." **This includes places where a mockup omits it** (07 Mi cuenta, 30 Mi plan).
8. **Reuse, don't rebuild.** Reuse the existing MP client (`src/lib/payments/*`), the webhook route `src/app/api/mp/webhook/route.ts` with `webhook-verify.ts` (signature checked against `MERCADOPAGO_WEBHOOK_SECRET`), the `payments` table with `payments.kind` (migration 0039), the money source of truth (`src/lib/billing/money.ts` / `money-data.ts`, `summariseMoney`, the "dinero hoy" helper used by the strip; see `docs/payments/money-truth.md`), Supabase auth (`src/components/auth/*`), Resend (`src/lib/email/resend.ts`, `templates.ts`), audit logging (`src/lib/audit/log.ts`), engine integrations (`src/lib/engines/integrations/*`) and next-intl.
9. **Migrations:** at most one new numbered migration per phase, named with the next free number after the latest on `main` (0040 at verification time, so expect 0041 for P0). Each must be idempotent and re-runnable, like 0039/0040. List it in the PR and in §11 OPS.
10. **No unrelated refactors.** Touch only what a numbered fix names. The admin `/dashboard` keeps its current look until P5, which moves its six BUILD-SPEC routes onto the app design system (BUILD-SPEC §9 "Mismo sistema visual").
13. **Owner decisions are flags/config, never hardcoded** (`PRICES_INCLUDE_IVA`, `QUEBEC_PAID_BLOCK`, `TRIAL_PLAN_CHOICE_ENABLED`, `TRIAL_CONSENT_ALSO_ON_PLAN_STEP`, `TRIAL_DAY29_REMINDER_ENABLED`, `PRO_INCLUDES_ALL_TOOLS`, `FREE_INCLUDES_CLIPS`, `PRICING.credits`, `SUPPORT_SLA_CONFIRMED`, `CFDI_ENABLED`, `PARTNER_PROGRAM_TERMS_URL`, …). Each one is listed in §12 with its default.
14. **Legal guardrails are deploy-blocking tests** (BUILD-SPEC §11: "cada punto tiene una prueba automática"). They're collected in the `test:legal` CI job (P6-10).
11. **Never inline credentials.** E2E accounts come from env vars (§7.2). Never commit `.env*` values.
12. **Ask instead of guessing** on anything listed in OPEN QUESTIONS that blocks a fix: implement the documented default, mark it `TODO(owner)`, and call it out in the PR.

---

## 2. REPO FACTS (verified read-only on `main` @ `3f27ef3`; re-check before relying on them)

- **Routing:** `src/app/[locale]/...` with next-intl `localePrefix: 'as-needed'` (es unprefixed, `/en/...`). The subscriber app is under `(dashboard)/app/*`: `page.tsx` (home), `engines/`, `engines/[slug]/`, `billing/`, `subscription/` (+ `checkout/`, which hosts the MP Card Payment Brick on its own page; see PRs #15/#16), `usage/` (+ `checkout/`), `history/`, `messages/`, `settings/`, `help/`. The admin area is under `(dashboard)/dashboard/*`. Auth lives at `(auth)/sign-in` (sign-up is `?mode=signup`), `forgot-password` and `reset-password`. Public pages: `/`, `/contacto`, `/legal/terms`, `/legal/privacy`, `/health`.
- **Redirects:** `next.config.ts` has `/login`, `/register`, `/signup`, `/pricing`, `/precios` and `/contact`; `vercel.json` has `/terms` → `/legal/terms` and `/privacy` → `/legal/privacy`. There is **no** `/sign-up`, `/planes`, `/terminos`, `/privacidad` or `/engines`.
- **SEO:** `src/app/robots.ts` and `src/app/sitemap.ts` read `siteUrl()` → `appUrl()` → `NEXT_PUBLIC_APP_URL`, which `.env.local.example` says to set to `https://chalyb.com` (non-www). That is why robots/sitemap point at non-www. `src/lib/site.ts` `PUBLIC_PATHS = ['/', '/contacto', '/legal/terms', '/legal/privacy']`. `src/app/[locale]/layout.tsx` sets the title template and description, but no `metadataBase`, canonical or hreflang alternates. OG/Twitter images come from file conventions. Live check (2026-09-30): `https://chalyb.com/*` already **308 → `https://www.chalyb.com/*`, including `/api/*`**; there are no canonical tags.
- **Analytics:** `@vercel/analytics` is installed and `<Analytics />` is mounted in the locale layout. There are no custom events yet.
- **Engines:** the display-name source is `src/lib/engines/display-names.ts`, which currently maps to "ChalyClip", "ChalyOBS", "ChalyCrypto", etc. (the convention from PR #17 / migrations 0036 and 0040). That convention conflicts with Hard Rule 4 and P0 replaces it. The slug → tool mapping is in §4.
- **Launch:** `src/components/workspace/engine-launch-button.tsx` awaits the server action `getEngineLaunchUrl` and *then* calls `window.open`, so the popup is blocked and nothing is reported. `src/lib/engines/launch-actions.ts` checks only that an `engine_subscriptions` row exists (there is no entitlement check) and returns raw errors (`slug=…`, "modo placeholder", "/app/engines"). `integrations/factory.ts` error strings contain env var names (`CHALYBCLIP_ADMIN_TOKEN missing`) and English ("User has not been provisioned in ChalyClip yet"), and they reach the toast.
- **Leaks:** `app/engines/[slug]/page.tsx` → `AccessPanel` renders `…_ADMIN_TOKEN`, `CHALYB_ADMIN_TOKEN`, `engines.admin_api_base`, `[engine_subs]` and "La configuración quedó incompleta". `app/usage/page.tsx` renders a diagnostic strip with warning codes and "revisa los logs de Vercel". `app/page.tsx` says "Prueba los engines en modo demo" and shows "Disponible" to Free users.
- **Billing UI:** `app/billing/page.tsx` already surfaces read failures and labels rows by `kind` (PR #17), but shows "Plan activo: {session.tier}" (admins show "Free"), "MP #id" and route paths, and is Spanish-only hardcoded.
- **Sign-out:** `src/components/dashboard/sidebar-sign-out.tsx` hardcodes "Cerrar sesión" (title/aria-label), so EN users see Spanish. `src/components/auth/sign-out-button.tsx` is already i18n'd.
- **Admin:** already reframed in PR #17 (commit `c3fe15bc`): six primary items (Centro de mando, Personas, Dinero, Engines, Actividad, Ajustes) plus a "Labs" group, a 3-metric strip, the rail only on Centro de mando, real badge counts, and risky Personas actions behind "Más". `src/components/dashboard/nav-data.ts`.
- **Tests:** `pnpm test` runs node's test runner (`--experimental-strip-types`) over `tests/*.test.ts`. There is **no** e2e framework and **no** typecheck script (use `pnpm tsc --noEmit`). Locale parity logic exists only inside the one-shot `scripts/port-locales.mjs`.
- **Scheduled jobs:** there are **no** crons in `vercel.json` and no job runner. Anything scheduled must be added (see P2).
- **Existing trial-like features** that collide with the new trial: a 7-day "ChalyClip trial" plus post-trial "grace" (`isChalybclipTrialActive`, `isChalybclipGraceActive` in `src/lib/billing/tiers.ts`; migration 0025), a welcome gift of 50,000 tokens (`welcome-gift-banner.tsx`), and landing copy "ChalyClip gratis 7 días", "Sin tarjeta de crédito". See OPEN QUESTION Q8.
- **Entitlements today:** Pro = **1 live engine of the user's choice**, VIP = all (`TIER_CAPS`, `engineIsLiveForUser`). The new product copy says Pro = **all 7 tools**. See OPEN QUESTION Q7, which blocks P2.
- **MP subscriptions today:** monthly preapprovals for Pro/VIP (`subscription-actions.ts`, `subscription-sync.ts`, migration 0037), plus token packs via the Orders API. `pricing.ts` has PRO 74,900 and VIP 249,900 centavos.

---

## 3. INPUTS AND WHERE THEY LIVE IN THE REPO

Claude Code can't see the owner's machine. **OPS-0 (§11) copies these folders into the repo before P0**, and this prompt refers only to the repo paths:

| Repo path (after OPS-0) | Contents | Status |
|---|---|---|
| `docs/design/app-reimagine/html/*.html` + `style.css` | Static HTML/CSS of every screen. **Source of truth for structure, copy and tokens.** | 00–30 present |
| `docs/design/app-reimagine/mockups/*.png` | Renders of the HTML (1440×900 desktop, 390×844 phone) | 00–30 present |
| `docs/design/app-reimagine/{build.py,more_shared.py,more_public.py,more_signup.py,more_app.py,more_admin.py,more_overview.py,render.py}` | Generators; `more_shared.py` holds the shared components (banners, chips, pills, disclosure box, tool colors) | present |
| `docs/design/app-reimagine/trial-to-paid-path.md` | UI/UX trial path, revised by the legal review (checkbox required, $7,490 lead, "Ahorras $1,498 al año", 7-day reminder + bounce rule, completed emails) | present |
| `docs/design/app-reimagine/legal/*.md` | `README`, `terminos-y-condiciones`, `terminos-de-suscripcion`, `aviso-de-privacidad`, `uso-aceptable-y-contenido`, `aceptacion-ux` (internal, governs legal UX), `REVISION-LEGAL.md` (findings C1–C3, A1–A7, M1–M15; not legal advice) | present, **Law-revised** (complete texts; owner values in brackets and the attorney signature are OPS-10) |
| `docs/design/app-reimagine/BUILD-SPEC.md` | Rules §0, tokens §1, i18n §2, glossary §3, Fases 0–6 (§4–§10) with per-screen route/components/copy/states/acceptance, §11 legal requirements, §12 owner decisions D1–D12, §13 mockup index | **complete** |
| `docs/specs/trial-billing-spec.md` | The older owner trial prompt (source of §9-A) | **superseded** where §9-B says so |
| `docs/qa/*.md`, `docs/qa/admin-ux/*.png` | QA reports and admin screenshots (2026-09-17/22) | present |

**Mockup index** (use these numbers in commits and PRs):
00 overview (base) · 01 Inicio · 02 Clips paso 1 · 03 Clips paso 2 · 04 Clips creando · 05 Clips listos · 06 Opciones avanzadas · 07 Mi cuenta · 08 Inicio móvil · 09 overview completo (index of 01–30) · 10 Landing · 11 Landing móvil · 12 Planes · 13 Crear cuenta · 14 Tu prueba · 15 Pago · 16 Listo · 17 Banners · 18 Cancelar · 19 Mis resultados · 20 Señales paso 1 · 21 Señales listo · 22 En vivo · 23 Más herramientas (incl. Gratis state) · 24 Vacío y error · 25 Ayuda · 26 Avisos (notificaciones, móvil) · 27 Admin Centro de mando · 28 Admin Personas · 29 Admin Dinero · 30 Mi plan (paid).

---

## 4. NAMING MAP AND GLOSSARY

| Slug (unchanged) | Customer name | Status today | Tool color (from `more_shared.py`) |
|---|---|---|---|
| `chalybclip` | **Clips** | live | `#5B4BFF` |
| `chalybcrypto` | **Señales** | live | `#FF9F0A` |
| `chalybobs` | **En vivo** | live | `#FF375F` |
| `chalybbot` | **Asistente** | coming soon | `#30B0C7` |
| `chalybpicks` | **Pronósticos** | coming soon | `#34A853` |
| `chalybrealtor` | **Inmuebles** | coming soon | `#0A84FF` |
| `chalybtrade` | **Inversiones** | coming soon | `#AF52DE` |
| — | Idea card ("Tu idea") | — | `#E8A600` |
| `chalybstream` | **TODO(owner), Q32.** Not one of the 7 tools. Keep it out of customer UI, the sitemap and counts until named. | coming soon | — |

**Tool one-liners** (BUILD-SPEC tool colors; copy from `more_shared.py` TOOLS as regenerated 21:28): Clips "Convierte tu stream en clips cortos para TikTok, Reels y Shorts." · Señales "Te avisamos cuándo es buen momento para comprar o vender cripto." (general signal, the same for every user; P3-5 guardrails) · En vivo "Maneja tu transmisión y tus escenas de OBS con botones grandes." · Asistente "Un bot que contesta a tus clientes y seguidores, de día y de noche." · Pronósticos "Los pronósticos deportivos del día, explicados en simple." · Inmuebles "Publica tus propiedades y atiende a interesados sin perder tiempo." · Inversiones "Tu exchange sigue las reglas que tú escribes. Nunca podemos retirar tu dinero."

**Unfinished tools are not shown** (BUILD-SPEC §0.3: no "próximamente", "beta", "en construcción", "coming soon", "WIP" or "Disponible" as a lock state; a tool that isn't finished doesn't appear, and no card may lead to a dead end). Every customer list, count ("Las {n} herramientas", "y {n} más") and tool chip is derived from the **active** tools (`engines.status = 'active'`). Today that's Clips, Señales and En vivo, so "Las 7 herramientas" must render as "Las 3 herramientas" until the others ship (Q20).

**Glossary (BUILD-SPEC §3; old term → customer term; internal names unchanged):**
tokens / saldo de tokens → **créditos** · engines / motores / módulos / apps → **herramientas** · ChalyClip / ChalybClip / Chalyb Clips → **Clips** · Crypto signals → **Señales** · Stream manager / OBS controller → **En vivo** · Bot / chatbot / agente → **Asistente** · Picks / tips / apuestas → **Pronósticos** · Realtor → **Inmuebles** · Trade / trading bot → **Inversiones** · Dashboard (customer side) → **Inicio** · Library / historial / outputs / jobs → **Mis resultados** · Settings / perfil / billing → **Mi cuenta** / **Mi plan** · Subscription / tier → **plan** · Upgrade → **Prueba Pro gratis** (trial) / **Subir a VIP** / **Cambiar plan** · Disponible / Requiere Pro / candado → **Incluido en tu plan** / **Incluido en Pro · Pruébalo gratis** · Onboarding / setup → **Conectar** / **Te falta un paso** · Integrations / OAuth → **Conectar YouTube / Twitch / TikTok** · Upload / ingest / source URL → **Pega el enlace** / **Subir un video** · Render / processing / queue → **Estamos creando tus clips** · Aspect ratio → **Formato** (Vertical / Horizontal / Cuadrado) · Captions / SRT → **Subtítulos** · Watermark → **Marca de agua / logo** · API key → **Acceso API** (only in Opciones avanzadas) · Past due / dunning → **Pago pendiente** · Churn / cancel subscription → **Cancelar** · Trial → **Prueba gratis / mes gratis** · Invoice → **Factura (CFDI)** (Q11) · Payment method → **Método de pago / tarjeta** · Support ticket → **Hablar con una persona** · Notifications → **Avisos** (screen) / **Notificaciones** (preference) · Admin / backoffice → **Panel del dueño** · Users (admin) → **Personas** · Revenue / MRR (admin) → **Dinero / Ingresos** · Logs / events (admin) → **Actividad** · Healthy / degraded / down → **Funcionando bien / Lento hoy / No funciona ahora**. Plus, from the owner spec: trial already used → **"Volver a Pro"**.

---

## 5. DESIGN SYSTEM (from `docs/design/app-reimagine/html/style.css` + `more_shared.py`)

Put tokens in one file (e.g. `src/styles/chalyb-tokens.css`), mapped into Tailwind v4 `@theme`, and **scope them to the new subscriber shell, signup/trial flow and public site**, and in P5 to the six admin routes. Don't apply them to other `/dashboard` routes.

**Color tokens (verbatim):**
`--bg:#F5F5F7; --card:#FFFFFF; --ink:#1D1D1F; --ink2:#5E5E66; --ink3:#8E8E96; --line:#E6E6EB; --accent:#5B4BFF; --accent-d:#4A3AE8; --tint:#EFEDFF; --tint2:#F6F5FF; --ok:#1FA855; --ok-tint:#E6F6EC; --warn:#A65A00; --warn-tint:#FFF3DF; --warn-line:#FFD999; --bad:#D70015; --bad-tint:#FFEDEE; --bad-line:#FFC9CD;` sidebar bg `#FBFBFD`; logo gradient `linear-gradient(140deg,#7B6CFF 0%,#5B4BFF 55%,#3F2FE0 100%)`; plan card gradient `linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%)`.

**AA fixes (required by §6.3; flag for UI/UX approval, Q28).** Measured contrast: `--ink3` text on `--bg` = **2.99:1** and on white = 3.25:1 (fails); `--ok` text on `--ok-tint` = **2.76:1** and white on `--ok` = 3.09:1 (fails, e.g. the "Escribir" button and the "Listos"/"Conectado" pills); placeholder `#A8A8B0` on white = 2.36:1. Use:
- `--ink3-text:#6C6C74` for any **text** using ink3 (4.78:1 on bg, 5.2:1 on white). Keep `#8E8E96` for icons and dividers only.
- `--ok-text:#167A3E` for green text and green buttons with white text (4.83:1 on ok-tint, 5.4:1 white-on). Keep `#1FA855` for decorative icons and dots.
- Placeholder color ≥ 4.5:1 (use `--ink3-text`).
- `--accent` on white 5.39:1 and on `--tint` 4.68:1 (ok); `--warn` on warn-tint 4.69:1 (ok); `--bad` on bad-tint 4.77:1 (ok).

**More tokens and rules from BUILD-SPEC §1:**
- "Ejemplo" tag: `#8E6A00` on `#FFF6D6`, dotted border `#E8C55A` (admin sample data only; production shows real data, never the tag).
- Green (`--ok`) is **only** for "listo/hecho/conectado" and human help; never for "comprar", prices or decoration.
- Selected state: `box-shadow: 0 0 0 2–3px var(--accent), var(--shadow-lg)`.
- Sheets/modals radius 28. Inputs h52–62, radius 16, border 1.5px `#DCDCE3`, focus 2px accent + 5px halo `rgba(91,75,255,.12)`. Checkbox 28×28, radius 8, **always unchecked by default**. Back = a 48px white pill with an accent chevron; Close = a 48px white circle.
- Buttons add `btn-dark` (ink bg, white; **only "Sí, cancelar", same weight as primary**), `btn-danger` (white, `--bad` text, `--bad-line` border), `btn-ok` (green; only "Hablar con una persona / WhatsApp"), `btn-white`, and a **giant** size (100px, 28px/700, radius 24; En vivo "Iniciar transmisión"). `btn-xl` is max 520px wide in wizards.
- Type: landing hero 66/700/1.04, tracking −0.045em (mobile 40); landing section title 44/700 (mobile 30); h1 tracking −0.03em; metadata 15–16 (never < 14); billing text 17–18; sidebar nav 20/500 (active 600); `font-feature-settings: "cv11","ss01"`; **Inter as the web font** (Q27).
- Spacing scale 4·8·10·12·14·16·18·22·24·28·36·48·56·64·88. Desktop content padding `52px 64px 40px`, `.wrap` max 1040; wizard column 760–1000; grids: Inicio 2×2 gap 22, tools 4 columns gap 18–20, results 3 columns.
- Component inventory (BUILD-SPEC §1.6, in `components/ui/`): AppShell, MobileTabBar, WizardShell, PublicNav, PublicFooter, Card, Group+Row, Button, Chip, Pill, Switch, Segmented, Field, Checkbox, ToolIcon, Thumb (gradient frame, no photos), Avatar (gradient initials), Banner, DisclosureBlock, Sheet/Modal, EmptyState, ErrorState, **SetupState**, AdvancedOptions (accordion, closed by default, remembers its state per user), KpiCard, DataTable, ConfirmStep, ExampleTag.

**Shape and elevation:** `--r:22px`; `--shadow:0 1px 2px rgba(16,16,40,.04), 0 6px 24px rgba(16,16,40,.06)`; `--shadow-lg:0 2px 4px rgba(16,16,40,.04), 0 18px 48px rgba(16,16,40,.10)`. Card radius 22–24; buttons radius 16 (xl 18); group lists radius 20.

**Type:** `-apple-system,"SF Pro Display","SF Pro Text","Inter",system-ui,sans-serif`; body 18px/1.4, letter-spacing −0.011em; h1 40/1.12 700; h2 26/1.2 650; `.sub` 20px ink2; `.eyebrow` 20px ink2; `.label` 14px 700 uppercase accent, letter-spacing .06em. Mobile (08) h1 29px. The current site loads Familjen Grotesk / Space Mono / Fraunces; the new screens use the system stack + Inter (Q27).

**Components to build once** (in `src/components/ui/` or the repo's existing equivalent) and reuse:
- `Button` variants: primary (accent bg, white, shadow `0 6px 18px rgba(91,75,255,.32)`), secondary (white bg, accent text, inset 1.5px `#DAD6FF`), gray (`#EBEBF0`), danger-secondary (white, `--bad` text, inset `--bad-line`). Sizes: default h60, xl h68 full-width; compact h46–54 in banners and rows.
- `Card`, `Group` + `Row` (icon tile 38px radius 10 / text / value / chevron; dividers inset at 72px), `GroupHeader` (15px 600 uppercase ink3-text).
- `Switch` (56×34; on = accent) with a real `<button role="switch" aria-checked>`.
- `Segmented` (3/6/10), `Chip` (h48 pill; `.on` = ink bg, white text), `Pill` (ok/acc/warn/bad/gray/dark).
- `StepBar` (3 bars 72×8, "Paso N de 3").
- `FlowTopbar` (back pill "Inicio"/"Atrás" left, centered tool mark plus title, close X right; h84).
- `AppShell` (desktop sidebar 272px with logo, 3 nav items and a user card; mobile < 900px: top logo + avatar and a bottom tab bar "Inicio / Resultados / Cuenta", h88, blurred `rgba(250,250,252,.92)`).
- `TaskCard` (72px icon tile, label, h2, p, round arrow; `first` variant = accent ring plus filled tile).
- `Banner` (kinds `trial`/`warn`/`gray`/`bad`; one line plus one button; min-h 64; specs in `more_shared.py` `.bnr.*`).
- `DisclosureBox` (`.disc`: white, inset 1.5px `#E4E0FF`, info icon tile, 18px/1.5, bold dates and amounts; **never below 14px, never gray**).
- `PricePlanOption` (radio card), `Thumb` (9:16 clip thumbnail with duration chip, caption, play), `ProgressRing`, `StatusList` (done/run/wait dots), `EmptyState` / `ErrorState` (24), `Modal` / `ConfirmSheet` (18).
- Icons: lucide-react is already a dependency. Map the mockup's stroke icons to lucide equivalents (scissors, trending-up, radio, layout-grid, house, clapperboard/library, user, link, upload, download, share, mail, credit-card, globe, bell, message-circle, coins, sliders, lock, gift, clock, info, alert-triangle, etc.).
- **Logo:** the mockups draw a "C" mark with the purple gradient, but `main` shipped a 2026 brand emblem (`brand-mark.tsx` / `fusion-mark.tsx`, commits 22 Sep). Use the shipped brand asset until UI/UX confirms (Q27).

---

## 6. CROSS-CUTTING REQUIREMENTS (each has a concrete check)

### 6.1 Spanish first, EN parity
- Add `tests/i18n-parity.test.ts`:
  - (a) every leaf key in `messages/es.json` exists in `messages/en.json` and vice versa;
  - (b) no empty values;
  - (c) **untranslated check:** EN value === ES value fails unless the key is in an explicit allowlist (`brand`, tool names, "Pro", "VIP", "Chalyb", numbers/prices, URLs);
  - (d) placeholders (`{fecha_fin}` etc.) match between locales.
- Add `scripts/check-hardcoded-copy.mjs` (wired as `pnpm check:copy` and run in CI/tests). It parses TSX in **customer-facing dirs rebuilt by this effort** (`src/app/[locale]/(dashboard)/app/**`, `src/app/[locale]/(public|landing)/**`, `src/components/{app,ui,landing,workspace,auth}/**`) and fails on JSX text or string-literal props (`title`, `aria-label`, `placeholder`, `alt`) with letters that aren't wrapped in `t()`, except an allowlist (brand, tool names, symbols). Legal page bodies and email templates are exempt; emails use the shared copy module instead.
- **Check:** `pnpm test` (parity) and `pnpm check:copy` are green, and EN logout reads "Sign out".

### 6.2 Mobile first (360px)
- Build every new screen mobile-first. No horizontal scroll at **360×740** (the 390px mockups are the reference, but 360 must work). Remove any `white-space:nowrap` on headings that the mockups use (08 `.mh h1`, `.mc h2`) or let them wrap. Tap targets ≥ 48×48 (BUILD-SPEC §0.10). `<html lang="es-MX">` for Spanish (`en` for /en).
- **Check:** a Playwright project at viewport 360×740 asserts `document.documentElement.scrollWidth <= 360` on every customer route touched in the phase, and takes a screenshot for the PR.

### 6.3 Accessibility basics
- Labels: every input has a `<label>` (or `aria-label` from i18n). Every icon-only button (close X, back, sign-out ⏻, Pegar) has an accessible name. Images have `alt` (decorative ones `alt=""`). Thumbnails have alt like "Clip: {título}".
- Focus: a visible focus ring on all interactive elements (2px accent outline plus offset). Modals trap focus and close on Esc. Wizards move focus to the new step's `h1`.
- Keyboard: the whole trial path, the Clips wizard, cancel, and banner buttons work with keyboard only. Radios/segmented/switch use native inputs or proper ARIA roles.
- Contrast AA (≥ 4.5:1 text, ≥ 3:1 large text and UI) using the §5 fixes. Respect `prefers-reduced-motion` (progress ring, confetti).
- **Check:** add `@axe-core/playwright` in the e2e suite (P0 sets it up). Every touched customer page has 0 `serious`/`critical` violations.

### 6.4 SEO
- Canonical origin **`https://www.chalyb.com`**. Add `canonicalOrigin()` in `src/lib/site.ts` (default `https://www.chalyb.com`, overridable by `NEXT_PUBLIC_CANONICAL_ORIGIN` for previews). Use it for `metadataBase`, per-page `alternates.canonical`, hreflang (`es-MX` unprefixed, `en` under `/en`, `x-default` → es), `sitemap.xml` and the `Sitemap:` line in `robots.txt`. **Don't change `appUrl()`**: Mercado Pago `back_urls`/`notification_url` read it, so switching it is OPS (§11).
- The non-www → www redirect already exists at the Vercel domain level (308). **Don't add a second redirect in code**; OPS keeps it. Note that it also redirects `/api/*`, which matters for MP webhooks (OPS-4).
- Every public page has a unique `title` (template `%s · Chalyb`) and `description` from messages, plus `og:url`, `og:locale`, `og:title`, `og:description`; Twitter `summary_large_image` stays.
- `robots.txt` keeps disallowing private routes and serves from www. The sitemap lists every public indexable page in both locales (landing, Planes, contacto, and the four legal pages + `/quien-vende` once P6 publishes them).
- **Check:** unit test on `sitemap()`/`robots()` output (all `<loc>` on `https://www.chalyb.com`); e2e asserts `<link rel="canonical" href="https://www.chalyb.com/...">` on each public page.

### 6.5 Analytics funnel
- Use the existing **Vercel Analytics** (`track` from `@vercel/analytics` on the client and from `@vercel/analytics/server` on the server), behind a tiny provider-agnostic wrapper `src/lib/analytics/track.ts`: `track(event: FunnelEvent, props?: Record<string,string|number|boolean>)`. If the Vercel import is unavailable at runtime, no-op with a `TODO(provider)`.
- Events (exact names): `signup`, `trial_start`, `first_clip`, `cancel`, `conversion`, `payment_failed`.
- Props: `plan` (`anual|mensual`), `source` (`landing|app|email`), `surface`. **No PII** (no email, name, card or user id in props).
- Fire them server-side where the truth is: `trial_start` on preapproval authorized, `conversion` on the first approved charge after a trial, `payment_failed` on rejected, `cancel` on a successful MP cancel. `signup` fires after successful account creation. `first_clip` fires on the user's first completed clip job (P3 mode A) or the first Clips usage event received at `/api/engines/chalybclip/usage` (mode B), deduped per user.
- Respect cookie consent once P4 adds the banner (P4-7): until consent, `track()` sends only what the privacy notice classifies as necessary (Q14).
- **Check:** unit tests mock the provider and assert each event fires exactly once per real transition (webhook replays don't double-fire).

### 6.6 No technical jargon in customer UI
- Add `tests/customer-copy.test.ts`. It scans `messages/es.json` and `messages/en.json` customer namespaces and the shared billing copy module for forbidden terms: `engine`, `tier`, `SSO`, `token`, `slug`, `placeholder`, `webhook`, `simulación`, `modo demo`, `admin_api_base`, `engine_subs`, `_ADMIN_TOKEN`, `Vercel`, `Supabase`, `ChalyClip`, `ChalybClip` and the other `Chaly*` names.
- The e2e "no leaks" spec does the same over rendered HTML for Free, trialing, Pro and VIP on `/app`, every `/app/engines/*` (tool) page, `/app/billing`, `/app/usage` and `/app/settings`, plus every route added in P2–P3 (`/app/prueba/**`, `/app/clips/**`, `/app/senales`, `/app/en-vivo`, `/app/herramientas/**`, `/app/avisos`).

---

## 7. STANDARD GATES (every phase)

### 7.1 Commands (all green before the PR is marked ready)
```
pnpm install --frozen-lockfile
pnpm tsc --noEmit
pnpm lint
pnpm test            # node test runner: unit + i18n parity + customer-copy
pnpm check:copy      # added in P0
pnpm build
pnpm e2e             # Playwright, added in P0; runs against `pnpm start` locally or a preview URL via E2E_BASE_URL
```
List any new migration in the PR and in §11. **Don't run it against prod.** Locally use `supabase start` + `supabase db reset` if available, or document how it was tested.

### 7.2 E2E accounts (existing Free / Pro / VIP / Admin QA accounts)
Read from env only: `E2E_BASE_URL`, `E2E_FREE_EMAIL`, `E2E_FREE_PASSWORD`, `E2E_PRO_EMAIL`, `E2E_PRO_PASSWORD`, `E2E_VIP_EMAIL`, `E2E_VIP_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`. BUILD-SPEC tests 6 account types (`gratis`, `trial`, `pro_mensual`, `pro_anual`, `vip`, `past_due`). The extra ones come from optional `E2E_TRIAL_*`, `E2E_PRO_ANNUAL_*` and `E2E_PAST_DUE_*` vars, or from local seed fixtures. If a var is missing, **skip** that role's specs with a clear message rather than failing or hard-coding. Specs that would mutate billing or external engines run only against a preview with MP sandbox (`E2E_ALLOW_MUTATIONS=1`). Read-only specs (pages load, no leaks, a11y, 360px) may run anywhere. Never run mutating specs against production.

### 7.3 Entitlement and tier facts to respect (from `src/lib/billing/tiers.ts`)
`effectiveTier(role, tier)` turns ADMIN/SUPER_ADMIN into VIP. Tiers are FREE / PRO / PARTNER / VIP. `TIER_CAPS` sets: FREE `liveEnginesCount 0`, `tokensPerMonth 50,000`; PRO `liveEnginesCount 1` (the tool picked in `profiles.selected_engine_id`), `tokensPerMonth 1,000,000`, `clipConnectSocials true`, `clipAutoPublish false`; VIP `liveEnginesCount Infinity`, `tokensPerMonth 5,000,000`, `clipAutoPublish true`. `engineIsLiveForUser()` folds in the 7-day Clips trial and grace. **Every access decision goes through one function.** P0 adds it as `getEntitlements(userId)` (BUILD-SPEC shape); P2 extends it with trial/billing fields. Never re-implement the ladder in a component.

---

# 8. PHASES

> The phases are BUILD-SPEC's Fases, 1:1: **P0 = Fase 0** Clips end to end + QA bugs → **P1 = Fase 1** design system, shell, Inicio, Mi cuenta → **P2 = Fase 2** sign-up, trial, billing, Mi plan (with the §10.3 consent log and the §11.1–§11.3 tests **in the same PR**, as BUILD-SPEC §13 orders) → **P3 = Fase 3** tool wizards, results, states, Ayuda, Avisos → **P4 = Fase 4** public site → **P5 = Fase 5** owner panel → **P6 = Fase 6** legal pages, acceptance logging, and the release gate (the earlier "hardening" pass is folded in as P6-10). Each phase's DONE WHEN includes BUILD-SPEC's acceptance criteria for that Fase. **No real charge is enabled before D1 (IVA), D2 (Quebec) and the attorney's signature are closed** (BUILD-SPEC §13).

---

## P0 · Fase 0: Clips working end to end + QA bugs, safety, hygiene (BUILD-SPEC §4)
**Branch:** `claude/rebuild-p0-safety-clips` · **Depends on:** OPS-0 (design docs copied) · **Closes:** B01–B14, B29 (verify), B32
**Goal (BUILD-SPEC §4 "Clips funciona de punta a punta"):** anyone on any plan (Gratis, prueba, Pro, VIP) can paste a link and get clips, and **no screen shows a state that contradicts the next one**. Also: no customer sees config, env names or raw errors; "Abrir" on Clips, Señales and En vivo works or fails with a clear Spanish message; access is decided server-side by one function; tool names are customer names; aliases, canonical and sitemap are right; and the e2e harness exists, **written before the fixes** (BUILD-SPEC §4.2.1).

**Files (expected; adapt to what exists):** `src/components/workspace/engine-launch-button.tsx`, `src/lib/engines/launch-actions.ts`, `src/lib/engines/integrations/{factory,types}.ts`, `src/lib/engines/reconcile-actions.ts`, `src/app/[locale]/(dashboard)/app/engines/[slug]/page.tsx`, `.../app/engines/page.tsx`, `.../app/page.tsx`, `.../app/usage/page.tsx`, `.../app/billing/page.tsx`, `src/components/dashboard/sidebar-sign-out.tsx`, `src/lib/engines/display-names.ts`, `src/lib/billing/tiers.ts` (read; add helper only), `src/lib/site.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/[locale]/layout.tsx`, `next.config.ts`, `messages/{es,en}.json`, new `src/lib/errors/customer-errors.ts`, new `src/lib/billing/entitlement.ts`, new `src/lib/tools/adapters/{types,clips,mock}.ts`, new functional routes `src/app/[locale]/(dashboard)/app/clips/**`, new `supabase/migrations/00NN_tool_display_names.sql`, new `playwright.config.ts`, `e2e/**`, `tests/*.test.ts`, `package.json` (scripts `e2e`, `check:copy`, `typecheck`).

### Fixes

**P0-1 · Launch popup blocked; "Abrir" does nothing (B01)**
- *Problem:* `EngineLaunchButton` awaits `getEngineLaunchUrl()` and only then calls `window.open(url,'_blank')`. Browsers block popups opened after an `await`. Nothing checks the `window.open` return value, so the click "does nothing" (QA 2026-09-22 P1; repro on Clips "Abrir prueba de ChalyClip").
- *Fix:* In the click handler, **synchronously** open `const w = window.open('about:blank','_blank')` (no `noopener` in the features string, because a `noopener` call returns null; after navigation set `w.opener = null`). Then await the action. On success set `w.location.href = url`. On failure call `w.close()` and show the mapped Spanish error. If `w === null` (popup blocked): after the action resolves, show a toast with a visible link **"Abrir {tool}"** (a plain `<a href={url} target="_blank" rel="noopener">`). Same-tab navigation (`window.location.assign(url)`) is the fallback when no link can be shown. **Every path ends in a new tab, a visible link, or a toast** (owner spec, fix 4). Show a pending state on the button ("Abriendo…") and disable double-clicks. Keep `rel` safety.
- *Done when:* Playwright (desktop Chromium with popups allowed **and** a context that blocks popups) clicking "Abrir" on Clips as Pro either opens a new page whose URL starts with the engine `external_url` and contains `/auth/sso?token=`, or (popups blocked) shows a toast containing a link to that URL. Tested in Chromium and WebKit. A unit test covers the null-window branch.

**P0-2 · Provisioning missing / `external_user_id` empty / "Crear tu cuenta" silent (B02, B29)**
- *Problem:* Users with a subscription row but no tenant at the engine (`external_user_id` null) get the English "User has not been provisioned in X yet". "Crear tu cuenta" fails silently when the engine admin API errors.
- *Fix:* In `launch-actions.ts`, if the user is entitled (P0-3) and `external_user_id` is empty, call the existing integration `provisionTenant()` **inline** (POST `{admin_api_base}/tenants`; 409 = already exists = success), persist `external_user_id`, then build the SSO URL. If the engine API supports lookup by our stable user id/email, look up before creating to avoid duplicates. Guard double clicks and concurrent calls with a unique constraint on `engine_subscriptions(user_id, engine_id)` (add it in the P0 migration **only if it doesn't already exist**; check the existing migrations first) plus an upsert, or a row lock. Log every outcome through `src/lib/audit/log.ts` with the engine slug and a status code (no tokens). Use the same path for "Crear tu cuenta" and surface failures through P0-4's mapped messages. Keep `reconcile-actions.ts` / `team-reconcile-engine.tsx` as the admin batch fix and note the prod run in OPS-6.
- *Done when:* A unit test with a mocked integration shows: missing id → provision → id saved → URL returned; a 409 is treated as success; a 5xx returns `{ ok:false, code:'PROVISION_FAILED' }` with no env names, and status, body and request id go to the server log only. Two concurrent calls create exactly one engine account. The e2e "Abrir" passes for a Pro account whose row had no `external_user_id` (preview with `E2E_ALLOW_MUTATIONS=1`).

**P0-3 · Launch not refused server-side by entitlement (B07)**
- *Problem:* `getEngineLaunchUrl` only checks that an `engine_subscriptions` row exists. A Free user with a stale row, or a Pro user on a non-selected tool, can still get an SSO URL.
- *Fix:* Add **one** server function `getEntitlements(userId)` in `src/lib/billing/entitlement.ts` with BUILD-SPEC's shape: `{ plan, trial, tools: { [slug]: 'included' | 'trial_offer' | 'setup_needed' }, credits }`. `setup_needed` carries `missing: 'youtube' | 'obs' | 'whatsapp' | …` (see P0-5). In P0 it delegates to the existing ladder (`effectiveTier` + `engineIsLiveForUser`, including the legacy 7-day Clips trial and grace) and maps "not entitled" to `trial_offer`. **P2 extends the same function** with trial/billing fields (state, dates, card, plan interval). Replace every scattered plan check (BUILD-SPEC §4.2.2: grep `isPro`, `plan ===`, `requiresPro`, `locked`, `Disponible`, `TIER_CAPS[` in customer code) so cards, routes, API and launch all read it. Call it in `launch-actions.ts` **before** provisioning or SSO. Anything other than `included` returns `{ ok:false, code:'NEEDS_PLAN' }` (or `SETUP_NEEDED`).
- *Done when:* Unit tests (FREE no trial → refused unless `FREE_INCLUDES_CLIPS` and slug = chalybclip; FREE in the legacy 7-day Clips trial → Clips allowed, others refused; PRO selected → allowed; PRO non-selected → refused **until P2 turns on `PRO_INCLUDES_ALL_TOOLS`**; VIP/ADMIN → allowed; engine status ≠ active → refused and hidden). An e2e as Free on a Pro tool shows "Incluido en Pro · Pruébalo gratis" and no SSO navigation. A grep test finds no new plan checks outside `entitlement.ts` / `tiers.ts`.

**P0-4 · Raw, technical or English error toasts (B03)**
- *Problem:* Toasts show strings like `slug=…`, "modo placeholder", "/app/engines", "`CHALYBCLIP_ADMIN_TOKEN` missing", "User has not been provisioned…".
- *Fix:* Create `src/lib/errors/customer-errors.ts` with a closed set of codes: `NEEDS_PLAN`, `SETUP_NEEDED`, `TOOL_UNAVAILABLE`, `PROVISION_FAILED`, `SESSION_EXPIRED`, `NETWORK`, `UNKNOWN`. Server actions return `{ ok:false, code }` only. Integration errors are caught, logged server-side (with detail), and mapped to a code. The client maps codes to i18n keys `errors.tool.*`. ES copy:
  - NEEDS_PLAN: "Incluido en Pro · Pruébalo gratis" (button "Prueba Pro gratis 1 mes" → SCR-14; if the trial was already used: "Volver a Pro")
  - SETUP_NEEDED: render `SetupState` for the named `missing` step (P0-5), not a toast.
  - (No "coming soon" message: a non-active tool is never shown, and its URL redirects to Más herramientas; BUILD-SPEC §0.3.)
  - TOOL_UNAVAILABLE: "No pudimos abrir {tool} en este momento. Intenta de nuevo en unos minutos."
  - PROVISION_FAILED: Clips → **"No pudimos preparar tus Clips. Intenta de nuevo en un momento."** (owner-approved, verbatim). Other tools: "No pudimos preparar {tool} para tu cuenta. Intenta de nuevo en un momento." The retry button appears only after a real failure.
  - SESSION_EXPIRED: "Tu sesión terminó. Vuelve a entrar."
  - NETWORK: "Parece que no hay conexión. Revisa tu internet e intenta otra vez."
  - UNKNOWN: "Algo salió mal. Intenta de nuevo o escríbenos."
  
  Add EN equivalents. Error states always offer a next action (retry or "Hablar con una persona" → /app/help).
- *Done when:* `grep` finds no raw `error.message` or `err.message` passed to `toast`/`setError` in customer components. A unit test maps every integration failure to a code. `tests/customer-copy.test.ts` passes.

**P0-5 · Env/config leak and "La configuración quedó incompleta" on tool pages (B04)**
- *Problem:* `AccessPanel` in `app/engines/[slug]/page.tsx` renders env var names (`CHALYBCLIP_ADMIN_TOKEN`, `CHALYB_ADMIN_TOKEN`), `engines.admin_api_base`, `[engine_subs]`, "ID en …", and the warning "⚠ La configuración quedó incompleta…". `LaunchPanel` shows "Abrir prueba de …", "sesión SSO firmada" and "Modo de prueba".
- *Fix:* Remove every config and diagnostic element from customer rendering. For **admins only** (`isAdminRole`), render a collapsed "Diagnóstico (solo admin)" block with the same info, or link to `/dashboard/engines/[slug]`. Customer states are exactly: *Abrir* (`included`), *Incluido en Pro · Pruébalo gratis / Volver a Pro* (`trial_offer`), **`SetupState`** for `setup_needed` (BUILD-SPEC B2: setup is a **named** state `missing: 'youtube' | 'obs' | 'whatsapp' | …`, with **one button that resolves exactly that step**; if nothing can resolve it, no button is shown; tools that don't need setup, such as Clips with a pasted link, are **never** blocked by an optional connection), and *PROVISION_FAILED copy + "Intentar de nuevo"*. Non-active tools: the route redirects to the tools list. The button label is "Abrir"; drop "prueba de …", "SSO" and "Modo de prueba".
- *Done when:* e2e "no-leaks" over `/app/engines/*` as Free/Pro/VIP finds none of: `_ADMIN_TOKEN`, `admin_api_base`, `engine_subs`, `configuración quedó incompleta`, `SSO`, `ID en`, `placeholder`. As Admin, the diagnostic block exists but is collapsed.

**P0-6 · `/app/usage` diagnostic strip leak (B05)**
- *Problem:* `app/usage/page.tsx` renders warning codes and "revisa los logs de Vercel" to customers.
- *Fix:* Show it to admins only. Customers get a single friendly line, "No pudimos cargar tu consumo. Intenta de nuevo en unos minutos.", plus a retry, and only when reads fail.
- *Done when:* the no-leaks e2e covers `/app/usage`; strings "Vercel", "logs" and the warning codes are absent for non-admins.

**P0-7 · "modo demo" and "Disponible" shown to Free users (B06: copy part)**
- *Problem:* Home hero says "Prueba los engines en modo demo"; Free users see a "Disponible" badge on tools they can't use; "simulación" appears in UI.
- *Fix:* Remove "modo demo / simulación / Disponible" from customer UI. Badges become (BUILD-SPEC glossary): `included` → "Incluido en tu plan"; `trial_offer` → "Incluido en Pro · Pruébalo gratis"; non-active tools → **not rendered at all** (and removed from counts). Hero sub: interim "Elige qué quieres hacer hoy." (P1 replaces the whole home). **The full entitlement model lands in P2.**
- *Done when:* `messages/*.json` customer namespaces contain no "modo demo", "simulación" or "simulation" (customer-copy test). The Free home shows no "Disponible".

**P0-8 · Tool names (B08)**
- *Problem:* Customer UI shows "ChalyClip", "ChalyCrypto", "ChalyOBS", etc. (`display-names.ts`, DB `engines.name` via migrations 0036/0040, `messages/es.json` such as "ChalyClip gratis 7 días").
- *Fix:*
  1. `display-names.ts` → map slugs to **Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles, Inversiones** (`chalybstream` → keep its current internal label but hide it from customer lists: Q32).
  2. New migration `00NN_tool_display_names.sql` that updates `engines.name` (and any `display_name`/`tagline` column 0036/0040 touched) by slug, idempotently.
  3. Replace "Chaly*" names in customer `messages` keys, emails (`templates.ts`) and toasts.
  4. `tiers.ts` comments may stay. The admin may show "Clips (chalybclip)".
  5. Customer copy uses "herramienta(s)" instead of "engine(s)" (§4).
- *Done when:* customer-copy test (no `Chaly[A-Z]`, no `engine` in customer namespaces). The e2e no-leaks also asserts the rendered `/app` and `/app/engines` contain no `Chaly[A-Z]\w+` (the logo wordmark "Chalyb" is allowed). The migration is listed in OPS-2.

**P0-9 · Public `/engines` 404 (B09)**
- *Fix:* Temporary redirect (307, `permanent:false`) `/engines` and `/en/engines` → `/#herramientas` (landing anchor). P4 makes it permanent (308); BUILD-SPEC defines no public catalog page.
- *Done when:* curl-style e2e `GET /engines` → 307 to `/#herramientas`.

**P0-10 · EN logout in Spanish (B10)**
- *Fix:* `sidebar-sign-out.tsx` takes its label, title and aria-label from `t('auth.signOut')`, reusing the key that `sign-out-button.tsx` already uses.
- *Done when:* e2e on `/en/app` finds a button named "Sign out"; the parity test passes.

**P0-11 · Admin shows "Free" on `/app/billing` (B11)**
- *Fix:* Label the plan using the same derivation as the rest of the app: `effectiveTier(role, tier)`, shown as "VIP (admin)" for admin roles. P2 rebuilds this page as Mi plan.
- *Done when:* e2e as Admin on `/app/billing` doesn't show "Free"/"Gratis" as the plan.

**P0-12 · Sitemap and robots on non-www; no canonical or hreflang (B12, B13)**
- *Fix:* Add `canonicalOrigin()` (§6.4) and use it in `robots.ts`, `sitemap.ts` and the locale layout's `metadataBase` + `alternates` (canonical plus `languages: { 'es-MX': '/…', en: '/en/…', 'x-default': '/…' }`) for public pages. Private routes get `robots: { index:false }`. Leave `appUrl()` untouched.
- *Done when:* unit tests: every sitemap `<loc>` starts with `https://www.chalyb.com`; robots has `Sitemap: https://www.chalyb.com/sitemap.xml`. e2e: `/`, `/contacto` and `/legal/terms` have a canonical with www, plus hreflang links.

**P0-13 · Alias 404s (B14)**
- *Fix:* `next.config.ts` redirects, each also for `/en/…`:
  - `/sign-up` → `/sign-in?mode=signup` (permanent)
  - `/planes` → `/#pricing` (**temporary**; P2 builds `/planes` (SCR-12) and P4 finishes its SEO, deleting this redirect)
  - `/terminos` → `/legal/terms` (**temporary**; P6 makes `/terminos` canonical)
  - `/privacidad` → `/legal/privacy` (**temporary**; same)
  - `/suscripcion` and `/uso-aceptable`: **don't redirect yet** (no page exists; P6 adds them).
  
  Don't touch the existing `/precios` → `/#pricing` (P4 repoints it to `/planes`).
- *Done when:* e2e: each alias returns 307/308 to the target and the target returns 200.

**P0-14 · Clips hand-off works (SSO path)**
- *Problem:* The QA flow "Free → see Clips → Prueba Pro → land in Clips → make a clip" breaks at launch (B01/B02) and leaks (B04).
- *Fix:* P0-1…P0-5 make it work: the user is entitled (Pro or the 7-day Clips trial) → "Abrir" → SSO to `{external_url}/auth/sso?token&next=/dashboard/start` (the existing `postSsoPath`). **The in-hub wizard is P3**; P0 only guarantees the hand-off works and returns usage events (existing `/api/engines/[slug]/usage`).
- *Done when:* e2e "clips-launch.spec.ts": a Pro account lands on the Clips app URL with a valid SSO token (assert the navigation URL and HTTP 200 on the SSO endpoint in preview). Free gets Clips if `FREE_INCLUDES_CLIPS` (P0-16), otherwise the NEEDS_PLAN state. No console errors.

**P0-16 · Clips flow end to end in the hub (BUILD-SPEC §4.1 B3 + §4.2.3–6)**
- *Problem:* QA: clips can't be generated on any plan. The hub has no Clips job API (engine capability, Q4/OPS-13; see P3), and nothing normalizes job states or failures.
- *Fix:*
  1. Create the `ClipsAdapter` contract now (`src/lib/tools/adapters/{types,clips,mock}.ts`, detailed in P3). Job states are normalized to **`received → finding_moments → adding_captions → ready | failed(reason)`**, which feed SCR-04 (ring + 4 steps). Failure reasons: **`link_private`, `link_unsupported`, `video_too_long`, `no_credits`, `platform_down`, `unknown`**, each mapped to its BUILD-SPEC §7.6 copy (SCR-24): `link_private` → `error.link.*` ("No pudimos leer ese enlace" / "Revisa que el video sea público y vuelve a pegarlo."), `link_unsupported` → `error.unsupported`, `video_too_long` → `error.tooLong`, `no_credits` → "Te quedaste sin créditos este mes. Se renuevan el {fecha}." [Ver mi plan], `platform_down` → `error.platform`, `unknown` → `error.unknown`; plus `error.noCharge` "No se usaron créditos." when no credits were used.
  2. **Credits are charged only on success**; retry automatically up to 2 times before showing the error; every failure is logged with its reason via `src/lib/audit/log.ts` (shown later in admin Actividad, P5).
  3. Build the functional Clips routes (SCR-02 → 03 → 04 → 05) against the adapter with plain accessible markup; P1 re-skins them with the design system and P3 adds SCR-06 and polish.
  4. With `TOOL_HUB_MODE_CHALYBCLIP=off` (no engine API yet), the Inicio card and SCR-02 hand off through the P0-14 SSO path, and this fix's acceptance is measured in the engine app; the PR states which mode was verified.
  5. **Free gets Clips:** BUILD-SPEC §4 requires Gratis to make clips (and mockup 12 lists "Clips para probar"), but today `TIER_CAPS.FREE.liveEnginesCount = 0`. Add `FREE_INCLUDES_CLIPS=true` (Free-tier caps from `TIER_CAPS.FREE`: watermark, SD, 7-day retention) and flag it (Q19: the owner must confirm COGS).
  6. Add a deploy smoke test `e2e/smoke/clips.smoke.spec.ts` (tag `@smoke`): a known public link (`E2E_SMOKE_VIDEO_URL`) produces ≥ 3 clips in < 10 min. Running it after each deploy is OPS-9.
- *Done when:* with the mock adapter, the e2e completes Inicio → Clips → paso 1 → paso 2 → listos for every available role. The failure path shows the error state and asserts no credit debit (unit test on the debit call). The retry count is unit-tested.

**P0-15 · Test harness**
- *Fix:*
  - Add Playwright (`@playwright/test`) and `@axe-core/playwright`: `playwright.config.ts` with projects `desktop-chromium` (1440×900) and `mobile-360` (360×740); `baseURL` from `E2E_BASE_URL` (default `http://localhost:3000`); auth setup per role from the §7.2 env vars, stored as `storageState` under `e2e/.auth/` (gitignored).
  - Scripts: `"e2e": "playwright test"`, `"typecheck": "tsc --noEmit"`, `"check:copy": "node scripts/check-hardcoded-copy.mjs"`.
  - Add `tests/i18n-parity.test.ts` and `tests/customer-copy.test.ts` (§6.1, §6.6).
  - Shared helper `e2e/utils/no-leaks.ts` with the forbidden list.
  - Don't add CI secrets; document the env var names in the PR.
- *Done when:* `pnpm e2e` runs locally. Role specs skip cleanly when env vars are missing.

**P0-17 · Mercado Pago integration fixes (QA live test 2026-10-02; source `docs/qa/MP-INTEGRATION-FINDINGS-2026-10-02.md` if present). Closes B33, B34, B35.**
Context: the owner is trying to run Mercado Pago's "Medir la calidad de la integración". That tool needs an Order ID from a payment made **with test credentials in the last 7 days**. Today no test payment can complete, so the tool can't run. These three fixes touch today's live subscription flow (not the `TRIAL_FLOW_ENABLED` flow), so they ship in P0. If the rebuild is already past P0, ship this block as its own PR `claude/mp-integration-fixes` from `main`.
Files to inspect first: `src/lib/payments/{mercadopago,mp-config,subscription-actions,subscription-sync,subscription-reference,pricing}.ts`, `src/app/api/mp/webhook/route.ts`, `src/components/payments/mp-card-brick.tsx`, and wherever `preapproval` / `preference` bodies are built (`rg -n "transaction_amount|unit_price|notification_url|payer_email|preapproval_plan_id|back_url" src`).

- **B33 (BLOCKER) · Test and prod credentials get mixed.**
  - *Problem:* subscription checkout fails with "Una de las partes con la que intentas hacer el pago es de prueba." MP raises this when the seller side (access token / public key that created the preapproval or preference) and the buyer side (payer account, `payer_email`, card) belong to different environments. The most likely code cause: the preapproval sends the **logged-in user's real email** as `payer_email` while a test token is in use (or the Brick uses one environment's public key and the server the other's access token).
  - *Fix:*
    1. One resolver `getMpEnv(): 'test' | 'prod'` in `mp-config.ts`, driven by a single env var (`MP_ENV`, following the existing MP env var naming; default `prod` on Vercel Production, `test` everywhere else). Every MP call (server SDK client, Brick public key, webhook secret) reads its credentials **only** through this resolver. No other file reads MP env vars directly (grep test).
    2. Startup assertion: access token and public key are configured as a pair for the same environment. If `MP_ENV=test` and either is missing, fail loudly in logs and show the existing generic payment error to the user (never env names or raw MP errors in customer UI, §6.6).
    3. In `test`, `payer_email` on preapprovals (and `payer.email` on preferences) is taken from `MP_TEST_PAYER_EMAIL` (a test-buyer account email), not the user's real email. In `prod` it stays the user's email. Never send a test payer email in `prod` (assert).
    4. Log `mp_env`, the MP object id and `external_reference` on every create call (never tokens, card data or emails).
  - *Done when:* unit tests: the resolver returns matching token/key pairs per env; `payer_email` = `MP_TEST_PAYER_EMAIL` in test and the user's email in prod; grep test finds no MP env var reads outside `mp-config.ts`. Manual (OPS-19): a preview deploy with `MP_ENV=test` completes a subscription with a test buyer + test card, and the PR lists the resulting test Order ID / preapproval id.

- **B34 · Checkout charges $868.84 instead of $749.**
  > ⚠️ **SUPERSEDED 2026-10-03:** the "$749 / $7,490" expectation in this item is replaced. The charge must equal the **displayed price from the PRICING-CARDS-SPEC config** (`planPrice(planKey).totalCents`: today Pro mensual $997, Pro anual $9,970, VIP $3,799, VIP anual $36,325, IVA included). The code uses no `preapproval_plan` ids (card-token preapprovals; `pricing-map.md`). See `claude-prompt-chalyb-all-pending.md` WS-1 / WS-2. The "*Done when*" amounts below are history.
  - *Problem:* the rendered MP checkout showed "Chalyb Pro $868.84 / Total por mes $868.84". **$868.84 is exactly $749 × 1.16**, so the code (or the MP plan behind `preapproval_plan_id`) adds 16% IVA on top of a price that is already shown as the total. The customer would be charged more than the advertised price.
  - *Fix:*
    1. Find every place the amount sent to MP is computed (`transaction_amount`, `unit_price`, plan amounts) and make it read the **same value the page displays**, from the single pricing source (P2 §Config `PRICING`; until P2 lands, the existing `pricing.ts`). Remove any `× 1.16` / `ivaRate` multiplication from the charge path. IVA is only ever applied by the display/charge helper when `PRICES_INCLUDE_IVA=false`, and then the page shows that same total too (D1 / OPS-17).
    2. If the flow uses `preapproval_plan_id`, the amount comes from the plan object in MP, not from code: read the plan via the API at startup or in a health check and **log a mismatch** between the plan's `auto_recurring.transaction_amount` and `PRICING`. Fixing the plan itself is OPS-20.
  - *Done when:* unit test: the amount sent to MP for Pro mensual is `749` and for Pro anual is `7490` with `PRICES_INCLUDE_IVA=true`, and equals the displayed total with it `false`; a test fails if the charge amount and the displayed amount ever come from different functions. The PR includes a screenshot of the MP checkout showing $749.

- **B35 · Webhooks: 0% delivered in Producción.**
  - *Problem:* MP's Webhooks page (Producción, 2026-10-02) shows "0% Notificaciones entregadas" for `https://chalyb.com/api/mp/webhook`. Checked 2026-10-02 15:05 CT: `POST https://chalyb.com/api/mp/webhook` returns **308 → https://www.chalyb.com/api/mp/webhook**, and MP does not follow redirects, so every notification fails. `POST https://www.chalyb.com/api/mp/webhook` with no signature returns 400, which is correct.
  - *Fix:*
    1. Every `notification_url` the code sends (preferences, preapprovals) is built from the canonical origin helper (`NEXT_PUBLIC_APP_URL` = `https://www.chalyb.com`, P0 SEO fix) + `/api/mp/webhook`. No hard-coded host. Add a guard that refuses a non-www or non-https `notification_url` in `prod`. (The dashboard URL is OPS-4.)
    2. Webhook route: accept both the Webhooks format (JSON body `{ type, action, data: { id } }` plus `?data.id=&type=`) and the legacy IPN format (`?id=&topic=`, including `topic=merchant_order`, since the only real approved payment, Operación 182026865254, is a legacy `checkout_merchant_order`). Handle `payment`, `subscription_preapproval`, `subscription_authorized_payment` and `merchant_order`; any other type returns 200 and is logged.
    3. Signature: validate `x-signature` (`ts`, `v1`) with HMAC-SHA256 over the manifest `id:{data.id};request-id:{x-request-id};ts:{ts};` (lowercase `data.id` when it is alphanumeric; omit a part that is absent, per MP docs). The secret comes from `getMpEnv()` (test and prod may differ). Invalid signature → 401 with a log line that includes `mp_env` and the topic, never the secret. IPN-format calls that carry no signature are verified by fetching the resource from MP with the server token before acting on it.
    4. Respond 200 within 2 s: acknowledge first, then process (idempotent on the MP resource id; existing dedupe if present).
  - *Done when:* unit tests: signature manifest (with and without `x-request-id`, uppercase alphanumeric id), both payload formats, unknown type → 200, replayed notification → processed once. A test asserts every built `notification_url` starts with `https://www.chalyb.com/`. After deploy (OPS-4/OPS-19), MP's Webhooks page shows deliveries > 0% in both Prueba and Producción, and the "Simular notificación" button returns 200.

- **Not in scope:** migrating from the legacy Checkout / merchant_order flow to MP's newer Orders API. If the quality tool scores low because of it, note what it reports in the PR and add it as an open question; don't migrate here. After B33 lets a test payment complete, run the quality tool (OPS-19) and fix only the items it flags that are plain request fields (for example `external_reference`, `items[].id/title/description/category_id`, `payer.first_name/last_name`, `statement_descriptor`, device id via MP's security script), each listed in the PR.

### Tests
Unit: launch (popup branch via exported pure helper), `getEntitlements` matrix, plan-check grep test, empty-onClick/href test, credits-on-success and retry tests, error mapping, sitemap/robots origin, display names, i18n parity, customer-copy. E2E: `no-leaks.spec.ts` (Free/Pro/VIP/Admin), `clips-launch.spec.ts`, `aliases.spec.ts`, `seo-canonical.spec.ts`, `logout-en.spec.ts`, axe on touched pages, 360px overflow on touched pages.

### DONE WHEN
- [ ] All P0-1…P0-17 done-when lines pass, plus the §7.1 gates.
- [ ] **MP (P0-17):** a test-credential subscription completes on preview; the charge equals the displayed price ($749 / $7,490); every `notification_url` is `https://www.chalyb.com/api/mp/webhook`.
  > ⚠️ **SUPERSEDED 2026-10-03:** "$749 / $7,490" → "the charge equals the displayed price from PRICING-CARDS-SPEC config" (all-pending prompt WS-1 / WS-2).
- [ ] No customer page renders env names, config keys, log hints, raw errors, "Chaly*" names, "engine", "modo demo" or "simulación" (e2e no-leaks green for all four roles).
- [ ] "Abrir" on Clips works for an entitled user in both popup-allowed and popup-blocked contexts and is refused server-side for a non-entitled one.
- [ ] Canonical, hreflang, robots and sitemap all use `https://www.chalyb.com`.
- [ ] Migration file listed in the PR and in OPS-2. Prod reconcile listed in OPS-6.
- [ ] **BUILD-SPEC §4.3 acceptance:**
  - Across the account types available (Free/Pro/VIP/Admin now; `trial`, `pro_mensual`, `pro_anual` and `past_due` via fixtures, or optional `E2E_TRIAL_*` / `E2E_PAST_DUE_*` env accounts once P2 exists), the Clips flow ends at "Tus clips están listos" with downloadable clips (mock adapter, or SSO in Mode off).
  - No screen contains "Disponible", "Requiere Pro", "configuración quedó incompleta", "próximamente" or "beta" (e2e text scan).
  - Every visible button leads to a real action: a static test fails on an empty `onClick`, `href="#"` or `href=""` in customer components.
  - Gratis sees Pro tools as "Incluido en Pro · Pruébalo gratis", which leads to SCR-14 (or the current sign-up/subscription page while `TRIAL_FLOW_ENABLED=false`).
  - **Grandma test:** with a new Gratis account, paste a link and download a clip in ≤ 5 taps after login (e2e counts clicks).
  - **Pro test** ("Subir varios videos a la vez" in ≤ 2 taps from paso 2) is verified in P3 once SCR-06 exists.

---

## P1 · Fase 1: Design system, app shell, Inicio, Mi cuenta (BUILD-SPEC §5)
**Branch:** `claude/rebuild-p1-shell` · **Depends on:** P0 · **Closes:** — (foundation) · **BUILD-SPEC Fase 1: mockups 01, 07, 08, 09.** Also build `WizardShell` here (BUILD-SPEC §5.5) and re-skin P0's functional Clips routes with it.
**Goal:** The new light, Apple-like subscriber shell with tokens and components from §5. The new **Inicio** (01/08). Navigation is reduced to three items. Old routes keep working.

**Files:** `src/styles/chalyb-tokens.css` (new), `src/app/[locale]/globals.css` (import, scoped), `src/components/ui/*` (new primitives), `src/components/app/{app-shell,sidebar,bottom-tabs,task-card,banner}.tsx` (new), `src/app/[locale]/(dashboard)/app/layout.tsx` (swap the shell for `/app/*` only), `.../app/page.tsx` (new Inicio), `src/components/workspace/workspace-sidebar.tsx` (retire for `/app`; keep any admin usage), `messages/{es,en}.json` (`app.home.*`, `app.nav.*`).

### Fixes
**P1-1 · Tokens and primitives.** Implement §5 tokens (with the AA overrides) and the component list. Tokens are scoped under a wrapper class (e.g. `.chalyb-app`) or applied to the `/app` layout, the signup flow and the public layout only. *Done when:* a Storybook-free "kitchen sink" route `/app/_ui` exists **only in development** (guarded by `process.env.NODE_ENV !== 'production'`, 404 in prod) showing every primitive. Axe passes on it. `/dashboard` screenshots are unchanged (Playwright visual diff of `/dashboard` as Admin, threshold 0.1%).

**P1-2 · App shell.** Desktop sidebar, 272px (SCR-01): logo; nav **Inicio** → `/app`, **Mis resultados** → `/app/history` (relabel; P3 rebuilds the page as SCR-19), **Mi cuenta** → `/app/settings` (relabel; P2 rebuilds it as SCR-07). User card at the bottom (gradient avatar initials, `{nombre_completo}`, plan label key `nav.plan.{gratis|prueba|pro|pro_anual|vip}` → "Plan Gratis" / "Prueba Pro" / "Plan Pro" / "Plan Pro anual" / "Plan VIP"; admins see their effective plan plus a "Vista admin" link). Nav keys: `nav.inicio` "Inicio" · `nav.resultados` "Mis resultados" · `nav.cuenta` "Mi cuenta" (**exactly 3 items**, BUILD-SPEC §5.3). Sign out lives inside Mi cuenta and the user-card menu. Admins get an extra "Vista admin" link → `/dashboard`. Mobile < 900px: header with logo, **an Avisos bell at the top right** (BUILD-SPEC §5.4; P3 fills it) and avatar; bottom tabs `tab.inicio` "Inicio" / `tab.resultados` "Resultados" / `tab.cuenta` "Cuenta" (SCR-08). Old routes (`/app/engines`, `/app/subscription`, `/app/usage`, `/app/billing`, `/app/messages`, `/app/help`) stay reachable by URL and from inside Mi cuenta (P2). *Done when:* e2e: each nav item routes correctly on desktop and mobile; old routes return 200; keyboard tab order follows the visual order; 360px has no overflow.

**P1-3 · Inicio (SCR-01, SCR-08).** Build exactly per the subsections below. Card targets: **Clips** → `/app/clips` (P0's functional route) when the Clips adapter is on, until then the existing tool page `/app/engines/chalybclip` (the "Abrir" path from P0). **Señales** → `/app/engines/chalybcrypto` (P3 → `/app/senales`). **En vivo** → `/app/engines/chalybobs` (P3 → `/app/en-vivo`). **Más herramientas** → `/app/herramientas` (P3; until then `/app/engines`). "Lo último" shows the most recent real result (from the history source); if none, show the empty state (SCR-24 #1). **No mock data.** The plan strip copy depends on the entitlement (see SCR-01 states). *Done when:* unit tests for the strip/state selector; e2e for Free/Pro/VIP screenshots at 1440 and 360; a card click reaches the right route.

**P1-5 · Mi cuenta (SCR-07).** BUILD-SPEC puts Mi cuenta in Fase 1. Build its structure, groups and keys now; P2 wires the billing rows. *Done when:* e2e for Free/Pro/Admin renders Mi cuenta with no jargon and no mock data; "Ver mi plan" reaches the plan page.

**P1-4 · Banner slot.** Reserve the single top-banner slot in the shell (SCR-17). P2 fills it. It renders nothing in P1. *Done when:* the component exists with all four kinds in the dev kitchen sink.

### Screens
#### SCR-01 · Inicio (desktop) — mockup `01-inicio`
- Eyebrow: "Hola, {nombre} 👋" (first name; if missing, "Hola 👋").
- H1: "¿Qué quieres hacer hoy?"
- 2×2 task grid (first card highlighted with the accent ring):
  1. label **Clips** · h2 "Hacer clips de mi stream" · p "Crea clips cortos listos para TikTok, Reels y Shorts."
  2. **Señales** · "Recibir señales de cripto" · "Te avisamos cuándo comprar o vender, en tu celular." (BUILD-SPEC copy; signals are general and the same for every user of a plan, P3-5)
  3. **En vivo** · "Manejar mi transmisión" · "Controla tus escenas de OBS desde un solo lugar."
  4. **Y mucho más** · "Más herramientas" · "{lista de herramientas extra activas}." (mockup: "Asistente, Pronósticos, Inmuebles e Inversiones."). **Render this card only if at least one extra tool is active** (BUILD-SPEC §0.3: no dead-end cards). Otherwise the grid is 3 cards.
- Plan strip:
  - Pro/VIP/trialing: "Todo incluido en tu plan Pro. Sin pagos extra." (VIP: "…en tu plan VIP…"), with chips Clips · Señales · En vivo · Asistente · "y 3 más" (count the tools after the first four, not hard-coded).
  - Free: "Prueba Pro gratis 1 mes. Todas las herramientas incluidas." with button "Prueba Pro gratis 1 mes" → signup/trial flow, or "Volver a Pro" if the trial was used.
  - **Q7: until Pro = all tools is confirmed, the Pro strip copy is behind a config flag.**
- "Lo último" + link "Ver todo" → Mis resultados. Card: pill "Listos", title "Tus {n} clips están listos", meta "De tu stream “{título}” · {tiempo relativo}", button "Ver mis clips". Hide the section when there's no result yet; show SCR-24 #1 instead.
- Keys (BUILD-SPEC §5.1): `home.greeting`, `home.title`, `home.task.{clips,senales,envivo,mas}`, `home.included.pro`, `home.included.gratis`, `home.latest.{title,all,clips,from,cta}`.
- **States:** empty (hide "Lo último"; show `empty.clips`, SCR-24 #1) · loading (card skeletons, never a full-screen spinner) · error (gray banner "No pudimos cargar tus resultados." + "Intentar otra vez") · Gratis (trial strip instead of "Todo incluido").
- **Acceptance (BUILD-SPEC):** the grandma test identifies the task in < 5 s and opens it with 1 tap; the pro test reaches "Mis resultados" in 1 tap.
- Layout: content max-width 1040, padding `52px 64px 40px`; cards min-h 260, radius 24, gap 22. Non-active tools never appear.

#### SCR-08 · Inicio (mobile) — mockup `08-inicio-movil`
Same content; shorter descriptions: "Para TikTok, Reels y Shorts." · "Te avisamos cuándo comprar o vender." · "Controla OBS desde tu celular." · "Asistente, Pronósticos y más." (derived from active tools) Strip "Todo incluido en tu plan Pro". Bottom tabs Inicio/Resultados/Cuenta. Headings must wrap at 360 (remove nowrap).

#### SCR-07 · Mi cuenta — mockup `07-mi-cuenta` (BUILD-SPEC §5.2)
- Header: avatar initials, H1 "Mi cuenta", "{nombre} · {correo}".
- Route: the existing `/app/settings` (BUILD-SPEC proposes `/app/cuenta`; its rule §0.1 says to reuse an existing route that does the same; add `/app/cuenta` → `/app/settings` as a permanent redirect so both work).
- Keys: `account.title` "Mi cuenta" · `account.plan.k` "Tu plan" · `account.plan.cta` **"Ver mi plan"** (opens SCR-30; the mockup says "Ver planes", and BUILD-SPEC says production uses "Ver mi plan").
- Plan card: "Tu plan" / "Plan {Pro|VIP|Gratis} — {todo incluido|…}" / "Se renueva el {fecha} · ${monto} MXN al {mes|año}, IVA incluido" / "✓ Todas las herramientas" (only when true) / button "Ver mi plan" (→ Mi plan; Free → SCR-14). Until P2 merges, "Ver mi plan" goes to the current `/app/billing`.
- "Mi plan y pagos": `account.credits` "Créditos disponibles" · "Usaste {usados} de {total} este mes" · "Se renuevan el {fecha_corta}" (numbers hidden until `PRICING.credits` is set; Q13) · "Método de pago" "{marca} ••{ultimos4}" · "Facturas" (**no "CFDI listo"** until Q11; see SCR-30). P2 wires these rows to real billing data.
- "Mis redes conectadas": YouTube / Twitch / TikTok rows. **Backend pending:** the hub has no account-linking API. Show the rows only when the engine reports a connection (Mode A), otherwise hide the group (Q4).
- "Preferencias": Idioma (es/en, real switch), Notificaciones (real channels only; no "celular" unless SMS/WhatsApp exists).
- "Ayuda": `help.human.title` "Hablar con una persona" · "Te respondemos en minutos, en español." (**config-driven, Q16**; contacto currently promises < 24 h hábiles) · button "Escribir" (`btn-ok`; use `--ok-text` for AA).
- Legal additions (legal docs reference these paths): "Privacidad y notificaciones", "Mis datos (derechos ARCO)", "Cuentas conectadas → Desconectar", "Ayuda → Problema con un cobro", "Cerrar mi cuenta", "Cerrar sesión". BUILD-SPEC §5.2 lists only the four groups, but the legal docs require these paths, so add them as a plain Group "Privacidad y cuenta" at the bottom, using the same `Group`/`Row` components. P6-8 wires the forms.
- Existing settings (profile, password, sessions) stay reachable as sub-pages.

### Tests
Unit: plan-strip selector (Free/trialing/Pro/VIP/admin), nav config. E2E: shell navigation desktop and mobile, 360 overflow, axe, `/dashboard` visual unchanged.

### DONE WHEN
- [ ] §7.1 gates green; P1-1…P1-5 done-when lines pass.
- [ ] `/app` matches mockups 01/08 and `/app/settings` matches 07 in structure and copy (PR screenshots side by side) with only real data.
- [ ] Admin `/dashboard` visually unchanged; every old `/app/*` URL still returns 200.

---

## P2 · Fase 2: Cuenta, prueba gratis y cobros (BUILD-SPEC §6, with §10.3 consent log and §11.1–§11.3 in the same PR)
> ⚠️ **SUPERSEDED 2026-10-03:** P2 is built (stack `claude/rebuild-p2-trial-billing`). Its amounts ($749 / $7,490 / $2,499), the **30-day ("1 mes") trial**, and "Anual preselected" are replaced by the all-pending prompt WS-2 / WS-3: **7-day trial on Pro mensual and Pro anual only**, day-0 charge notice, Pro mensual preselected (never the anual), prices from PRICING-CARDS-SPEC.
**Branch:** `claude/rebuild-p2-trial-billing` · **Depends on:** P0, P1 · **Closes:** B06 (entitlement), B11 (rebuild), B15 (verify), B17 (verify), B30 · **Mockups:** 12, 13, 14, 15, 16, 17, 18, 30 (and 26 for in-app notices)
**Goal:** An App-Store-style subscription. The user picks the plan the trial converts into: Pro anual $7,490 (preselected) or Pro mensual $749, IVA incluido. They add a card through the embedded Mercado Pago Brick, tick a **required, unchecked recurring-charge checkbox**, and get 1 free month of Pro. Every acceptance is logged as evidence. A 7-day notice precedes every charge, and no charge happens without a delivered notice. Cancel takes 2 clicks with "Sí, cancelar" always visible. Mi plan covers every state.
**Text sources (precedence):** `legal/aceptacion-ux.md` §1–§5 (governs) → BUILD-SPEC §6 (keys + exact copy) → `trial-to-paid-path.md` (aligned with the legal review; §9-D) → mockups. The original owner trial prompt is superseded where §9-B says so.

**Launch gate:** the whole flow ships behind `TRIAL_FLOW_ENABLED` (default **false**). **No real charge is enabled** until D1 (IVA), D2 (Quebec) and the attorney's signature are closed (BUILD-SPEC §13; OPS-10, OPS-17). A startup assertion refuses `TRIAL_FLOW_ENABLED=true` while `LEGAL_PUBLISH=false` (P6). With the flag off, today's subscription pages keep working unchanged.

**Files:** `src/lib/payments/{mercadopago,mp-config,subscription-actions,subscription-sync,subscription-reference,pricing}.ts`, `src/app/api/mp/webhook/route.ts`, `src/lib/billing/{tiers,money,money-data,subscription-period,entitlement}.ts`, new `src/config/pricing.ts` (or extend the existing plans config; BUILD-SPEC §6.1), new `src/lib/billing/{billing-copy,consent,reminders,format}.ts`, `src/components/payments/mp-card-brick.tsx` (reuse), `src/components/auth/*`, new routes `src/app/[locale]/(dashboard)/app/{prueba,prueba/pago,prueba/listo,planes}/page.tsx`, `.../app/billing/page.tsx` (= **Mi plan**; alias `/app/cuenta/plan`), `src/components/app/{trial-banner,disclosure-block,confirm-step,seller-sheet}.tsx`, `src/lib/email/{resend,templates}.ts`, new `src/app/api/cron/billing/route.ts`, new `src/app/api/resend/webhook/route.ts`, `vercel.json` (`crons`), new migration `00NN_trial_billing_consent.sql`, `messages/{es,en}.json`.

### Config: one pricing source (BUILD-SPEC §6.1). No amount is ever written by hand in components, emails or legal text.
> ⚠️ **SUPERSEDED 2026-10-03:** the values in this block (`trial.days: 30`, `pro: { month: 749, year: 7490 }`, `vip: { month: 2499 }`, `defaultInterval: 'year'`) are history. Current config: PRICING-CARDS-SPEC §13 / all-pending WS-2.
```ts
// src/config/pricing.ts (extend the existing plans config if there is one; keep pricing.ts cents in sync from here)
export const PRICING = {
  currency: 'MXN',
  taxIncluded: env.PRICES_INCLUDE_IVA ?? true,        // D1, see Q1
  ivaRate: 0.16,                                       // TODO(accountant)
  billingToggleEnabled: env.TRIAL_PLAN_CHOICE_ENABLED ?? true, // Mensual/Anual choice, default ON
  defaultInterval: 'year',                             // Anual preselected
  trial: { days: 30, plan: 'pro', requiresCard: true, reminderDaysBefore: 7 },
  plans: { gratis: { month: 0 }, pro: { month: 749, year: 7490 }, vip: { month: 2499 } }, // VIP has no annual
  reminders: { monthDaysBefore: 7, yearDaysBefore: [30, 7] },
  graceDays: 7,                                        // terms [DÍAS DE GRACIA], Q12
  credits: { gratis: null, pro: null, vip: null },     // D8: owner sets them; null = hide credit numbers
  maxVideoHours: { gratis: null, pro: null, vip: null }, // D8, used by error.tooLong
};
```
- **Derived, never stored:** `yearMonthlyEquivalent = round(year/12)` ($624), `yearVsMonthly = 12×month` ($8,988), `yearSavings = 12×month − year` ($1,498). A unit test validates all three.
- `PRICES_INCLUDE_IVA=false` switches the displayed totals to price × (1 + ivaRate) ($868.84 / $8,688.40 / $2,898.84) and recomputes the derived values. No component change.
- `TRIAL_PLAN_CHOICE_ENABLED=false` (BUILD-SPEC `billingToggleEnabled`) hides the toggle and the Mensual option and leaves only `defaultInterval`. **The billing block still shows the real amount and period.**
- Values < 5 for any `reminders`/`reminderDaysBefore` entry fail at startup (art. 76 Bis fr. VIII: ≥ 5 calendar days).
- Other flags: `TRIAL_FLOW_ENABLED=false`, `QUEBEC_PAID_BLOCK=true` (BUILD-SPEC §11.8 option B until D2), `TRIAL_DAY29_REMINDER_ENABLED=false` (D5), `TRIAL_CONSENT_ALSO_ON_PLAN_STEP=false` (D3), `LEGAL_ENTITY_*` (name, address, phone, email for "Quién vende"; values are OPS), MP plan ids for `pro_month`, `pro_year`, `vip_month` in the **existing** MP env var pattern (don't rename existing vars; add new ones following it), `CRON_SECRET`, `RESEND_WEBHOOK_SECRET` (names only).

### Fixes

**P2-1 · Entitlements with trial and billing state**
- *Problem:* the trial states don't exist; access decisions must stay in one place.
- *Fix:* extend P0's `getEntitlements(userId)` (keep `{ plan, trial, tools, credits }`) with `state: 'free'|'trialing'|'pro'|'past_due'|'cancelled_active'`, `planKey: 'pro_month'|'pro_year'|'vip_month'|null`, `trialEndsAt`, `nextChargeAt`, `graceEndsAt`, `cardBrand`, `cardLast4`, `cardExp`, `trialUsed`, `cancelAtPeriodEnd`, `pendingChange`, `reminderDeliveredAt`.
  - `trialing`, `past_due` (inside grace) and `cancelled_active` (until period end) get full Pro.
  - **Pro includes all tools** (owner trial spec + every mockup; Q7). Implement with `PRO_INCLUDES_ALL_TOOLS=true`, which replaces the "1 selected live engine" rule for Pro. Existing paid Pro users gain access; nobody loses any.
  - VIP and admins → `pro` with VIP caps.
- *Done when:* a unit matrix covers state × plan × role × tool. A grep test finds no plan checks outside `entitlement.ts` / `tiers.ts`.

**P2-2 · Data model (one migration, `00NN_trial_billing_consent.sql`, idempotent)**
- **First inspect migration 0037's subscription table and extend it**; don't create a parallel one.
- *Account level* (so cancelling or deleting a subscription can't reset it): `profiles.pro_trial_started_at`, `profiles.pro_trial_ends_at`.
- *Subscription:* `plan_key`, `status`, `trial_ends_at`, `next_charge_at`, `grace_ends_at`, `card_brand`, `card_last4`, `card_exp`, `cancel_at_period_end`, `cancelled_at`, `pending_plan_key`, `pending_effective_at`, `mp_preapproval_id unique`, `reminder_due_at`, `reminder_delivered_at`, `charge_hold_until`.
- `payment_method_fingerprints` (`hash` unique, `user_id`): only a hash of MP's stable payment-method id, never card data (one trial per person, card or account). If MP exposes no stable id, say so in the PR.
- **`consent_events`** implemented **exactly** as `aceptacion-ux.md` §10 (BUILD-SPEC §10.3):
  - events §10.1 (+ `voice_likeness_consent` from BUILD-SPEC §11.6) and fields §10.2;
  - append-only: no UPDATE/DELETE grants for the app role, plus a trigger that raises;
  - server UTC time; `prev_event_hash` / `event_hash` chain;
  - IP and user agent encrypted at rest (pgcrypto or app-level) with restricted reads;
  - retention 10 years (72 months for non-compliance flags) documented in a comment and in OPS.
- `cancellation_events` (`folio_cancelacion`, `user_id`, `subscription_id`, `requested_at`, `access_until`, `email_message_id`) (BUILD-SPEC §6.9).
- `email_dispatches` (`user_id`, `kind`, `period_key`, `template_id`, `template_version`, `provider_message_id`, `sent_at`, `delivery_status`, `delivered_at`, `bounced_at`; unique (`user_id`, `kind`, `period_key`)).
- `billing_movements` (or extend `payments`): every MP `payment` / `subscription_authorized_payment` webhook as a row with `kind`, amount, IVA amount, status (Cobrado / Falló / Reembolsado). It's the Dinero source (P5), and **the money truth in `docs/payments/money-truth.md` stays the single source**: extend it, don't fork it.
- *Done when:* the migration applies twice cleanly locally (document how). A test that tries UPDATE/DELETE on `consent_events` fails. Listed in OPS-2.

**P2-3 · Mercado Pago subscriptions with a free month**
- *Fix:* read MP's current Subscriptions docs first. One `preapproval_plan` per combination: `pro_month`, `pro_year` (both with `free_trial` of 1 month / 30 days, per what MP supports) and `vip_month` (no trial). Ids come from config. Create one `preapproval` per user from the Brick's `card_token_id`, with `external_reference` = our user id (`subscription-reference.ts`). If free_trial + 12-month frequency doesn't work in MXN, use the closest MP-native option (`start_date` = now + trial). **No custom charge job** unless MP truly can't do it. Explain the choice in the PR. Reuse the hosted Brick page pattern from PRs #15/#16.
- *Done when:* in MP sandbox a test card creates an authorized preapproval with the right amount, frequency and first charge date, and our DB matches it.

**P2-4 · Trial start, one trial per person, card or account**
- *Fix:*
  - On authorized (webhook, or verified return + server fetch), set `trialing`, the dates and the card info. Grant Pro immediately. Send Email 1 (it's evidence: versions + folio). Link the `trial_started` consent event written at submit. Fire `trial_start`.
  - A second attempt (account already used a trial, or a reused card hash) gets BUILD-SPEC §6.5's states: "Elige tu plan Pro" with no "gratis" and "Hoy se cobran ${monto} MXN". When anti-fraud rejects the card: "Esta tarjeta ya tuvo una prueba gratis. Puedes elegir un plan y empezar hoy." plus a way to request **human review** (Aviso de Privacidad §5.1; REVISION-LEGAL: automated decisions need human review).
  - **Legacy trial:** the owner spec says the old signup-token trial is replaced. With `TRIAL_FLOW_ENABLED`, stop starting the 7-day Clips trial and the welcome-gift trial banner for new accounts and honor the active ones (Q8).
- *Done when:* the trial-start and one-trial tests pass (see Tests).

**P2-5 · Webhooks (extend the existing verified route; idempotent per MP event/payment id)**
- *Fix:* handle the topics MP actually sends (verify them; BUILD-SPEC names `payment`, `subscription_preapproval`, `subscription_authorized_payment`):
  - **authorized** → trial start;
  - **payment approved** → `pro`, `next_charge_at`, one `billing_movements`/`payments` row with the right `kind`, Email 3, `conversion` (first charge after a trial), `charge_succeeded` event;
  - **rejected** → `past_due`, `grace_ends_at`, Email 3b, red banner, `payment_failed`, `charge_failed` event;
  - **cancelled/paused** → access until the period end;
  - **refund** → "Reembolsado" movement + `refund_issued`;
  - **chargeback/dispute** → suspend only the disputed period's paid features; Gratis and content download stay (terms §10.2, REVISION-LEGAL M6).
- *Done when:* unit tests with recorded sandbox payloads per topic pass. Replays don't double-write. A bad signature is rejected.

**P2-6 · Notices before every charge + the bounce rule (BUILD-SPEC §6.11, §11.3; aceptacion-ux §4)**
- *Fix:*
  1. **Schedule** (cron, P2-8):
     - trial pre-charge notice **7 days before** (day 23);
     - **every** monthly renewal 7 days before;
     - **every** annual renewal **30 and 7 days** before;
     - optional day-29 reminder (`TRIAL_DAY29_REMINDER_ENABLED`, D5);
     - one annual summary per year for monthly plans (Email 6).
  2. **Channels per notice:** email + in-app banner (`trial_last7` / `banner.renew`) + in-app notification (`notif.trial7` / `notif.renew`) + WhatsApp when that channel exists for the user (BUILD-SPEC §6.11 names "app/WhatsApp").
  3. **Evidence:** store the Resend `message_id`, template id and version in `email_dispatches`, and write `charge_notice_sent` / `renewal_notice_sent` / `annual_reminder_sent`. A verified Resend webhook (`/api/resend/webhook`) records delivered and bounced, and writes `notice_bounced`.
  4. **Bounce rule (mandatory, terms §2.7 bis):** if a pre-charge notice bounces or isn't delivered, show the banner and the in-app notice, try the alternate channel, and **don't charge until 5 calendar days after an effective notice**. Implement it as a hold in the billing job. `reminder_delivered_at` is required: when it's missing 24 h before `next_charge_at`, pause the preapproval or move its next payment date via the MP API (confirm the API in the PR; OPS-14), set `charge_hold_until = effective_notice_at + 5 days`, and resume after that. The bounce also shows in the admin "Necesita tu atención" list (P5). A charge made without notice is refundable (terms §7.3): surface it to admin.
- *Done when:* unit tests pass for the schedule (trial, monthly, annual 30+7, CT boundary days), idempotency (two cron runs send once), the bounce → hold → resume sequence (MP mocked: no charge before hold end), and the delivered → no-hold path.

**P2-7 · Cancel (BUILD-SPEC §6.9, aceptacion-ux §5)**
- *Fix:*
  - 2 clicks: Mi plan → "Cancelar prueba" / "Cancelar suscripción" → sheet → "Sí, cancelar".
  - Cancel the MP `preapproval` **immediately**, so no future charges remain. Access continues to the period end.
  - Write `cancellation_events` (+ `cancellation_requested` consent event, and `retention_offer_shown` if the offer rendered), using folio `folio_cancelacion`. Send Email 7 "Cancelaste tu plan · Folio {folio}" with the aceptacion-ux §5 body ("Confirmamos tu cancelación (folio {folio_cancelacion}) el {fecha_hora_cancelacion}. Tu acceso de pago termina el {fecha_fin_acceso}. No habrá más cobros.").
  - Cancel the pending reminders. Fire `cancel`. **Cancellation is never blocked by a debt** (past_due shows it too).
  - At most one retention offer (only for an annual plan: "¿Prefieres pagar mes a mes?" [Cambiar a $749 al mes]), and **"Sí, cancelar" stays visible on the same screen with the same visual weight** (`btn-dark` vs `btn-primary`, same size).
  - "Volver a activar Pro" before the end date resumes the same plan from the period end: no new trial, no immediate charge, and a new `subscription_started` consent with the checkbox.
- *Done when:* the e2e cancels in 2 clicks. Afterwards no scheduled charge exists in MP (mock assertion). "Sí, cancelar" is visible without scrolling at 1440×900 and 390×844.

**P2-8 · Scheduled jobs**
- *Fix:* there's no scheduler today. Add `src/app/api/cron/billing/route.ts`, which requires `Authorization: Bearer ${CRON_SECRET}` (401 otherwise), plus `"crons": [{ "path": "/api/cron/billing", "schedule": "0 * * * *" }]` in `vercel.json`. Each run is idempotent and:
  - sends due notices (P2-6);
  - enforces bounce holds;
  - expires grace → `free`;
  - expires cancelled trials/periods → `free`;
  - reconciles MP movements hourly (Dinero's "se actualiza cada hora").
- *Done when:* tests pass for two runs on the same clock with no duplicates, plus the 401 path.

**P2-9 · Plan changes (BUILD-SPEC §6.10; replaces the owner prompt's "all switches at renewal, no proration")**
- *Fix:*
  - **Upgrade to VIP** is immediate, with the proration shown **before** confirming ("Hoy se cobrarán ${ajuste} MXN. Después, $2,499 MXN cada mes.") plus a `ConfirmStep` that carries the recurring-charge checkbox (the §3.3 text with the new amount and period).
  - **Downgrades and period changes** (Pro mensual ↔ anual, VIP → Pro, → Gratis) take effect at the end of the paid period, confirmed with "Tu cambio empieza el {fecha}. Hasta entonces sigues con {plan}."
  - During the trial, "Cambiar a Pro mensual/anual" changes the plan the trial converts into, before the first charge.
  - Every change writes a `plan_changed` consent event.
  - Prefer updating the preapproval; otherwise create the new one starting at the period end and cancel the old one at that moment. **Never two charging preapprovals, never a gap.**
  - Terms §4.3 (mensual→anual immediate with credit) differs from BUILD-SPEC (at the next charge date): build BUILD-SPEC; Law aligns the terms (Q9).
- *Done when:* tests pass for: VIP upgrade proration math + consent required (422 without it); downgrade scheduled and undoable; trial switch with no charge; no double preapproval.

**P2-10 · Price display rules (BUILD-SPEC §6.2, §11.1) as deploy-blocking tests**
- *Fix:*
  - Shared helpers `formatMXN()` and `formatFechaLarga()` (America/Mexico_City; stored UTC).
  - Price keys per BUILD-SPEC §6.2: `price.pro.year.big` "${monto} MXN al año" · `price.pro.year.eq` "(equivale a ${mensual} al mes)" · `price.renew.year` "Se renueva cada año" · `price.renew.month` "Se renueva cada mes" · `price.save.year` "Ahorras ${ahorro} al año" · `price.vs.month` "vs. ${total_mensual} pagando mes a mes" · `price.pro.month.big` "${monto} MXN al mes" · `price.month.line` "${monto} MXN al mes · se renueva cada mes" · `price.tax` "Precios en MXN, IVA incluido."
  - Rules: Pro anual big "$7,490 MXN al año", small "(equivale a $624 al mes)" · "Se renueva cada año" · pill "Ahorras $1,498 al año" · optional "vs. $8,988 pagando mes a mes". Pro mensual "$749 MXN al mes" + "Se renueva cada mes". VIP "$2,499 MXN al mes" + "Se renueva cada mes". Gratis "$0" + "Sin tarjeta · Para siempre".
  - **Never:** "$624/mes" as the big number; "2 meses gratis" anywhere (UI, emails, metadata, ads copy in repo); a struck-through "$8,988" (it may appear only as "vs. $8,988 pagando mes a mes"); $624 near the card form or in any billing block.
- *Done when:* `tests/price-rules.test.ts` scans `messages/*`, the email templates and the built client bundle (`.next/static/**`) and fails on "2 meses gratis", on "$8,988" not inside the "vs. … pagando mes a mes" key, and on "624" in billing-block keys. The derivation test passes.

**P2-11 · Quebec (BUILD-SPEC §11.8; D2)**
- *Fix:* with `QUEBEC_PAID_BLOCK=true` (default until the owner decides), block paid plans for Quebec residents. Detect via the billing address / card country-province from MP, plus a declaration at sign-up or checkout. Message `quebec.blocked` "Por ahora los planes de pago no están disponibles en Quebec." Gratis stays only if legal approves (Q2). Option A (French translation + special clauses) is out of scope until decided.
- *Done when:* a unit test for the detector; an e2e with a Quebec fixture blocks SCR-14/15/Planes CTAs.

**P2-12 · Mi plan, Mi cuenta billing rows, history (B11, B30, B15, B17)**
- *Fix:*
  - Rebuild `/app/billing` as **Mi plan** (SCR-30 / SCR-18, all 6 states) and wire Mi cuenta's billing rows. No "MP #id", no route paths, no "tier".
  - The history lists real movements with plain labels ("Pro anual", "Pro mensual", "VIP", "Créditos extra", "Reembolso").
  - **Verify B15:** after a sandbox payment the history isn't empty. If it is, fix the webhook → insert path; delivery causes go to OPS-1/OPS-4.
  - **Verify B17:** search `/app/usage` and the token-pack copy for "$10 cobro de prueba" / "1000 tokens". Fix it if found, or report "not reproducible on main".
- *Done when:* fixtures and screenshots exist for all 6 Mi plan states. No state lacks a cancel button while future charges exist. The jargon test passes.

**P2-13 · "Quién vende" and pre-payment identity (art. 76 Bis fr. III)**
- *Fix:* `SellerSheet` (route `/quien-vende` too; P6 links it from the footer) shows the legal name, address, phone, email and complaint channels from `LEGAL_ENTITY_*`. It's linked from SCR-15 next to the security line. If any value is empty, `TRIAL_FLOW_ENABLED` can't be turned on (startup assertion).
- *Done when:* unit tests for the assertion; e2e opens the sheet from SCR-15.

### Screens (copy keys and exact strings from BUILD-SPEC §6; text inside quotes is verbatim)
#### SCR-12 · Planes — `/planes` (public, P4 adds SEO) and `/app/planes` — mockup `12-planes` (BUILD-SPEC §6.3)
`PublicNav`; `Segmented` Mensual / Anual (Anual active; pill "Ahorras $1,498"); 3 cards: Gratis · Pro (highlighted, badge "Recomendado") · VIP; "Qué incluye" checklist; FAQ; `PublicFooter`.
- Keys: `plans.title` "Un plan. Todas las herramientas." · `plans.sub` "Prueba Pro gratis 1 mes. Cancela cuando quieras." · `plans.toggle.month` "Mensual" · `plans.toggle.year` "Anual" · `plans.gratis.name` "Gratis" · "Para conocer Chalyb" · "Sin tarjeta" · "Para siempre" · `plans.gratis.cta` "Crear cuenta gratis" · `plans.pro.badge` "Recomendado" · `plans.pro.name` "Pro" · "Todas las herramientas" · prices per P2-10, plus "vs. $8,988 pagando mes a mes" under the annual block as plain text, **never struck through** (mockup 12; BUILD-SPEC §6.2 optional line) · `plans.pro.cta` "Prueba Pro gratis 1 mes" · `plans.pro.note` "Hoy pagas $0. Te avisamos 7 días antes del primer cobro." · `plans.vip.name` "VIP" · "Para quien lo usa todos los días" · "Sin plan anual" · `plans.vip.cta` "Elegir VIP" · `plans.pro.monthAlt` "o $749 MXN al mes con Mensual".
- Mockup bullets: Gratis ✓ "Clips para probar" · ✓ "Tus resultados guardados" · ✓ "Ayuda por correo" · ✗ "Señales, En vivo y las demás herramientas". Pro: "Las {n} herramientas: {lista}" (from active tools, §4) · "{créditos} créditos cada mes" (hidden while `credits.pro` is null; D8) · "Clips sin marca de agua" · "Opciones avanzadas para profesionales" · "Ayuda de una persona por WhatsApp" (only if WhatsApp support exists; D6). VIP: "Todo lo de Pro" · "Muchos más créditos cada mes" · "Atención prioritaria por WhatsApp" · "Primero en recibir herramientas nuevas".
- Toggle on Mensual: Pro shows "$749 MXN al mes" + "Se renueva cada mes", "Ahorras" disappears, and the CTA stays the same.
- States: logged in → "Tu plan actual" (disabled) on the user's plan · Pro trialing → "Ya estás probando Pro" · Pro → VIP → "Subir a VIP".
- FAQ answers (from `more_public.py`): "¿Qué pasa cuando termina mi mes gratis?" → "Sigues con el plan que elegiste (anual o mensual) y se cobra a tu tarjeta. Te avisamos por correo 7 días antes. Si cancelas antes, no pagas nada." · "¿Puedo cambiar de anual a mensual?" → "Sí, desde Mi cuenta → Mi plan, cuando quieras." · "¿Qué son los créditos?" → "Son lo que usan las herramientas para trabajar, por ejemplo, cada clip. Tu plan trae créditos nuevos cada mes." · "¿Puedo cancelar cuando quiera?" → "Sí. Es 1 clic desde Mi cuenta. Sigues con tu plan hasta el final del periodo que pagaste."
- Acceptance: grandma reads "$7,490" as the yearly cost · pro switches to Mensual in 1 tap · the "2 meses gratis" bundle test passes.

#### SCR-13 · Paso 1 · Crear cuenta — `/sign-in?mode=signup&intent=trial` (existing route) — mockup `13-crear-cuenta` (BUILD-SPEC §6.4)
`WizardShell` ("Prueba Pro gratis", "Paso 1 de 3"), Google button, divider, 3 `Field`s, marketing `Checkbox`, side box.
- Keys: `signup.title` "Crea tu cuenta" · `signup.sub` "Toma 1 minuto. No necesitas tarjeta en este paso." · `signup.google` "Continuar con Google" · `signup.or` "o con tu correo" · `signup.name` "Tu nombre" · `signup.email` "Correo" · `signup.password` "Contraseña" · `signup.password.hint` "Mínimo 8 letras o números" (**enforce 8 server-side**; Supabase policy is OPS-16) · `signup.cta` "Crear cuenta" · `signup.legal` "Al crear tu cuenta aceptas los [Términos y Condiciones](/terminos) y la [Política de Uso Aceptable](/uso-aceptable), y confirmas que leíste el [Aviso de Privacidad](/privacidad). Debes tener 18 años o más." · `signup.marketing` "Quiero recibir novedades, consejos y promociones de Chalyb por correo. Puedo darme de baja cuando quiera." (**unchecked**) · `signup.side.title` "Tu mes de Pro gratis" · "Todo incluido" · "Hoy pagas $0" · "Te avisamos 7 días antes de cualquier cobro. Cancela en 1 clic." · `signup.have` "¿Ya tienes cuenta?" · "Entrar".
- States: email exists ("Ya tienes cuenta con este correo. [Entrar]") · short password (hint below the field, no red until blur) · Google cancelled (returns without error) · loading ("Creando tu cuenta…").
- Logs `signup_terms_accepted` (versions of Términos, Uso aceptable and Aviso) and `marketing_opt_in` only if checked. **No browsewrap:** remove any "al usar aceptas" copy. No extra fields.
- Acceptance: grandma finishes with Google in 2 taps.

#### SCR-14 · Paso 2 · Tu prueba — `/app/prueba` — mockup `14-tu-prueba` (BUILD-SPEC §6.5)
`WizardShell` ("Paso 2 de 3"), 2 radio cards (Anual preselected, Mensual), a live `DisclosureBlock`, `btn-xl` "Continuar al pago", `price.tax`.
- Keys: `trial.title` "Prueba Pro gratis 1 mes" · `trial.sub` "Todas las herramientas incluidas. Cancela cuando quieras." · `trial.q` "¿Qué plan quieres cuando termine tu mes gratis?" · annual option "Pro anual" + P2-10 annual block + pills "Recomendado" and "Ahorras $1,498 al año" · monthly "Pro mensual" + "$749 MXN al mes" + "Se renueva cada mes" · `trial.cta` "Continuar al pago".
- `DisclosureBlock` (exact text, aceptacion-ux §3.2):
  - `disclosure.today` "**Hoy pagas $0.** Tu mes gratis termina el **{fecha_fin_prueba}**."
  - `disclosure.charge` "Si no cancelas antes, el **{fecha_cobro}** se cobrarán **${monto} MXN** {periodicidad} a {tarjeta}, y se renovará automáticamente {renovacion} hasta que canceles."
  - `disclosure.reminder` "Te avisaremos por correo el **{fecha_recordatorio}** (7 días antes)."
  - `disclosure.cancel` "Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el {fecha_fin_prueba} y no se te cobra nada."
  - Variables: `{periodicidad}` "por 1 año de Pro" / "por tu primer mes de Pro" · `{renovacion}` "cada año ($7,490 MXN)" / "cada mes ($749 MXN)" · `{tarjeta}` "la tarjeta que registres" / "tu tarjeta terminación {ultimos4}".
- States: trial already used → "Elige tu plan Pro" with no "gratis" and "Hoy se cobran ${monto} MXN" (then SCR-15 without the free month) · anti-fraud rejection (P2-4) · Quebec (P2-11).
- With `TRIAL_CONSENT_ALSO_ON_PLAN_STEP=true` (D3, if the attorney asks), the §3.3 checkbox also appears here and "Continuar al pago" stays disabled until it's checked.
- Acceptance: switching the plan updates amount and period in < 100 ms · the big amount is always the real charge.

#### SCR-15 · Paso 3 · Pago — `/app/prueba/pago` — mockup `15-pago` (BUILD-SPEC §6.6)
`WizardShell` ("Paso 3 de 3"); one-line notice; the **embedded Card Payment Brick** (themed: radius 12, Inter; redirect only if embedding is impossible); security line + "Quién vende"; **required unchecked `Checkbox`**; `btn-xl` "Empezar mi mes gratis" (disabled until checked); "Resumen" card.
- `pay.title` "Agrega tu tarjeta"
- `pay.oneLine` "Hoy pagas **$0**. Primer cobro: **${monto} MXN** el **{fecha_cobro}** y después **{cada_periodo}**, salvo que canceles antes." (`{cada_periodo}` "cada año" / "cada mes"). **Amount and period are mandatory.**
- `pay.secure` "Pago seguro con Mercado Pago. Chalyb no guarda el número de tu tarjeta." · `pay.seller` "Quién vende" (P2-13).
- `pay.consent` (aceptacion-ux §3.3, exact): "Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {renovacion_corta} a mi tarjeta, y acepto los [Términos de Suscripción](/suscripcion)." (`{renovacion_corta}` "y cada año después" / "y cada mes después").
- `pay.cta` "Empezar mi mes gratis" · `pay.cta.hint` "Marca la casilla para continuar. Puedes cancelar cuando quieras." · `pay.consent.error` "Marca la casilla para confirmar el cobro automático. Puedes cancelar cuando quieras."
- Resumen: "Plan al terminar la prueba" {plan} · "Tu mes gratis termina" {fecha_fin_prueba} · "Te avisamos por correo" {fecha_recordatorio} · "Primer cobro" ${monto} MXN / {fecha_cobro} · "Después" "${monto} MXN cada año|cada mes" · "IVA incluido: ${iva}" (terms §1.2) · "Total hoy" "$0" · link "Cambiar a Pro mensual ($749 al mes)" / "Cambiar a Pro anual ($7,490 al año)" (hidden when `TRIAL_PLAN_CHOICE_ENABLED=false`).
- States: card declined ("Tu banco no aceptó esta tarjeta. Prueba con otra o habla con tu banco.") · the Brick's own validation (Spanish) · loading ("Guardando tu tarjeta…", double-click locked) · 3DS (bank modal, then continue).
- **Server:** on confirm, create the `preapproval` and write `trial_started` in `consent_events` with: Suscripción version + sha256, `disclosure_text` (exact rendered text) + hash, `checkbox_text`, `checkbox_checked=true`, `button_label`, amount, `billing_interval`, trial end / charge / reminder dates (UTC), last 4, IP, user agent, surface `web_checkout_trial`, `ui_version`. **Without a checked box the endpoint returns 422.** The rule lives on the server, not only in the button.
- Acceptance: e2e shows the button disabled without the box; with it, the subscription and the event are created; an automated test proves the box never renders checked; a direct POST without consent → 422.

#### SCR-16 · Listo — `/app/prueba/listo` — mockup `16-listo` (BUILD-SPEC §6.7)
`done.title` "¡Listo, {nombre}!" / "Tu mes de Pro gratis ya empezó." · `done.sub` "Termina el {fecha_fin_prueba}. Primer cobro: **${monto} MXN** el {fecha_cobro} a tu tarjeta ••{ultimos4}." · recap "Hoy pagaste" "$0" · "Tu mes gratis termina" · "Te avisamos por correo" · "Primer cobro ({plan})" "{marca} ••{ultimos4} · se renueva {cada_periodo} hasta que canceles" · `done.cta` "Hacer mis primeros clips" (→ Clips paso 1) · `done.plan` "Ver mi plan" · `done.footer` "Te enviamos estos datos a {correo} · Folio de tu aceptación: {consent_id}" (a short display form is allowed, but it must resolve to the same `consent_events` id). Email 1 is sent now. Acceptance: 1 tap to Clips paso 1; the folio equals `consent_events.consent_id`.

#### SCR-17 · TrialBanner — mockup `17-banners` (BUILD-SPEC §6.8)
One line + one button, above the content, **one at a time** (priority: past_due > last 7 > ended > active):
- `trial_active` (days 0–22, `--tint2`): `banner.trial` "Prueba Pro gratis · te quedan {n} días" [Ver mi plan]
- `trial_last7` (days 23–30, amber): `banner.last7` "Tu prueba termina el **{fecha_fin_prueba}**. Se cobrarán **${monto} MXN** el **{fecha_cobro}**." [Ver mi plan]
- `trial_ended` (neutral): `banner.ended` "Tu prueba terminó. Estás en el plan Gratis." [Volver a Pro]
- `past_due` (red): `banner.pastDue` "No pudimos cobrar tu plan. Actualiza tu tarjeta antes del **{fecha_gracia}** para no perder Pro." [Actualizar tarjeta]
- Paid renewals: the amber `banner.renew` "Tu plan {plan} se renueva el **{fecha_cobro}** por **${monto} MXN**." [Ver mi plan] shows 7 days before **every** renewal.
- `trial_last7`, `banner.renew` and `past_due` can't be closed; the others close per session. Acceptance: the banner and the 7-day email go out the same day with the same content.

#### SCR-18 · Cancelar — sheet from Mi plan — mockup `18-cancelar` (BUILD-SPEC §6.9)
- Trial: `cancel.trial.title` "¿Cancelar tu prueba?" · `cancel.trial.body` "Seguirás teniendo Pro hasta el **{fecha_fin_prueba}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados." · optional offer (annual only) `cancel.offer` "¿Prefieres pagar mes a mes?" [Cambiar a $749 al mes] · `cancel.yes` "Sí, cancelar" (`btn-dark`) · `cancel.keep` "Seguir con Pro" (`btn-primary`, same size).
- Paid: `cancel.paid.title` "¿Cancelar tu plan {plan}?" · `cancel.paid.body` "Seguirás teniendo {plan} hasta el **{fecha_fin_periodo}**. No habrá más cobros. Después pasarás al plan Gratis y tus resultados se quedan guardados."
- Done: `cancel.done.title` "Listo, cancelaste." · `cancel.done.body` "No se te volverá a cobrar. Tienes Pro hasta el **{fecha_fin}**." · "Si cambias de opinión, puedes volver a activar Pro en cualquier momento." · [Volver a Inicio] [Volver a activar Pro] · `cancel.done.folio` "Folio: {folio_cancelacion} · Te enviamos la confirmación a {correo}".

#### SCR-30 · Mi plan — `/app/billing` (existing route; alias `/app/cuenta/plan`, BUILD-SPEC §0.1 reuse rule) — mockups `30-mi-plan` and `18` (BUILD-SPEC §6.10)
**This replaces the placeholder Mi plan wording of the old trial prompt.** Fixed structure for all states: gradient "Tu plan" card · "Próximo cobro" group (date + amount + notice, payment method, credits) · "Cambiar de plan" group · "Facturas" group · "Cancelar" row.
- Common keys: `myplan.title` "Mi plan" · `myplan.crumb` "Mi cuenta ›" · `myplan.next` "Próximo cobro" · `myplan.method` "Método de pago" · `myplan.method.sub` "Vence {mm/aa}" · `myplan.method.change` "Cambiar tarjeta" · `myplan.credits` "Créditos de este mes" · `myplan.credits.sub` "Usaste {usados} de {total}" · `myplan.credits.renew` "Se renuevan el día {dia} de cada mes" (use the real reset day; the code resets tokens on the 1st; credit numbers stay hidden while D8 is unset) · `myplan.change` "Cambiar de plan" · `myplan.invoices` "Facturas" · `myplan.invoice.row` "{fecha} · {plan} · ${monto} · CFDI" (the "CFDI" suffix and `myplan.invoice.data` "Datos de facturación (RFC)" render only once CFDI issuance exists; Q11) · `myplan.invoice.empty` "Ninguna aún" · `myplan.cancel` "Cancelar suscripción" · `myplan.cancel.sub` "1 clic, sin llamadas. Sigues con {plan} hasta el {fecha_fin_periodo}."
- The page carries `price.tax` "Precios en MXN, IVA incluido." under the plan card (Hard Rule 7); BUILD-SPEC's amount strings stay exactly as written.

| State | "Tu plan" card | Próximo cobro | Cambiar de plan | Cancelar |
|---|---|---|---|---|
| **Pro mensual** | "TU PLAN · ACTIVO" · "Pro mensual — todo incluido" · "Se renueva cada mes." / "Próximo cobro: {fecha_cobro}" · "$749 MXN al mes" · [Cambiar plan] | "{fecha_cobro}" · "$749 MXN" · "Aviso por correo 7 días antes" | "Pasar a Pro anual" · "$7,490 al año" · "Ahorras $1,498 al año. Empieza en tu próxima fecha de cobro" · "Subir a VIP" · "$2,499 al mes" · "Se aplica hoy; te mostramos el ajuste antes" · "Pasar a Gratis" · "$0" · "Al terminar tu mes pagado" | "Cancelar suscripción" |
| **Pro anual** (mockup 30) | "Pro anual — todo incluido" · "Se renueva cada año." / "Próximo cobro: {fecha_cobro}" · "$7,490 MXN al año" | "{fecha_cobro}" · "$7,490 MXN" · "Aviso por correo 30 y 7 días antes" | "Pasar a Pro mensual" · "$749 al mes" · "Empieza cuando termine tu año pagado" · "Subir a VIP" · "Pasar a Gratis" · "Al terminar tu año pagado" | "Cancelar suscripción" |
| **VIP** | "VIP — todo incluido y más créditos" · "Se renueva cada mes." · "$2,499 MXN al mes" | "{fecha_cobro}" · "$2,499 MXN" · "Aviso por correo 7 días antes" | "Bajar a Pro mensual" · "$749 al mes" · "Empieza en tu próxima fecha de cobro" · "Bajar a Pro anual" · "$7,490 al año" · "Pasar a Gratis" | "Cancelar suscripción" |
| **Prueba activa** | "TU PLAN · PRUEBA" · "Prueba Pro gratis" · "Te quedan {n} días · termina el {fecha_fin_prueba}" · "Después de la prueba: {plan} · ${monto} MXN {al año\|al mes}" [Cambiar] | "{fecha_cobro}" · "${monto} MXN" · "Aviso por correo el {fecha_recordatorio}" | "Cambiar a Pro mensual/anual (antes del primer cobro)" | "Cancelar prueba" · "1 clic, sin llamadas" |
| **Cancelado, activo hasta** | "TU PLAN · CANCELADO" · "{plan} hasta el {fecha_fin_periodo}" · "No habrá más cobros." · [Volver a activar {plan}] | hidden; instead "Después del {fecha_fin_periodo} pasarás al plan Gratis. Tus resultados se quedan guardados." | hidden | hidden |
| **Pago pendiente** | red "TU PLAN · PAGO PENDIENTE" · "No pudimos cobrar ${monto} MXN" · "Actualiza tu tarjeta antes del {fecha_gracia} para no perder {plan}." · [Actualizar tarjeta] | "Intentaremos de nuevo el {fecha_reintento}" · payment method highlighted | visible | "Cancelar suscripción" (never blocked by a debt) |

Acceptance: all 6 states have fixtures and screenshots; grandma finds "cuándo me cobran y cuánto" in < 5 s.

#### SCR-E · Emails and charge notices (BUILD-SPEC §6.11; exact bodies in §9-D `trial-to-paid-path.md` §2 and aceptacion-ux §4)
| # | Email | When | Subject |
|---|---|---|---|
| 1 | Bienvenida | at trial start | "Tu mes de Pro gratis ya empezó 🎉" (includes the accepted versions + folio) |
| 2 | Recordatorio de prueba | **7 days before** the charge (day 23) | "Tu prueba gratis termina en 7 días" |
| 3 | Cobro realizado | day 30 | "Bienvenido a Chalyb Pro" (body with "(IVA incluido)", auto-renew and cancel link, §9-D) |
| 3b | Cobro fallido | on failure | "No pudimos cobrar tu plan Pro" |
| 4 | Renovación mensual | **7 days before every** monthly charge | "Tu plan {plan} se renueva el {fecha_cobro}" |
| 5 | Renovación anual | **30 and 7 days before** | "Tu plan Pro anual se renueva el {fecha_cobro}" |
| 6 | Resumen anual (monthly plans) | once a year | "Tu resumen anual de Chalyb" (product, frequency, amount, how to cancel) |
| 7 | Cancelación | on cancel | "Cancelaste tu plan · Folio {folio}" |
In-app (mockup 26): `notif.trial7.title` "Tu prueba termina en 7 días" · `notif.trial7.body` "El {fecha_cobro} se cobrarán ${monto} MXN. Puedes cancelar en 1 clic." Every marketing email has a 1-click unsubscribe; transactional emails carry no marketing.

### Tests (mock MP and Resend; all deploy-blocking)
- **Trial start:** an authorized webhook sets `trialing` with the right dates; Email 1 is sent once with versions + folio; the notice is scheduled once for day 23; launch works.
- **One trial:** a second trial is refused after cancel, re-subscribe or row delete; a reused card hash is refused (if available); the human-review path exists.
- **Consent:** the checkbox renders unchecked; the button is disabled; a POST without consent → 422; the event has the exact rendered text + hash + versions; UPDATE/DELETE on `consent_events` fails; the hash chain verifies.
- **Notices:** day 23 trial; every monthly charge −7; annual −30 and −7; idempotent; CT boundaries; **bounce → hold (no charge) → effective notice via the alternate channel → charge after +5 days**; a delivered notice means no hold.
- **Cancel:** 2 clicks; MP cancel called; no future charge; email with folio; "Sí, cancelar" visible next to the offer at both viewports; access until period end, then `free` + neutral banner.
- **Conversion / failure:** approved → `pro` + one movement + Email 3, with no double write on replay; rejected → `past_due` + Email 3b + red banner; after grace → `free` and launch refused.
- **Plan changes:** VIP prorate + consent (422 without); downgrade at period end, undoable; trial switch; never two charging preapprovals.
- **Price rules:** P2-10 scans; derivation from `PRICING`; changing a price in `PRICING` changes screens, emails and legal text renders (snapshot).
- **Quebec:** block flag.
- **E2E (`E2E_ALLOW_MUTATIONS=1`, MP sandbox):** Landing CTA → SCR-13 (Google or email) → SCR-14 (Anual preselected) → SCR-15 (test card + checkbox) → SCR-16 → "Hacer mis primeros clips" opens Clips paso 1; in Mi plan switch to Mensual and back; cancel → done with folio.

### DONE WHEN (includes BUILD-SPEC §6.12)
- [ ] §7.1 gates green; every P2 done-when line and test passes.
- [ ] No "2 meses gratis", no "$624/mes" as the main price, no "$8,988" outside "vs. … pagando mes a mes" (bundle + email scan).
- [ ] The recurring-charge checkbox is required and unchecked by default, and the server rejects requests without it.
- [ ] The billing block states amount **and** period **and** date on SCR-14, 15, 16 and in Email 1.
- [ ] Notices go out 7 days before the trial charge and before every monthly and annual charge (+30 days for annual). **A charge is blocked without a delivered notice.**
- [ ] Cancel works in 2 clicks with "Sí, cancelar" visible next to the offer.
- [ ] Amounts come only from `PRICING`.
- [ ] Grandma test: landing → "¡Listo!" in ≤ 6 taps (Google). Pro test: switch to Mensual, then cancel, in ≤ 4 taps from Inicio.
- [ ] The PR lists: the migration; the MP approach (free_trial vs start_date) and why; how plan changes are done; the webhook topics; the config keys; the notice-hold mechanism used with MP; how `{n_clips}` is counted (or dropped); whether a card hash was possible; screenshots of SCR-12…18 and 30 (all states) and the 4 banners.
- [ ] `TRIAL_FLOW_ENABLED` defaults to false; enabling it is OPS-10.

---

## P3 · Fase 3: Herramientas (asistentes de 3 pasos) y resultados (BUILD-SPEC §7, §11.4–§11.6)
**Branch:** `claude/rebuild-p3-tools` · **Depends on:** P1 (shell, components), P2 (entitlements, consent log) · **Closes:** — (new UX); hardens the B01–B04 paths · **Mockups:** 02–06, 19–26
**Goal:** a non-technical user does the main job of each tool in ≤ 3 steps inside Chalyb: big buttons, plain Spanish, **one** primary button per step. Every result shows up in **Mis resultados**. Every tool uses `WizardShell` and `getEntitlements`.

**Tool visibility (BUILD-SPEC §0.3).** A tool appears only when its engine is active (`engines.status='active'`, or the P5 Herramientas switch). Hidden tools don't appear in Inicio, Más herramientas, Mis resultados chips, landing grids, tool counts or notifications, and their URLs redirect to Más herramientas. This phase builds the hub flow for all 7 tools against adapters, so a tool turns on by flipping its status once its engine is ready. No "Llega pronto", "próximamente" or "beta" anywhere (P0 content test).

**Engine adapters (read first).** The hub has **no** job API for any engine; `integrations/factory.ts` only offers tenant provisioning, status and SSO. Every wizard is built against `src/lib/tools/adapters/{types,clips,senales,envivo,asistente,pronosticos,inmuebles,inversiones,mock}.ts`. P0 already created the Clips adapter and job states. Mode per tool, set by config `TOOL_HUB_MODE_<SLUG>`:
- **`a`**: the engine exposes a job/settings API. The hub renders the whole flow.
- **`b`**: the hub collects the inputs and hands off through SSO with them in `next` (the engine must accept those params).
- **`off`**: the tool card launches through P0's "Abrir" path, and the wizard routes redirect there.

The defaults are Clips = P0's mode, everything else `off` (Q4). The mock adapter powers dev and e2e only (`NODE_ENV!=='production'` or `E2E_USE_MOCK_ADAPTERS=1`). Implement Mode A only against an API documented in `docs/engines/*.md`. Otherwise leave a typed stub that throws `NOT_IMPLEMENTED` (OPS-13). **The guardrail tests below run against the adapter contract and the hub endpoints, so they hold in every mode.**

**Routes** (BUILD-SPEC paths; existing routes reused where they do the same job, §0.1):
- `/app/clips` → `/app/clips/formato` → `/app/clips/[job]`
- `/app/senales` (+ `/app/senales/avisos`, `/app/senales/listo`)
- `/app/en-vivo`
- `/app/herramientas` (old `/app/engines` → 308 here; `/app/engines/[slug]` keeps working and redirects to the tool route)
- `/app/herramientas/{asistente,pronosticos,inmuebles,inversiones}`
- `/app/history` = **Mis resultados** (alias `/app/resultados`)
- `/app/help` = **Ayuda** (alias `/app/ayuda`)
- `/app/avisos`

**Files:** the routes above; `src/components/app/{wizard/*,result-card,tool-card,risk-modal,connect-sheet,likeness-consent,empty-state,error-state,setup-state}.tsx`; `src/lib/tools/**`; `src/lib/guardrails/{signals,invest,forecasts,likeness}.ts`; `messages/{es,en}.json`; migration `00NN_tools_notifications.sql` (notifications, exchange connections, automation rules, signal prefs) only for tables that don't already exist.

### Fixes
**P3-1 · Wizard framework.**
- *Fix:* `WizardShell` (P1) with the state in the URL (search params), so back and refresh work. Focus moves to the h1 on each step. "Atrás" goes to the previous step. X goes to Inicio, confirming only if there's unsaved input.
- *Done when:* a keyboard-only e2e completes the Clips mock flow, and refresh on step 2 keeps the inputs.

**P3-2 · Clips wizard, full design (SCR-02…06).**
- *Fix:* restyle P0's functional flow to the mockups.
  - Entitlement is checked on each step's server action.
  - Count options are 3 · **6** · 10 with 6 preselected, and the hint says "Te recomendamos 6 para empezar." (D9; mockups 03/06 as regenerated 21:34 say 6).
  - "No se usaron créditos." shows only when the adapter confirms no charge (P0 rule: credits are deducted only on success).
  - No credits → "Te quedaste sin créditos este mes. Se renuevan el {fecha}." [Ver mi plan].
  - `first_clip` fires on the first completed job.
- *Done when:* the mock e2e goes paste → format → creating → listos → "Descargar" returns a download URL. An invalid link shows SCR-24 error. Pro reaches "Subir varios videos a la vez" in ≤ 2 taps from step 2 (BUILD-SPEC §4.3).

**P3-3 · Autopublish and connect-account consent (aceptacion-ux §7).**
- *Fix:*
  - "Publicar automáticamente en mis redes" is **OFF by default**. Turning it on requires a connected account and the §7 checkbox: "Entiendo que Chalyb publicará clips en **{cuenta}** según las reglas que configuré y que **soy responsable** de lo que se publique." [Activar publicación automática]. Log `autopublish_enabled`.
  - Every "Conectar {plataforma}" opens the §7 connect sheet before OAuth.
  - Show connect buttons only when the adapter reports `supportsConnect`; never show a button with no action.
  - Tier: `TIER_CAPS.clipAutoPublish` is VIP-only today while Planes sells "Opciones avanzadas para profesionales" in Pro. The cap decides, and a locked row shows "Incluido en VIP" (Q15).
- *Done when:* a unit test confirms the switch defaults off, it can't be enabled without the checkbox, and the consent row is written.

**P3-4 · Risk modal (aceptacion-ux §6) for Señales, Pronósticos and Inversiones.**
- *Fix:*
  - On first activation per tool and per legal version, show a blocking modal with the §6 text **verbatim** (§9-C), `{Herramienta}` substituted, an unchecked checkbox "Entiendo y acepto que las decisiones y los riesgos son míos." and "Entendido, continuar" disabled until it's checked.
  - Log `risk_ack_accepted` with the tool and the doc version, and show the modal again when the version changes.
  - Applies to hub flows **and** before SSO launch of those tools.
- *Done when:* the e2e shows the modal on first visit, it can't be bypassed via URL or a direct API call (server check), and it doesn't show on the second visit.

**P3-5 · Señales (SCR-20, SCR-21) with hard guardrails (BUILD-SPEC §7.2, §11.4; REVISION-LEGAL C1).**
- *Fix:*
  - Flow: risk modal → step 1 coins → step 2 channels → listo.
  - **Signals are identical for every user of a plan.** The signal content API is `getSignals({ plan, coins? })`. It **takes no `userId`** for content; the user id is used only to filter delivery (chosen coins, channels).
  - The coin choice only filters which notices arrive; it never changes a signal's content.
  - **Never ask for, store or use** balances, positions, goals or risk profile. Remove any "nivel de riesgo" / "perfil de inversionista" field (advanced options = "Temporalidad y horario de avisos" only).
  - **No** "Copiar automáticamente", "seguir señales", auto-trading tied to Señales, model portfolios, or templates that fire orders from a signal.
  - The hub never authors signal text; it renders the engine's state as `signal.buy` / `signal.sell` / `signal.wait` plus the engine's general explanation.
  - Fixed disclaimer strip on SCR-21, on every signal notification and in signal emails.
  - Disclose any affiliation with exchanges or brokers wherever the exchange is named (config `AFFILIATIONS`; empty means nothing shown).
  - Channels shown are only those the adapter supports.
- *Done when:*
  - a **contract test** proves the content function's signature has no user parameter, and two users on the same plan get byte-identical signal payloads;
  - a schema test confirms no table or column named like `risk_profile|balance|position|portfolio|investor_profile` is read by Señales;
  - a content test on `messages/*` + bundle finds no "copiar automáticamente", "seguir señales", "te conviene", "tu cartera", "si ya ganaste", "garantizado" or suggested amounts in signal keys;
  - the disclaimer is always visible (e2e).

**P3-6 · En vivo (SCR-22).**
- *Fix:* build against `EnVivoAdapter` (OBS control).
  - Live state: the button turns red, `live.stop` "Terminar transmisión" + a counter. Ending asks "¿Terminar tu transmisión?" [Sí, terminar] [Seguir].
  - OBS not connected → `SetupState` "Te falta conectar OBS" [Conectar ahora] (3-step guide). Slow internet → amber pill.
  - With the adapter off, P0's "Abrir" launch.
  - No AI voice/face exists here; if one is added, P3-10 applies.
- *Done when:* the mock e2e starts, switches scene, toggles mic/cam, and ends with the confirm. With the adapter off, "Abrir" works.

**P3-7 · Más herramientas (SCR-23).**
- *Fix:* cards come from `getEntitlements().tools`, and only active tools render:
  - `included` → green pill "Incluido en tu plan" + [Abrir];
  - `trial_offer` (Gratis) → accent pill "Incluido en Pro" + secondary "Pruébalo gratis" (→ SCR-14; "Volver a Pro" if the trial was used), plus the bottom strip;
  - `setup_needed` → amber pill "Te falta un paso" + [Conectar ahora] straight to the missing step.
  - **Never** a lock or "Disponible".
- *Done when:* the e2e for Free and Pro matches the matrix, and the 3 states have fixtures.

**P3-8 · Asistente (BUILD-SPEC §7.4).**
- *Fix:* 3 steps: "¿Dónde contesta?" (WhatsApp / Instagram / web) · "¿Qué debe saber?" (paste text or a link) · "Pruébalo". The bot always introduces itself as an automatic assistant ("Soy el asistente de {negocio}") and never as a real person. No voice or persona cloning; any voice/avatar option goes behind P3-10.
- *Done when:* a unit test confirms the system prompt / first message always contains the automatic-assistant self-identification; the mock e2e finishes the 3 steps.

**P3-9 · Pronósticos: forecasts only (BUILD-SPEC §7.4, §11.5; REVISION-LEGAL A4).**
- *Fix:*
  - Read-only explained forecasts (match, forecast, why, confidence), the risk modal (P3-4) with `{Herramienta}`="Pronósticos", and the fixed footer "Esto es informativo. No es asesoría de apuestas."
  - **Forbidden in UI and tool marketing:** bets, amounts, betting odds, quinielas, contests, prizes, raffles, sorteos, user leaderboards, "comparte y gana", links to betting sites.
  - No responsible-gambling link until D11 is resolved.
- *Done when:* a content test on Pronósticos keys, landing keys and the bundle finds none of `apuesta|apostar|momio|quiniela|concurso|premio|sorteo|rifa|comparte y gana`, and a link check finds no outbound betting domains (config denylist + "no external links in Pronósticos" rule).

**P3-10 · AI voice/likeness consent gate (BUILD-SPEC §11.6; REVISION-LEGAL A6).**
- *Fix:*
  - **Nothing that clones or imitates a real person's voice or face is built in this phase.** Ship the gate for later use:
    - `LikenessConsent` component with `ai.likeness.title` "Antes de usar una voz o imagen con IA" · `ai.likeness.body` (BUILD-SPEC §11.6 verbatim) · `ai.likeness.check` "Confirmo que es mi voz o imagen, o que tengo el acuerdo por escrito de la persona, y acepto la [Política de Uso Aceptable]." (unchecked, required) · `ai.likeness.cta` "Continuar" · optional signed-agreement upload;
    - the server guard `requireLikenessConsent(userId, feature)`;
    - the `voice_likeness_consent` event in `consent_events`.
  - Adapter capabilities carry `usesLikeness: boolean`, and any option with `usesLikeness=true` must be wrapped by the gate.
- *Done when:*
  - a unit test confirms the guard throws without a stored consent;
  - a static test fails if any adapter option has `usesLikeness: true` and isn't routed through the guard;
  - the e2e (mock option) can't continue without the checkbox, and the event is written.

**P3-11 · Inversiones: user-written rules only, no withdrawal keys (BUILD-SPEC §7.4, §11.4; REVISION-LEGAL C1).**
- *Fix:* 3 steps:
  1. **Conectar exchange:** the aceptacion-ux §7 text + `invest.noWithdraw` "**Nunca podemos retirar tu dinero.** Usa claves solo de lectura, o de lectura y operación si vas a usar reglas. Rechazamos claves con permiso de retiro." + the `financial_data_consent` checkbox. The **server queries the key's permissions from the exchange API and rejects it if withdrawals are allowed** ("Esta clave permite retiros. Por tu seguridad no la aceptamos. Crea una nueva sin ese permiso."). Keys are encrypted at rest, never logged, never sent to the client. No custody of funds.
  2. **Escribe tu regla:** asset, condition, maximum amount, schedule, in plain language and **written by the user**. No prefilled values from signals or balances.
  3. **Revisa y activa:** the §7 text "Esta automatización enviará órdenes… **solo según la regla que tú definiste**: {resumen_regla}. Chalyb no elige activos, montos ni momentos por ti." + the checkbox "Revisé la regla y acepto que las órdenes y sus riesgos son míos." [Activar] → `automation_rule_activated`. [Pausar] is always visible.
  - **Forbidden:** "copiar señal", "seguir a Chalyb", model portfolios, rule templates triggered by Señales, suggestions based on balances.
  - Tagline: "Tu exchange sigue las reglas que tú escribes. Nunca podemos retirar tu dinero." (replaces the old "recibe ideas claras para cuidar tu dinero").
- *Done when:*
  - a unit test with a mock exchange shows a key with `withdraw=true` → rejected (and not stored), while read-only and read+trade keys are accepted;
  - a rule can't be activated without the checkbox, and a rule's trigger can only be a user-defined condition (a schema test rejects `source: 'signal'`);
  - Pausar works;
  - the content test finds no forbidden strings.

**P3-12 · Inmuebles (BUILD-SPEC §7.4).**
- *Fix:* property cards (the user's photos, generated text, share). Chalyb never takes part in payments (REVISION-LEGAL M13 therefore doesn't apply; Q for the attorney stays in OPS-10).
- *Done when:* the mock e2e creates and shares a card.

**P3-13 · Mis resultados (SCR-19).**
- *Fix:* results come from real sources only: what `/app/history` reads today, plus adapter job lists. Chips show only active tools that have results. Search by title. In-progress items show a ring "Creando… {pct}%". No result type renders without a data source.
- *Done when:* a unit test covers the mapping; the e2e covers empty, non-empty, no-match and in-progress.

**P3-14 · Empty, error and setup states (SCR-24).**
- *Fix:* `EmptyState` / `ErrorState` / `SetupState` with exactly 1 primary button and never a dead button. Every tool uses them, and P0's reasons (`link_private`, `link_unsupported`, `video_too_long`, `no_credits`, `platform_down`, `unknown`) map to the §7.6 keys.
- *Done when:* each state renders in at least one real flow, and the "no empty onClick / href=#" test passes.

**P3-15 · Ayuda (SCR-25).**
- *Fix:*
  - WhatsApp only if `SUPPORT_WHATSAPP_URL` is set. "Chat aquí" only if a chat exists (none on main, so hidden).
  - The response promise follows D6: `help.human.sub.alt` "Te respondemos lo antes posible, en español." until `SUPPORT_SLA_CONFIRMED=true` allows "Te respondemos en minutos. Sin robots, sin esperas largas."
  - FAQ answers come from the copy module. Reuse the Planes/landing answers where the question matches; otherwise give a short answer that points at the screen that does it ("¿Cómo hago mis primeros clips?" → "Toca Clips en Inicio, pega el enlace de tu video y elige dónde los vas a publicar. Listo." [Hacer clips]). The owner may edit these.
  - "Tengo un problema con un cobro" → contact form, category `cobro`.
  - "Videos para aprender" is hidden until real videos exist.
- *Done when:* the e2e shows no conditional item rendering without its config.

**P3-16 · Avisos (SCR-26).**
- *Fix:*
  - Reuse `/app/messages` storage if it's per-user; otherwise add a `notifications` table (RLS own rows).
  - Producers: clips ready, trial and renewal notices (P2), signal, stream ended, Asistente.
  - Bell with unread count in the shell (top right on mobile); "Marcar como leídos".
  - Desktop renders the same grouped list as a page inside the shell.
  - Tapping a notice opens the exact result.
  - **Billing notices can't be deleted before their charge date.**
- *Done when:* a unit test covers the producer for trial7; the e2e covers mark-all-read and confirms a billing notice can't be deleted early.

### Screens (BUILD-SPEC §7 keys; quoted text is verbatim)
#### SCR-02 · Clips · Paso 1 — `/app/clips` — mockup `02-clips-paso1`
`clips.s1.title` "Pega el enlace de tu stream o video" · `clips.s1.sub` "Copia la dirección de tu video y pégala aquí. Nosotros hacemos el resto." · placeholder "https://youtube.com/..." · `clips.s1.paste` "Pegar" (Clipboard API; hidden if unsupported) · `clips.s1.works` "Funciona con YouTube, Twitch, Kick y Facebook." (the list must match the adapter's supported sources) · `clips.s1.or` "o también puedes" · "Conectar YouTube" · "Conectar Twitch" · "Subir un video" (each only if supported) · `clips.s1.cta` "Continuar" · `clips.s1.private` "Tu video es privado. Solo tú puedes verlo." (only if the engine guarantees it; Q4).

#### SCR-03 · Clips · Paso 2 — `/app/clips/formato` — mockup `03-clips-paso2`
`clips.s2.title` "¿Dónde los vas a publicar?" · `clips.s2.sub` "Elige la forma de tus clips. Puedes cambiarla después." · cards "TikTok / Reels / Shorts · Vertical" (pill "Recomendado", preselected), "YouTube · Horizontal", "Instagram · Cuadrado" · `clips.s2.count` "¿Cuántos clips?" · `clips.s2.count.hint` "Te recomendamos 6 para empezar." · options 3 · **6** · 10 · collapsed "Opciones avanzadas · Para creadores profesionales" · `clips.s2.cta` "Crear mis clips".

#### SCR-04 · Creando — `/app/clips/[job]` — mockup `04-clips-creando`
Ring with the real % (indeterminate if the adapter reports none) + 4 steps from P0's job states: "Video recibido" · "Buscando los mejores momentos" ("Encontramos {n}") · "Agregando subtítulos…" · "Listo para descargar" · `clips.wait.title` "Estamos creando tus clips" · `clips.wait.sub` "Tarda unos minutos. Puedes cerrar esta página, te avisamos cuando estén listos." · `clips.wait.email` "Avísame por correo" (→ "Te avisaremos a {correo}"). Poll ≤ 5 s with backoff.

#### SCR-05 · Listos — mockup `05-clips-listos`
`clips.done.title` "Tus clips están listos 🎉" · `clips.done.sub` "Hicimos {n} clips de “{titulo}”. Ya tienen subtítulos." · "Hacer más clips" · "Descargar todos" (only if the adapter offers a zip) · per clip "Descargar" · "Compartir" (Web Share API, copy-link fallback) · `clips.done.saved` "Tus clips se guardan en [Mis resultados]. Puedes volver por ellos cuando quieras." (Gratis: add "durante {n} días" from `TIER_CAPS` retention).

#### SCR-06 · Opciones avanzadas — mockup `06-avanzado`
Closed by default, "Para creadores profesionales". Each row shows only if the adapter supports it: "Subir varios videos a la vez" · "Subtítulos: estilo y idioma" · "Formato y duración personalizada" ("De 15 a 60 segundos") · "Publicar automáticamente en mis redes" (**OFF**, P3-3) · "Marca de agua / logo" · "Acceso API" (hidden until it exists; Q17) · footer `clips.adv.default` "Si no tocas nada, usamos la mejor configuración por ti." No AI voice/face rows (P3-10).

#### SCR-19 · Mis resultados — `/app/history` (alias `/app/resultados`) — mockup `19-mis-resultados`
`results.title` "Mis resultados" · `results.sub` "Todo lo que tus herramientas hicieron por ti." · `results.search` "Buscar en mis resultados" · chips "Todos" · "Clips" · "Señales" · "En vivo" · "Asistente" · "Pronósticos" · "Inmuebles" · "Inversiones" (active tools with results only) · section "Listos" · large cards in 3 columns (thumbnail, tool, title, relative date + detail, 1–2 buttons: "Ver clips"/"Descargar", "Ver señal", "Ver grabación"/"Hacer clips", "Ver mensajes", "Abrir"/"Compartir"). States: empty → `empty.clips` · loading → skeletons · no match → "No encontramos “{busqueda}”. Prueba con otra palabra." [Ver todos] · in progress → "Creando… {pct}%".

#### SCR-20 · Señales · Paso 1 and 2 — `/app/senales` — mockup `20-senales-paso1`
`signals.s1.title` "¿Qué monedas te interesan?" · `signals.s1.sub` "Elige una o varias. Puedes cambiarlas después." · big chips Bitcoin BTC, Ethereum ETH, Solana SOL, XRP, Dogecoin DOGE, Cardano ADA, BNB, Litecoin LTC (list from the adapter/config) · "Buscar otra moneda" · `signals.s1.count` "Elegiste **{n} monedas**: {lista}." · `signals.s1.same` "Las señales son iguales para todos los usuarios de tu plan." · advanced "Temporalidad y horario de avisos" · "Continuar". Step 2: `signals.s2.title` "¿Cómo te avisamos?" · cards "WhatsApp" · "Correo" · "En la app" (multi-select; supported channels only) · "Continuar".

#### SCR-21 · Señales · Listo — mockup `21-senales-listo`
`signals.done.title` "Tus señales ya están activas" · `signals.done.sub` "Te avisamos por {canal} cuando haya algo importante. Esto es lo más reciente." · fixed strip `signals.disclaimer` "**Esto es informativo, no es asesoría financiera.** Las señales son iguales para todos y no usan tus saldos ni tus inversiones. Tú decides." + [Leer aviso completo](/uso-aceptable#avisos) · cards: coin, time (CT), state `signal.buy` "Buen momento para comprar" (accent) · `signal.sell` "Buen momento para vender" (amber) · `signal.wait` "Mejor espera" (grey), general explanation, "Confianza alta|media" / "Sin prisa" (D10: kept, the same for everyone) · "Ver por qué" · side "Así te avisamos" (switches), "Tus monedas", "Opciones avanzadas". Tag "Ejemplo" until the first real signal arrives.

#### SCR-22 · En vivo — `/app/en-vivo` — mockup `22-en-vivo`
`live.title` "Tu transmisión" · `live.sub` "Todo listo. Cuando quieras, toca el botón grande." · `live.obs.ok` "OBS conectado" · "Tu transmisión saldrá en {plataformas}" · "Cambiar" · `live.start` "Iniciar transmisión" (100 px button) · `live.start.sub` "Empieza en 3 segundos. Puedes detenerla cuando quieras." · `live.scenes` "Escenas" · "Toca una para cambiar lo que ve tu público" (scene cards from OBS, "En pantalla") · `live.quick` "Controles rápidos": Micrófono · Cámara · "Hacer clips al terminar" · `live.check` "Antes de empezar": Internet "Bueno|Lento|Sin conexión", Título [Editar] · advanced "Calidad, servidores y atajos". While live: `live.stop` "Terminar transmisión" (red) + counter; confirm "¿Terminar tu transmisión?" [Sí, terminar] [Seguir].

#### SCR-23 · Más herramientas — `/app/herramientas` — mockup `23-mas-herramientas`
Grid of the active extra tools: **Asistente** "Un bot que contesta a tus clientes y seguidores, de día y de noche." · **Pronósticos** "Los pronósticos deportivos del día, explicados en simple." · **Inmuebles** "Publica tus propiedades y atiende a interesados sin perder tiempo." · **Inversiones** "Tu exchange sigue las reglas que tú escribes. Nunca podemos retirar tu dinero." States per P3-7: `tools.included` "Incluido en tu plan" [Abrir] · `tools.inPro` "Incluido en Pro" + `tools.try` "Pruébalo gratis" + strip "Prueba Pro gratis 1 mes · Todas las herramientas incluidas. Cancela cuando quieras." · "Te falta un paso" [Conectar ahora]. If every extra tool is hidden, Inicio's "Y mucho más" card is hidden too.

#### SCR-24 · Vacío, error, falta un paso — mockup `24-vacio-y-error` (BUILD-SPEC §7.6)
- Empty: `empty.clips.title` "Aún no tienes clips" · `empty.clips.body` "Haz el primero en 1 minuto. Solo pega el enlace de tu stream." · `empty.clips.cta` "Hacer mi primer clip".
- Error: `error.link.title` "No pudimos leer ese enlace" · `error.link.body` "Revisa que el video sea público y vuelve a pegarlo." · [Intentar otra vez] (primary) · [Hablar con una persona] (green) · `error.noCharge` "No se usaron créditos."
- Other reasons: `error.unsupported` "Ese enlace no es de una plataforma que podamos leer. Funciona con YouTube, Twitch, Kick y Facebook." · `error.tooLong` "Ese video dura más de {max} horas. Sube una parte o pásate a VIP." (`{max}` from `PRICING.maxVideoHours`; hidden reason text if unset) · `error.platform` "{plataforma} no responde ahora. Lo intentamos solos en unos minutos y te avisamos." · `error.unknown` "Algo salió mal de nuestro lado. Ya lo estamos revisando."
- Setup: `setup.youtube.title` "Te falta conectar YouTube" · `setup.youtube.body` "Así podemos traer tus streams y hacer tus clips solos. Toma 30 segundos." · `setup.cta` "Conectar ahora" · `setup.alt` "O pega un enlace, sin conectar nada." (same structure for OBS, Twitch, WhatsApp, exchange: `setup.{obs,twitch,whatsapp,exchange}.{title,body}`).

#### SCR-25 · Ayuda — `/app/help` (alias `/app/ayuda`) — mockup `25-ayuda`
`help.title` "Ayuda" · `help.sub` "Aquí estamos para ayudarte, en español." · green card `help.human.title` "Hablar con una persona" · sub per P3-15 · [WhatsApp] [Chat aquí] (conditional) · `help.faq` "Preguntas comunes": "¿Cómo hago mis primeros clips?" · "¿Cómo conecto YouTube o Twitch?" · "¿Qué son los créditos?" · "¿Cómo cambio o cancelo mi plan?" · "Tengo un problema con un cobro" · `help.videos` "Videos para aprender" ("Video · {n} min"; hidden until real).

#### SCR-26 · Avisos — `/app/avisos` — mockup `26-notificaciones`
Grouped "Hoy" / "Esta semana", "Marcar como leídos". Types: `notif.clipsReady` "Tus clips están listos" · "Hicimos {n} clips de “{titulo}”. Ya tienen subtítulos." · `notif.trial7` (P2) · `notif.signal` "{moneda}: {estado}" · "Informativo, no es asesoría financiera." · `notif.liveEnded` "Tu transmisión terminó" · "Duró {duracion}. ¿Hacemos clips?" · `notif.assistant` "Tu Asistente respondió {n} mensajes" · "Tus clientes ya tienen respuesta." · `notif.renew` "Tu plan se renueva en 7 días" · `notif.pastDue` "No pudimos cobrar tu plan".

### Tests (guardrail tests are deploy-blocking)
- **Unit:** the adapter contract vs mock; risk-ack gating (client + server); autopublish default off; the P3-7 matrix; the results mapping; notification producers.
- **Guardrails:** signals uniform (no user parameter; identical payloads), no risk-profile/balance reads, the withdrawal-key rejection, user-written-rule-only schema, Pronósticos banned words and links, the likeness guard + static check, the Asistente self-identification, and forbidden strings across bundle and messages ("Disponible", "Requiere Pro", "copiar automáticamente", "apuesta").
- **E2E (mock adapters):** Clips, Señales + risk modal, En vivo start/stop, Más herramientas Free/Pro/setup, Inversiones connect (rejected key) → rule → activate → pause, Mis resultados, Ayuda, Avisos; axe and 360 px on every new route.

### DONE WHEN (includes BUILD-SPEC §7 acceptance)
- [ ] §7.1 gates green; P3-1…P3-16 done-when lines pass.
- [ ] Grandma test: link → clips in 3 taps. Pro test: advanced options in 1 tap from step 2, and Señales "temporalidad" and En vivo "Calidad, servidores y atajos" in 1 tap each.
- [ ] With every non-Clips `TOOL_HUB_MODE_*=off` (the prod default), nothing regresses: Inicio cards launch through P0.
- [ ] No mockup demo data renders in production code paths: a grep for "María", "Noche de preguntas", "Coyoacán" and "4821" in `src/` outside tests/fixtures finds nothing.
- [ ] The PR lists which adapters are real vs stubbed and what each engine team must provide (OPS-13).

---

## P4 · Fase 4: Sitio público (BUILD-SPEC §8)
> ⚠️ **SUPERSEDED 2026-10-03:** the landing/pricing copy and amounts in P4 ("Prueba Pro gratis 1 mes", $7,490 / $624 / $1,498) are replaced by `LANDING-SPEC.md` + PRICING-CARDS-SPEC (all-pending WS-4 / WS-10).
**Branch:** `claude/rebuild-p4-public` · **Depends on:** P1 (tokens), P2 (`PRICING`, Planes, trial CTA target) · **Closes:** B09 (permanent), B31 · **Mockups:** 10 (desktop, full page), 11 (mobile 390), 12 (Planes, built in P2)
**Goal:** an honest, simple public site in the new design: one plan story, prices from `PRICING` per the §6.2 rules, "IVA incluido", fully bilingual, Lighthouse ≥ 90 on mobile.

**Files:** `src/app/[locale]/page.tsx` (landing), `src/app/[locale]/planes/page.tsx` (from P2; add SEO here), `src/components/landing/**` (replace the sections; keep `brand-mark.tsx`), `src/components/public/{public-nav,public-footer,cookie-banner,idea-form}.tsx`, `src/lib/site.ts` (`PUBLIC_PATHS` + sitemap), `next.config.ts` (redirects), `messages/{es,en}.json` (`land.*`, `plans.*`).

### Fixes
**P4-1 · Landing (SCR-10, SCR-11).**
- *Fix:* replace the current landing, section by section, per the subsections. Remove the B31 claims: "Sin tarjeta de crédito" (only true for Gratis), "simulación", "ChalyClip gratis 7 días", "Ver demo", "1 engine en vivo", and prices without IVA. The CTA "Prueba Pro gratis 1 mes" goes to SCR-13 (`/sign-in?mode=signup&intent=trial`) when `TRIAL_FLOW_ENABLED`, otherwise to the existing sign-up. "Entrar" → `/sign-in`.
- *Done when:* the customer-copy and price-rule tests (P2-10) pass on `land.*`; the e2e checks the CTA target under both flag values; every price node has "IVA incluido" in the same block; the trial button is visible without scrolling at 390×844.

**P4-2 · Planes route and redirects.**
- *Fix:* `/planes` (built in P2) replaces P0's temporary redirect. `/pricing` and `/precios` → `/planes` (308). The landing anchor `#planes` stays (alias `#pricing`).
- *Done when:* the e2e gets `/planes` 200 and `/precios` 308 → `/planes`.

**P4-3 · `/engines`.**
- *Fix:* BUILD-SPEC defines no public catalog page, so turn P0's temporary redirect into a permanent one: `/engines` and `/en/engines` → `/#herramientas` (308).
- *Done when:* the e2e asserts that 308.

**P4-4 · Honest content (BUILD-SPEC §8.1 "sin nombres, logos ni cifras inventadas").**
- *Fix:*
  - The hero panel "Mientras dormías" and the clip gallery are illustrations: gradient frames, no photos of people, labeled "Ejemplo".
  - Hero result rows, tool cards, the final-CTA list and the count words ("las 7 herramientas") are **built from the active-tools list** (§4), so a hidden tool never appears as working (Q20).
  - The Señales row uses the neutral state wording ("Señal: Bitcoin · Buen momento para comprar" is the BUILD-SPEC state label for everyone; keep it with the "Ejemplo" tag).
- *Done when:* a unit test proves hero rows, cards and counts derive from the active tools; a content test finds no testimonials, user counts or logos.

**P4-5 · Claims that depend on owner decisions (config, never hardcoded).**
- *Fix:*
  - "Ayuda de una persona por WhatsApp" → only with `SUPPORT_WHATSAPP_URL` (Q16).
  - Credit numbers → `PRICING.credits` (D8/Q13).
  - "¿Me dan factura?" → answer per `CFDI_ENABLED` (Q11; hidden while false).
  - Partners section (D7/Q18): ship BUILD-SPEC's sub verbatim, "Propón una herramienta. Si la hacemos, compartimos las ganancias contigo.", with **no percentage or amount anywhere** until the program's terms exist (BUILD-SPEC D7 default). When `PARTNER_PROGRAM_TERMS_URL` is set, append a "Ver bases" link.
- *Done when:* each claim sits behind a named flag listed in the PR.

**P4-6 · "Proponer una idea" form.**
- *Fix:* a simple form (name, email, idea) with a clickwrap line linking the Aviso de Privacidad. It stores to a table (or the existing contact store with category `idea`) and surfaces in P5 "Necesita tu atención" → "Ideas nuevas". No marketing opt-in by default.
- *Done when:* the e2e submits, and the unit test sees the row with category `idea`.

**P4-7 · Cookie banner (aceptacion-ux §9; BUILD-SPEC §8.1).**
- *Fix:* exact text "Usamos cookies necesarias para que Chalyb funcione y, si aceptas, cookies de analítica y publicidad para mejorar y medir campañas." [Aceptar todas] [Solo necesarias] [Configurar]. **No non-essential cookie or analytics request before consent**: gate `<Analytics />` and `track()` (Q14). Store the choice. The footer has a "Cookies" link to reopen it.
- *Done when:* the e2e network assertion shows no analytics request before consent and one after "Aceptar todas"; "Solo necesarias" keeps it off.

**P4-8 · Technical.**
- *Fix:* SSR/static, `lang="es-MX"` (EN `lang="en"`), OG metadata per page, canonical + hreflang (P0 helper), `/planes` in `PUBLIC_PATHS` and the sitemap, and EN versions of all public pages (a faithful translation; prices stay MXN). JSON-LD `Organization` + `Offer` with IVA-inclusive MXN prices from `PRICING`, emitted only when `TRIAL_FLOW_ENABLED` and `LEGAL_PUBLISH` are both on.
- *Done when:* the §6.4 checks pass; the parity test passes; a Lighthouse CI run (or `@lhci/cli` locally) shows mobile ≥ 90 for `/` and `/planes`, with the report in the PR.

### Screens
#### SCR-10 · Landing (desktop) — `/` — mockup `10-landing` (BUILD-SPEC §8.1, sections in this order)
`PublicNav` anchors: Herramientas · Cómo funciona · Planes · Preguntas · Entrar · [Prueba Pro gratis].
1. **Hero:**
   - eyebrow `land.hero.eyebrow` "Todo incluido · Un plan, todas las herramientas"
   - `land.hero.title` "Bots que trabajan por ti mientras duermes"
   - `land.hero.sub` "Clips para tus redes, señales de cripto, tu transmisión y mucho más. Fuiste por una cosa y te llevaste todo."
   - the one CTA `land.cta` "Prueba Pro gratis 1 mes" + `land.cta.sub` "Todas las herramientas incluidas. Cancela cuando quieras."
   - 3 seals "En español" · "Sin saber de tecnología" · "Cancela en 1 clic"
   - panel "Mientras dormías" with up to 4 example results (P4-4) and a gradient clip frame
2. **Herramientas (`#herramientas`):**
   - `land.tools.title` "Todo lo que necesitas, en un solo lugar" · `land.tools.sub` "Cada herramienta hace una cosa y la hace por ti. Todas vienen en tu plan."
   - one card per active tool, with the pill "Incluido en Pro" and these one-liners: Clips "Convierte tu stream en clips cortos para TikTok, Reels y Shorts." · Señales "Te avisamos cuándo es buen momento para comprar o vender cripto." · En vivo "Maneja tu transmisión y tus escenas de OBS con botones grandes." · Asistente / Pronósticos / Inmuebles / Inversiones as in SCR-23
   - card "Tu idea": "¿Necesitas otra herramienta? Propónla y nosotros la construimos." [Proponer una idea]
3. **Cómo funciona (`#como`) en 3 pasos:** "Crea tu cuenta" (Con Google o con tu correo. Toma 1 minuto.) · "Elige qué quieres hacer" (Clips, señales, tu transmisión… todo está en Inicio con botones grandes.) · "Listo, trabaja por ti" (Te avisamos cuando tus resultados estén listos. Tú solo los usas.)
4. **Galería:** `land.gallery.title` "Así se ven tus clips" · "Pega el enlace de tu stream y recibe clips con subtítulos, listos para publicar." · 6 gradient frames ("Ejemplo").
5. **Para quién:**
   - `land.who.title` "Hecho para streamers, creadores y negocios" · "Si no tienes tiempo de editar, contestar o vigilar el mercado, Chalyb lo hace por ti."
   - cards: Streamers "Clips de cada transmisión y control de OBS en un toque." · Creadores "Publica todos los días sin pasar horas editando." · Negocios "Un asistente que atiende a tus clientes por ti." (only if Asistente is active) · Quien invierte "Avisos claros sobre cripto e inversiones, sin palabras raras." (only if Señales or Inversiones is active)
   - strip "En español, para México y Latinoamérica · Pago seguro con Mercado Pago · Ayuda de una persona por WhatsApp" (the last item per P4-5)
6. **Planes (`#planes`, summary):**
   - Gratis "$0" · "Sin tarjeta · Para siempre" [Crear cuenta gratis]
   - Pro (badge "Recomendado") **"$7,490 MXN al año"** big · "(equivale a $624 al mes)" · "Se renueva cada año" · pill "Ahorras $1,498 al año" · `plans.pro.monthAlt` "o $749 MXN al mes con Mensual" [Prueba Pro gratis 1 mes]
   - VIP **"$2,499 MXN al mes"** · "Se renueva cada mes" [Elegir VIP]
   - "Ver todos los planes y qué incluyen" → `/planes`
   - **No "2 meses gratis", no "$624" as the big number, no struck-through $8,988.**
7. **Socios:** `land.partner.title` "Tienes la idea, nosotros la construimos" · sub per P4-5 · [Proponer mi idea] → P4-6 form.
8. **FAQ (`#preguntas`), `land.faq.*`:**
   - "¿De verdad el primer mes es gratis?" → "Sí. Hoy pagas $0. Te avisamos por correo 7 días antes de que termine y puedes cancelar en 1 clic desde Mi cuenta, sin llamadas."
   - "¿Necesito saber de tecnología?" → "No. Cada herramienta te guía paso a paso, con botones grandes y palabras simples." + "Si te atoras, te ayuda una persona por WhatsApp." (P4-5)
   - "¿Qué incluye el plan Pro?" → "Todas las herramientas: {lista de herramientas activas}, con créditos cada mes."
   - "¿Cómo cancelo?" → "Entra a Mi cuenta → Mi plan → Cancelar. Es 1 clic y 1 confirmación. Sigues con Pro hasta el final de tu periodo."
   - "¿Cómo pago?" → "Con tarjeta de crédito o débito, de forma segura con Mercado Pago. Chalyb no guarda el número de tu tarjeta."
   - "¿Me dan factura?" (P4-5)
9. **Final CTA:** "Fuiste por una cosa y te llevaste todo." + the active-tools list + CTA.
10. **`PublicFooter`:**
    - columns Herramientas / Chalyb (Planes, Ayuda, Proponer una idea, Entrar) / **Legal: Términos y Condiciones · Términos de Suscripción · Aviso de Privacidad · Uso aceptable** (P6 routes; until `LEGAL_PUBLISH`, link only the existing documents and omit the missing ones)
    - "Quién vende" data (legal name, address, phone, email from `LEGAL_ENTITY_*`)
    - "© {año} Chalyb. Precios en pesos mexicanos (MXN), IVA incluido." · "Pago seguro con Mercado Pago" · "Cookies"

#### SCR-11 · Landing (móvil) — mockup `11-landing-movil`
Same structure in one column; hamburger menu; a **sticky bottom CTA "Prueba Pro gratis 1 mes" after the hero**; Pro card first in Planes; must work at 360 px; mobile description variants per the mockup (e.g. hero sub "Clips, señales de cripto, tu transmisión y mucho más. Fuiste por una cosa y te llevaste todo.").

### Tests
- **E2E:** landing desktop/390/360 screenshots, CTA targets, the Planes toggle, redirects, canonical/hreflang, the cookie-banner network gating, the idea form, axe.
- **Unit:** price rendering from `PRICING` (7,490 / 624 / 1,498 / 8,988 only inside "vs. …"), IVA presence, hero rows/cards/counts from active tools.
- **Content:** the forbidden-strings scan (§0.3, §11: "2 meses gratis", "Disponible", "próximamente", "beta", "apuesta", "garantizado") on `land.*` and the built bundle.

### DONE WHEN (includes BUILD-SPEC §8.1 acceptance)
- [ ] §7.1 gates green; P4-1…P4-8 done-when lines pass.
- [ ] Grandma finds the trial button without scrolling at 390×844; a pro reaches the prices in 1 tap.
- [ ] No public page claims something the product doesn't do today without a config flag (listed in the PR).
- [ ] `/planes` and its EN equivalent are in the sitemap with www canonicals; Lighthouse mobile ≥ 90 (report attached).

---

## P5 · Fase 5: Panel del dueño · `/dashboard` (BUILD-SPEC §9)
**Branch:** `claude/rebuild-p5-admin` · **Depends on:** P2 (billing movements, consent log, cancellations), P3 (tool states), P4 (idea form) · **Closes:** B18, B23, B24, B25 (verify first) · **Mockups:** 27, 28, 29
**Goal:** the owner answers "¿cuánto entró este mes y cuántas pruebas pagaron?" in < 10 s. Every number is real or tagged "Ejemplo". Every destructive action takes 2 steps and is logged with the admin's name.

**Start from main.** PR #17 (commit `c3fe15bc`) already reframed the admin: six-item nav, a 3-metric strip, a home-only rail, real badges, and risky team actions behind "Más" (B16, B19–B22 fixed). Keep those mechanics and **re-skin and re-map** them to BUILD-SPEC.
- **Same visual system as the app.** BUILD-SPEC §9 says "Mismo sistema visual", so the admin adopts the P1 tokens and components, light theme. This replaces the dark `cc-` theme on the routes below; leave untouched routes functional.
- **Nav of 6 (exact):** **Centro de mando · Personas · Dinero · Herramientas · Actividad · Ajustes**, plus the "Dueño" card and the link "Ver la app ›".
  - Map main's existing items onto these. Keep existing routes where they do the same job and add the BUILD-SPEC paths as aliases (`/dashboard/personas`, `/dashboard/dinero`, `/dashboard/herramientas`, `/dashboard/actividad`, `/dashboard/ajustes`).
  - Items main has beyond these (Royalties, AI Models, Labs) stay reachable from the closest BUILD-SPEC section or "Más", exactly as on main (Q30).
- **Access:** admin role only (existing middleware). Non-admins get the existing 404/redirect.
- **Technical labels are allowed in admin.** Tools show as "Clips (chalybclip)".

**Files:** `src/app/[locale]/(admin)/dashboard/**` (actual paths per main), `src/components/dashboard/{nav-data,kpi-card,data-table,confirm-step,example-tag,attention-list}.tsx`, `src/lib/billing/{money,money-data}.ts`, `src/lib/admin/{attention,activity,people-actions}.ts`, `messages/*` (`admin.*`).

### Fixes
**P5-1 · Centro de mando (SCR-27).**
- *Fix:* 4 `KpiCard`s fed by `billing_movements` and the subscription table (P2):
  - "Ingresos del mes" (MXN, vs last month);
  - "Suscriptores activos" (+n this month);
  - "Pruebas activas" ("Terminan esta semana: {n}");
  - "Conversión de prueba" ("De cada 10 pruebas, {n} se quedan").
- **"Necesita tu atención"** with a counter: cobros fallidos [Revisar] · reembolsos pedidos [Responder] · herramienta lenta [Ver] · ideas nuevas [Leer] (P4-6) · **avisos de cobro que rebotaron** [Ver] (they hold the charge, P2-6) · solicitudes ARCO [Responder] (legal deadline shown) · charges made without a delivered notice (refundable, terms §7.3).
- **"Herramientas"** health: "Funcionando bien" (green) / "Lento hoy" (amber) / "No funciona ahora" (red) from real signals (P0 failure log, job latency), each with [Ver actividad].
- *Done when:* unit tests run the aggregations on fixtures. Each attention item links to its target. Any delta on a zero base renders "—" (B23).

**P5-2 · Personas (SCR-28).**
- *Fix:*
  - Search "Buscar por nombre o correo"; chips Todos / En prueba / Pago pendiente / Cancelados.
  - `DataTable` (Persona, Plan, Estado, Desde) with chips: Activo (green) · En prueba (accent) · Pago pendiente (red) · Termina pronto (amber) · Cancelado (grey).
  - Row action sheet: "Regalar 1 mes gratis" · "Cambiar su plan" · "Reenviar correo de acceso" · "Reembolsar último cobro" · "Cancelar su suscripción" (red). Each one → **`ConfirmStep` "Confirma · paso 2 de 2"** (e.g. "¿Reembolsar $749 MXN a {nombre}?" · "Regresa a su tarjeta por Mercado Pago en 5 a 10 días. Queda registrado con tu nombre." [No, volver] [Sí, reembolsar]).
  - Refund calls the MP refund API and writes `refund_issued`. Cancel uses P2-7. Gift month extends access with no charge and is logged.
  - **"Cambiar su plan" never charges more without the user's consent:** it emails the user a link to a `ConfirmStep` with the recurring-charge checkbox (P2-9).
  - Every action lands in Actividad with the admin's name.
- *Done when:* unit tests cover each action (MP mocked). An e2e as Admin opens the sheet → confirm → the Actividad row appears. A plan upgrade from admin creates no charge until the user accepts.

**P5-3 · Dinero (SCR-29) (B25, B18).**
- *Fix:*
  - "Una sola fuente de verdad para tus ingresos." · "Viene de Mercado Pago · se actualiza cada hora".
  - 4 cards: "Ingresos del mes" ("Ya descontados los reembolsos") · "Pruebas que se convierten" ("{a} de {b} pruebas") · "Cobros fallidos" ("{n} cobros · se reintentan solos") · "Reembolsos" ("{n} este mes").
  - Bar chart "Ingresos por mes" (6 months); funnel "Pruebas de este mes": Empezaron prueba / Siguen en prueba / Ya pagaron / Cancelaron; movements table (Fecha, Persona, Concepto, Monto, Estado: Cobrado / Falló / Reembolsado).
  - **Source:** MP webhooks stored in `billing_movements` (P2-2), reconciled hourly (P2-8). **The panel never computes revenue from users' plans**, and the money truth (`docs/payments/money-truth.md`) remains the single definition.
  - Amounts include IVA. The CSV export adds an IVA breakdown when D1 confirms.
  - **B18 (verify):** no manual figures, and no percentage on a near-zero base (render "sin datos suficientes" when |base| < the config threshold).
  - Main's existing Pagos/Suscripciones/Costos sub-views fold into this page, with sections in that order.
- *Done when:* unit tests prove revenue = movements − refunds, with zero-base handling. An e2e as Admin answers "this month's revenue + trials paid" from the first screen. The PR states whether B18/B23 reproduced.

**P5-4 · Actividad (`/dashboard/actividad`).**
- *Fix:* a chronological event list: Clips failures with the §7.6 reason (P0), charges, failures, refunds, cancellations, notice bounces and holds, summarized `consent_events` (type, user, time, folio; no IP shown), and admin actions. Filter by tool and type.
- *Done when:* a unit test covers the merge and sort; the e2e filters by type.

**P5-5 · Herramientas (`/dashboard/herramientas`).**
- *Fix:* status per tool + a **show/hide switch**. It writes the field the customer catalog reads (prefer the existing `engines.status`; otherwise add a `visible` flag). A hidden tool appears nowhere (§0.3).
  - Hiding a tool that paying users have used in the last 30 days opens a `ConfirmStep` explaining that terms §7.3 / REVISION-LEGAL M5 require notice (30 days when possible) and an alternative or refund. The action is logged (Q34).
- *Done when:* the e2e hides a tool and verifies it disappears from Inicio, Más herramientas, landing and counts; the ConfirmStep shows for a used tool.

**P5-6 · Ajustes (`/dashboard/ajustes`) (B24).**
- *Fix:*
  - `PRICING` read-only, with a link to the config file.
  - **Toggle Mensual/Anual** (`billingToggleEnabled`): saved as a DB override over `TRIAL_PLAN_CHOICE_ENABLED` and audit-logged. It's the only pricing control that saves.
  - "Quién vende" data (read from `LEGAL_ENTITY_*`).
  - Current versions of the legal documents (P6 registry).
  - Everything else on main's settings page stays read-only (Q31).
- *Done when:* a unit test shows the override is read by `PRICING`; the e2e toggles it and SCR-12/14 hide or show Mensual.

**P5-7 · `ExampleTag`.**
- *Fix:* every sample number carries "Ejemplo" while real data is missing. In production the tag disappears once there's real data, and no sample value is ever shown without it.
- *Done when:* a unit test confirms no KPI renders a fixture value without the tag.

### Screens (BUILD-SPEC §9 keys)
#### SCR-27 · Centro de mando — `/dashboard` — mockup `27-admin-centro`
`admin.hello` "Buenos días 👋" (time-of-day variants: "Buenas tardes", "Buenas noches", CT) · `admin.home.title` "Centro de mando" · `admin.home.sub` "Así va Chalyb este mes. Lo importante, primero." · `Segmented` Hoy / 7 días / Este mes · 4 KPIs · "Necesita tu atención" · "Herramientas" (P5-1).

#### SCR-28 · Personas — `/dashboard/personas` — mockup `28-admin-personas`
`admin.people.title` "Personas" · "Todos tus suscriptores en un solo lugar." · search · chips · table · action sheet · `ConfirmStep` (P5-2).

#### SCR-29 · Dinero — `/dashboard/dinero` — mockup `29-admin-dinero`
`admin.money.title` "Dinero" · "Una sola fuente de verdad para tus ingresos." · "Viene de Mercado Pago · se actualiza cada hora" · 4 cards · chart · funnel · movements (P5-3).

### Tests
- **Unit:** KPI aggregations, zero-base deltas, revenue from movements only, people actions (MP mocked), the activity merge, the tool switch, the toggle override, ExampleTag.
- **E2E as Admin:** each nav item, the Personas refund ConfirmStep, the Dinero first-screen answer, hide-a-tool, axe on the 6 routes.
- **E2E as non-admin:** 404/redirect.

### DONE WHEN (includes BUILD-SPEC §9 acceptance)
- [ ] §7.1 gates green; P5-1…P5-7 done-when lines pass.
- [ ] The owner gets month revenue + trials paid in < 10 s. Every destructive action has a confirmation step. No sample number appears without "Ejemplo".
- [ ] No admin number is invented, hardcoded, or derived from a zero base. The PR states the B18/B23/B25 verification results.

---

## P6 · Fase 6: Páginas legales y registro de aceptación + release gate (BUILD-SPEC §10, §11.9; aceptacion-ux §8–§11)
**Branch:** `claude/rebuild-p6-legal` · **Depends on:** P2 (consent log, flows), P3 (risk/connect/likeness consents), P4 (footer, cookie banner), P5 (Ajustes shows versions) · **Closes:** — (prerequisite for any real charge)
**Sources (don't rewrite; publish as-is after the attorney signs):** `legal/terminos-y-condiciones.md`, `legal/terminos-de-suscripcion.md`, `legal/aviso-de-privacidad.md`, `legal/uso-aceptable-y-contenido.md`, `legal/aceptacion-ux.md` (microcopy + evidence log), `legal/REVISION-LEGAL.md` (findings), `legal/README.md`. The PDF draft `legal/chalyb-politicas-borrador.pdf` is a reference only.

**Status of the texts:** Law has revised them (REVISION-LEGAL, 30-sep-2026). They are complete but still carry owner/attorney values in brackets: `[RAZÓN SOCIAL]`, `[RFC]`, `[DOMICILIO]`, `[TELÉFONO]`, `[CORREO DE CONTACTO]`, `[CORREO DE PRIVACIDAD]`, `[VERSIÓN]`, `[FECHA]`, `[DÍAS DE GRACIA]`, `[IVA: CONFIRMAR]`, `[CRÉDITOS PRO/VIP/GRATIS]`, `[PROVEEDOR DE ANALÍTICA]`, `[LÍNEA DE AYUDA SOBRE JUEGO RESPONSABLE]`, `[VALIDAR CON ABOGADO]`, and similar. **Build all the machinery now.** Publishing is blocked by `LEGAL_PUBLISH` plus the placeholder gate until those values are filled and a licensed Mexican attorney signs (OPS-10). No code change is needed at that point: only the Markdown/config values change.

**Files:** new `content/legal/{terminos,suscripcion,privacidad,uso-aceptable}/v{X-Y}.md`, new `src/lib/legal/{registry,render,hash,tokens}.ts`, routes `src/app/[locale]/{terminos,suscripcion,privacidad,uso-aceptable,quien-vende}/page.tsx` + `/[doc]/v[version]/page.tsx` + `/terminos/cambios/[version]/page.tsx`, `src/app/[locale]/legal/{terms,privacy}` (→ 308), `next.config.ts` / `vercel.json` redirects, `src/components/legal/{reaccept-modal,price-change-modal,legal-doc}.tsx`, `src/app/[locale]/(dashboard)/app/settings/{datos,privacidad}/page.tsx`, the admin evidence-pack route, `messages/*`.

### Fixes
**P6-1 · Legal pages and versions (BUILD-SPEC §10.1).**
- *Fix:*
  - Routes: `/terminos` (+ `/terminos/v{x}`), `/suscripcion` (+ `/v{x}`; linked from the payment checkbox), `/privacidad` (+ `/v{x}`; the full notice, plus the simplified notice at sign-up), `/uso-aceptable` (anchor `#avisos` for the risk modal), and `/quien-vende` (art. 76 Bis fr. III; same data as P2-13's sheet).
  - Rendered from Markdown with a table of contents, a visible effective date and version number, readable at 18 px, printable (print CSS) and downloadable as PDF.
  - Archived versions are immutable. Each stores the sha256 of its source Markdown, and the registry generates `LEGAL_DOC_VERSIONS`.
  - Permanent redirects: `/legal/terms` → `/terminos`, `/legal/privacy` → `/privacidad`; `vercel.json` `/terms` and `/privacy` point at the new pages; replace P0's temporary aliases.
  - EN routes show the Spanish document with "This document is available in Spanish. The Spanish version prevails." (Q29).
  - Use an existing Markdown renderer if present; otherwise add a minimal sanitized one and justify it in the PR.
- *Done when:* the e2e gets each route 200 and the old routes 308; a versioned URL is stable after a new version is added; the hash test is green.

**P6-2 · Amounts in legal text come from `PRICING` (BUILD-SPEC §6.12).**
- *Fix:* on import, replace literal amounts and periods in the docs ($749, $7,490, $2,499, 30 días, 7 días, `[DÍAS DE GRACIA]`, `[CRÉDITOS …]` once set) with tokens (`{{price.pro.month}}`, `{{trial.days}}`, `{{reminders.month}}`, `{{graceDays}}`, `{{credits.pro}}`) resolved at render.
- *Done when:* a snapshot test proves the rendered text equals the Law source under the current `PRICING`, and that changing a price changes the legal render too.

**P6-3 · Publish gate.**
- *Fix:* `LEGAL_PUBLISH=false` by default. While false:
  - the legal routes render the **current** `/legal/terms` and `/legal/privacy` content, and `/suscripcion`, `/uso-aceptable` and `/quien-vende` return 404;
  - `TRIAL_FLOW_ENABLED` can't be turned on (startup assertion).
  - A build test fails if any doc marked `published` contains a bracket placeholder (`/\[[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 :\/,.\-]*\]/`), or if `LEGAL_ENTITY_*` is empty.
- *Done when:* unit tests cover both assertions and the placeholder regex against the current drafts (which must fail as "published").

**P6-4 · Acceptance flows wired to versions (BUILD-SPEC §10.2).**
- *Fix:* every consent surface built in P2/P3/P4 uses the exact aceptacion-ux text (§9-C) and stores `documents` [{doc, version, url, sha256}] from the registry:
  - §2 sign-up; §3 Tu prueba + checkbox; §3.5 card; §3.6 confirmation; §4 notices + bounce rule; §5 cancel; §6 risk modal; §7 connect, exchange, automation; §8 re-acceptance; §9 cookies.
  - **Archive** each published version (Markdown + rendered HTML + PDF + hash), and each billing-block and email template version, in `content/legal/**` and in immutable storage (OPS-10).
- *Done when:* a unit test shows events carry the current versions and hashes, and that each consent screen writes its event with the exact rendered text.

**P6-5 · Re-acceptance for Terms changes (aceptacion-ux §8; REVISION-LEGAL M4).**
- *Fix:* a **relevant change** (rights, payments or data) means:
  - an email ≥ 30 days before;
  - after the effective date, the §8 modal verbatim: [Aceptar y continuar] · [No acepto, ver opciones] (→ options: cancel without penalty, request a proportional refund for annual plans, download content, close account);
  - until the user accepts, the new version applies to **no charge**;
  - new features may be limited, but cancellation and content download are **never** blocked;
  - events `terms_reaccepted` / `terms_notice_shown`.
- A **minor change** shows the non-blocking banner "Actualizamos los Términos. [Ver cambios]" and logs `terms_notice_shown`.
- *Done when:* the e2e uses a fixture version bump for both kinds; cancel and download still work while the modal is pending.

**P6-6 · Price changes (aceptacion-ux §4; terms §5; REVISION-LEGAL A2).**
- *Fix:*
  - A `PRICING` increase for existing subscribers needs **express acceptance**: an email + in-app notice **exactly 30 days** before the renewal it affects (`price_change_notice_sent`), with the button "Acepto el nuevo precio" (`price_change_accepted`) and a 7-day reminder.
  - Without acceptance, the plan **doesn't renew** and moves to Gratis at period end (`price_change_declined`); the P2 cron cancels that preapproval before the charge.
  - Price decreases apply automatically.
  - A charge at an unaccepted price is flagged in admin as refundable (terms §7.3).
- *Done when:* unit tests cover notice timing (exactly 30 days), the accept and decline paths, and no charge at the new price without acceptance (MP mocked).

**P6-7 · Evidence log rules and chargeback pack (aceptacion-ux §10.4–§10.5; BUILD-SPEC §10.3; REVISION-LEGAL M9).**
- *Fix:*
  - Verify P2's `consent_events`: append-only (the app role lacks UPDATE/DELETE; corrections are new events), server UTC, the hash chain, IP and user agent encrypted, a daily backup of the hash batch to immutable storage (OPS-10).
  - **Retention job:** keep contract/charge evidence ≥ 10 years. Delete non-compliance marks (chargebacks, trial abuse, debts) at 72 months (art. 10 LFPDPPP; REVISION-LEGAL A5).
  - An admin-only action generates the **PDF** chargeback pack:
    1. the `trial_started`/`subscription_started` record (exact text, checkbox, time, IP, device, doc versions);
    2. the billing component as rendered for that `ui_version` (re-rendered from the stored text, or `screenshot_ref`);
    3. the confirmation email and the pre-charge notice with `message_id` and "delivered" status;
    4. usage after the charge (logins, clips);
    5. the cancellation date, or its absence;
    6. links to the versioned Suscripción terms and the cancellation/refund policy.
  - Optional NOM-151 seal of charge events (OPS-10).
- *Done when:* a test that tries UPDATE/DELETE fails; the retention job has unit tests (10 y kept, 72 m purged); the PDF generates for a test user and contains all 6 parts; the route is admin-only.

**P6-8 · Privacy and content rights in the app (Aviso §5, REVISION-LEGAL A5/A6; aceptacion-ux §11).**
- *Fix:*
  - Mi cuenta → "Privacidad y notificaciones" (marketing opt-out → `marketing_opt_out`).
  - "Mis datos (derechos ARCO)": request form → `arco_request_received` + email to the privacy contact + P5 attention item with the legal deadline. It includes **opposition to automated processing** (anti-fraud trial decisions; human review).
  - "Cuentas conectadas → Desconectar".
  - "Cerrar mi cuenta".
  - "Ayuda → Problema con un cobro".
  - Copyright notice-and-takedown form (`/uso-aceptable#avisos` link; the 4 legal minimum fields per uso-aceptable §5.1, the rest optional) → admin takedown action. On removal, store the content hash / source URL and **block re-uploads of the same content** (art. 114 Octies; REVISION-LEGAL A6).
  - Repeat-infringer counter; the policy threshold is a placeholder for Law (Q35).
  - Sign-up shows the simplified privacy notice (data processed, no sensitive data, how to limit use).
- *Done when:* the e2e visits each path from Mi cuenta; a unit test blocks a re-upload whose hash matches removed content.

**P6-9 · Other code-level legal requirements (BUILD-SPEC §11.9).**
- *Fix:* verify, with a test each:
  - "Quién vende" visible before paying (P2-13);
  - no browsewrap anywhere (content scan for "al usar", "al navegar aceptas");
  - re-acceptance modal (P6-5);
  - cookie banner before non-essential cookies (P4-7);
  - no anti-review clauses or flows (content scan for "reseña" restrictions);
  - anti-fraud trial decisions with human review (P2-4).
  - PROFECO adhesion-contract registration is an owner task (OPS-10).
- *Done when:* each listed test exists and passes.

**P6-10 · Release gate (absorbs the old hardening phase; cross-checks P0–P5).**
1. **Funnel events** per §6.5, wired at their true sources (P2 webhooks/cron, P3 first clip, sign-up) and consent-gated. An admin "Embudo (30 días)" card only if Vercel Analytics custom events can be read back; otherwise document where to view them.
2. **Accessibility sweep:** axe 0 serious/critical on 100% of customer and admin routes; landmarks; skip link; `aria-live` form errors; a keyboard-only spec trial → cancel.
3. **SEO polish:** unique titles and descriptions per public route and locale; OG images; legal pages in the sitemap once published; JSON-LD validated.
4. **EN parity:** the parity test and `check:copy` over the **whole** customer surface; fix any remaining hardcoded Spanish.
5. **Full e2e matrix** (env-gated, §7.2), BUILD-SPEC's 6 account types:
   - `gratis`: landing → sign in → Inicio (trial strip) → Clips works → Más herramientas `trial_offer` → SCR-14;
   - `trial`: banner by day, Mi plan prueba state, cancel;
   - `pro_mensual` and `pro_anual`: Inicio → tools → Mis resultados → Mi plan state + renewal banner at −7 (and −30 for annual);
   - `vip`: all tools, Mi plan VIP;
   - `past_due`: red banner, update card, cancel still possible;
   - admin: `/app/billing` not "Gratis", the 6 admin routes.
   - Plus **mutating** sandbox: the full trial path, switch, cancel, reactivate, VIP upgrade with consent.
   - Plus **no-leaks**, **360 px** and **axe** across all.
6. **Deploy-blocking legal suite** (BUILD-SPEC §11, "cada punto tiene una prueba automática"): P2-10 price rules, P2 consent 422, the P2-6 notice schedule + bounce hold, P2-7 cancel visibility, P3-5 signals uniformity, P3-11 withdrawal-key rejection and user-only rules, P3-9 Pronósticos scan, P3-10 likeness guard, P2-11 Quebec block, P6-3 placeholder gate. Wire them as one CI job `test:legal` that the deploy depends on.
- *Done when:* the suite passes locally against a preview with all `E2E_*` vars set; `test:legal` is a required check (the secrets are OPS-9); the PR includes the e2e report, the axe summary and the Lighthouse report.

### Tests
- **Unit:** registry, hashing, tokens, placeholder and publish gates, version stamping, re-accept logic, the price-change flow, retention, the evidence pack, re-upload blocking.
- **E2E:** routes and redirects, the re-accept modal, legal paths in Mi cuenta, the takedown form; plus the P6-10 matrix.

### DONE WHEN (includes BUILD-SPEC §10.3–§10.4)
- [ ] §7.1 gates green; P6-1…P6-10 pass with `LEGAL_PUBLISH=false` **and** with a fixture "published" version.
- [ ] A test that tries to delete or edit a consent event fails. Each consent screen generates its event with the exact text shown. The chargeback PDF generates for a test user.
- [ ] Nothing in `content/legal/**` is marked published while it contains placeholders.
- [ ] The final pre-publication list is reproduced in the PR as a checklist with each item's status: aceptacion-ux §11 in full + REVISION-LEGAL §5 "Para firma de abogado mexicano".
- [ ] The PR states: **"Legal texts are Law-revised drafts awaiting the owner's values and a licensed attorney's signature. Publishing and any real charge are OPS-10."**

---


# 9. COPY APPENDIX

> ⚠️ **SUPERSEDED 2026-10-03:** the amounts ($749, $7,490, $2,499, $624, $8,988, $1,498) and the 1-month / 30-day trial quoted in §9-A … §9-D are **history**. Law's current copy is `legal/aceptacion-ux.md` (Law-updated 2026-10-03), `legal/terminos-de-suscripcion.md` and `legal/PRICING-2026-10-03-REVISION.md`; amounts come from PRICING-CARDS-SPEC config.

## 9-A · Owner-approved trial copy (verbatim from `docs/specs/trial-billing-spec.md` "COPY (use exactly)")
> The older owner trial prompt's copy, kept as reference for intent and tone. **It is superseded wherever §9-B, BUILD-SPEC §6 or aceptacion-ux differ.** Build from BUILD-SPEC keys (P2 screens); don't ship strings from this block that §9-B overrides.

```text
COPY (use exactly)
- CTA: "Prueba Pro gratis 1 mes". Subtext: "Todas las herramientas incluidas. Cancela cuando quieras."
- Plan picker (screen 3):
  - ◉ Anual: "$624/mes" big, then directly under it at the same text weight (not fine print) "se cobra $7,490 al año", a struck-through ~~$8,988~~, and the badges "Recomendado" and "2 meses gratis".
  - ○ Mensual: "$749/mes".
- Disclosure block (screen 3, above the card form, and on Confirmación):
  "Hoy pagas **$0**. Tu mes gratis termina el **{fecha_fin}**.
  Si no cancelas, el **{fecha_cobro}** se cobrarán **${monto} MXN** ({anual: 'por 1 año de Pro' | mensual: 'cada mes'}) a tu tarjeta terminación {••1234}.
  Te avisamos por correo 3 días antes. Puedes cancelar en 1 clic desde Mi cuenta, sin llamadas."
  On screen 3, before a card exists, leave out "a tu tarjeta terminación {••1234}". Show it once the card is known.
- Under the card button: "Al continuar aceptas el cobro automático descrito arriba y los Términos." ("Términos" links to the terms page.) No checkbox.
- Confirmación: "¡Listo, {nombre}! Tu mes de Pro gratis ya empezó." / "Termina el {fecha_fin}. Primer cobro: ${monto} MXN el {fecha_cobro}." / [Hacer mis primeros clips] · link "Ver mi plan".
- Cancel screen:
  - Title: "¿Cancelar tu prueba?"
  - Body: "Seguirás teniendo Pro hasta el **{fecha_fin}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados."
  - Buttons: [Sí, cancelar] (secondary/danger) · [Seguir con Pro] (primary).
  - Done: "Listo, cancelaste. No se te cobrará nada. Si cambias de opinión, puedes volver a activar Pro en cualquier momento."
- Email 1, Bienvenida (day 0). Subject: "Tu mes de Pro gratis ya empezó 🎉"
  "Hola {nombre}, ya tienes Chalyb Pro completo: Clips, Señales, En vivo y todo lo demás. Empieza en 1 minuto: pega el enlace de tu stream y te damos tus clips. [Hacer mis primeros clips]
  Tu prueba termina el {fecha_fin}. Si no cancelas, el {fecha_cobro} se cobrarán ${monto} MXN. Cancela en 1 clic: [Mi plan]."
- Email 2, Recordatorio (day 27). Subject: "Tu prueba gratis termina en 3 días"
  "Hola {nombre}, tu mes de Pro gratis termina el {fecha_fin}. El {fecha_cobro} se cobrarán ${monto} MXN a tu tarjeta ••{1234} para seguir con Pro. Este mes hiciste {n_clips} clips. [Seguir con Pro] — no tienes que hacer nada.
  ¿No quieres seguir? [Cancelar en 1 clic]."
  If the plan is Anual and `TRIAL_PLAN_CHOICE_ENABLED`, add: "¿Prefieres pagar mes a mes? [Cambiar a $749/mes]". `{n_clips}` is the user's real clip count for the trial; if no reliable count exists, drop that sentence rather than showing a wrong number.
- Email 3, Cobro realizado (day 30). Subject: "Bienvenido a Chalyb Pro"
  "Hola {nombre}, cobramos ${monto} MXN a tu tarjeta ••{1234}. Tu plan Pro está activo hasta el {fecha_renovacion}. [Ver factura] · [Ir a Chalyb]."
- Failed-charge email. Subject: "No pudimos cobrar tu plan Pro"
  "Actualiza tu tarjeta para no perder Pro. Tienes hasta el {fecha_gracia}. [Actualizar tarjeta]"
- Banners (in-app, top of the page, one line and one button):
  - Trial active (quiet, gray/brand): "Prueba Pro gratis · te quedan {n} días" [Ver mi plan]
  - Last 3 days (amber): "Tu prueba termina el {fecha_fin}. Se cobrarán ${monto} MXN el {fecha_cobro}." [Ver mi plan]
  - Trial ended or cancelled (neutral): "Tu prueba terminó. Estás en el plan Gratis." [Volver a Pro]
  - Past due (red): "No pudimos cobrar tu plan. Actualiza tu tarjeta antes del {fecha_gracia} para no perder Pro." [Actualizar tarjeta]
- Price display rules: $624 is never shown alone near the card form or disclosure; there, the real total is always shown. Mensual $749 always sits next to Anual. Every price carries "MXN, IVA incluido".
- Mi plan copy for paid (post-trial) subscribers (UI/UX had no copy for this; use this plain wording, which UI/UX and Law may revise):
  - Status line: "Pro {Anual|Mensual} · se renueva el {fecha_renovacion} por ${monto} MXN (IVA incluido) · tarjeta ••{1234}"
  - Cancel button: "Cancelar renovación". Confirm: "Seguirás teniendo Pro hasta el **{fecha_renovacion}**. Después no se te volverá a cobrar y pasarás al plan Gratis." [Sí, cancelar] · [Seguir con Pro]
  - After cancelling: "Tu Pro termina el {fecha_fin}. No se te volverá a cobrar." [Reactivar renovación]
  - Plan switch: "Cambiar a Mensual ($749/mes)" / "Cambiar a Anual ($7,490/año, 2 meses gratis)". Confirm: "A partir del {fecha_renovacion} pagarás ${monto} MXN {cada mes|al año}. Hasta entonces sigues igual."
```

## 9-B · What overrides §9-A (the older owner trial prompt)
§9-A stays for reference: it holds the owner's original wording and intent. **Every row below is mandatory in the final build** (BUILD-SPEC §6/§11 + aceptacion-ux + REVISION-LEGAL), not a revertible preference. The only revertible items are the owner-decision flags in §12.

| # | Topic | Older trial prompt (§9-A) | Final (ship) | Source |
|---|---|---|---|---|
| O1 | Trial pre-charge notice | 3 days before (day 27) | **7 days before (day 23)**; config values < 5 fail at startup | BUILD-SPEC §6.1/§6.11; art. 76 Bis fr. VIII |
| O2 | Consent at payment | No checkbox; "Al continuar aceptas…" | **Required, unchecked recurring-charge checkbox** next to "Empezar mi mes gratis" (aceptacion-ux §3.3 text); button disabled until checked; **server 422 without it**; `consent_events` evidence (§10.2 fields: exact rendered text + hash, versions, amount, period, dates, last 4, IP, UA) | BUILD-SPEC §6.6, §11.2 |
| O3 | Disclosure text | Owner sentence | aceptacion-ux §3.2 template (`disclosure.today/charge/reminder/cancel`) | BUILD-SPEC §6.5 |
| O4 | Price lead | "$624/mes" big | **"$7,490 MXN al año"** big + "(equivale a $624 al mes)" small + "Se renueva cada año"; $624 never near the card form or in a billing block | BUILD-SPEC §6.2, §11.1 |
| O5 | Savings badge | "2 meses gratis" | **Removed everywhere** (UI, emails, metadata); "Ahorras $1,498 al año"; bundle/email scan test | BUILD-SPEC §11.1 |
| O6 | Struck-through price | ~~$8,988~~ | **Removed.** Optional only as "vs. $8,988 pagando mes a mes" | BUILD-SPEC §6.2 |
| O7 | Card step line | Real total + date | Real total **and period** + date: "…y después cada año\|mes, salvo que canceles antes." | BUILD-SPEC §6.6 |
| O8 | Confirmation | End date + charge | + card ••, recap, "se renueva {cada_periodo} hasta que canceles", **folio = `consent_id`** | BUILD-SPEC §6.7 |
| O9 | Emails | E1–E3 owner bodies | Owner subjects; bodies from §9-D with the legal blocks (versions, folio, IVA, auto-renew, cancel link); new 3b, 4, 5, 6, 7 | BUILD-SPEC §6.11 |
| O10 | Renewal notices | None | **7 days before every** monthly and annual renewal, **+30 days for annual**; email + banner + in-app on the same day; annual summary for monthly plans | BUILD-SPEC §6.8, §6.11, §11.3 |
| O11 | Failed notice | Not covered | **Bounce rule:** no charge until 5 calendar days after an effective notice via an alternate channel (banner + in-app + WhatsApp when available); `reminder_delivered_at` required by the billing job | BUILD-SPEC §6.11; terms §2.7 bis |
| O12 | Cancel | "Cancelar renovación"; owner done text | "Cancelar prueba" / "Cancelar suscripción"; 2 clicks; at most 1 retention offer with **"Sí, cancelar" always visible, same weight**; immediate MP cancel; folio + email | BUILD-SPEC §6.9, §11.3 |
| O13 | Plan changes | All at renewal, no proration | VIP upgrade **immediate with proration shown first + consent checkbox**; downgrades and period changes at period end; trial-plan switch before the first charge | BUILD-SPEC §6.10 |
| O14 | Mi plan copy | Placeholders | BUILD-SPEC §6.10, all 6 states (P2 SCR-30) | BUILD-SPEC §6.10 |
| O15 | Mi cuenta button | "Ver planes" (first mockup 07) | **"Ver mi plan"** | BUILD-SPEC §5.2 |
| O16 | Clip count | "Te recomendamos 5" (first mockups 03/06) | **6** preselected (3 · 6 · 10), "Te recomendamos 6 para empezar." | BUILD-SPEC §7.1, D9 |
| O17 | Sign-up | Existing sign-up, no extra questions | + "Tu nombre", clickwrap with 3 docs + "18 años o más", unchecked marketing checkbox, `signup_terms_accepted` | BUILD-SPEC §6.4 |
| O18 | Plan choice | Annual or monthly | Same, behind `TRIAL_PLAN_CHOICE_ENABLED` (BUILD-SPEC `billingToggleEnabled`), **default ON** | BUILD-SPEC §6.1 |
| O19 | IVA | "Prices are IVA incluido" (owner) | `PRICES_INCLUDE_IVA=true` config + IVA breakdown on summary/receipts; **real charges blocked until the accountant confirms** (D1) | BUILD-SPEC §0.1, §11.7 |
| O20 | One trial | Per account | **Per person, card or account**, with human review of anti-fraud refusals | REVISION-LEGAL §4; Aviso §5.1 |
| O21 | Quebec | — | `QUEBEC_PAID_BLOCK=true` blocks paid plans until D2 | BUILD-SPEC §11.8 |
| O22 | Product guardrails | — | Uniform signals; no balances/positions/risk profile; no auto-copy/auto-trading; user-written rules only; withdrawal keys rejected; Pronósticos with no bets/contests; AI likeness only with prior written consent (logged) | BUILD-SPEC §11.4–§11.6 |
| O23 | Grace | MP retry window | `PRICING.graceDays=7`, full plan during grace; cancel is never blocked by a debt | BUILD-SPEC §6.1, §6.10 |

## 9-C · Legal microcopy (verbatim from `legal/aceptacion-ux.md` §2–§9, Law-revised 2026-09-30)
> Source of truth for the signup clickwrap, the disclosure template, the checkbox, the card line, the confirmation, reminders, cancel, the risk modal, the connect/autopublish/exchange/automation consents, re-acceptance and the cookie banner. When Law revises the file, re-copy this block.

```markdown
## 2. Registro (crear cuenta)

**Ubicación:** debajo del botón principal de registro (correo o "Continuar con Google").

**Microcopy (clickwrap):**

> Al crear tu cuenta aceptas los [Términos y Condiciones](/terminos) y la [Política de Uso Aceptable](/uso-aceptable), y confirmas que leíste el [Aviso de Privacidad](/privacidad). Debes tener 18 años o más.

- Botón: **Crear cuenta** · Botón alterno: **Continuar con Google**
- Los enlaces abren en una ventana nueva o en un panel, sin perder lo capturado.

**Casilla de marketing (separada, desmarcada, opcional):**

> ☐ Quiero recibir novedades, consejos y promociones de Chalyb por correo. Puedo darme de baja cuando quiera.

**Evidencia a guardar:** evento `signup_terms_accepted` (y `marketing_opt_in` solo si se marca) — ver sección 10.

## 3. Pantalla "Tu prueba" (antes de pedir la tarjeta)

### 3.1. Título y selector de plan

**Título:** Prueba Pro gratis 1 mes
**Subtítulo:** Todas las herramientas incluidas. Cancela cuando quieras.

**Pregunta:** ¿Qué plan quieres cuando termine tu mes gratis?

- ◉ **Pro anual — $7,490 MXN al año** (equivale a $624/mes) · Ahorras $1,498 al año · *Recomendado*
- ○ **Pro mensual — $749 MXN al mes**

> Nota de diseño: el plan anual aparece preseleccionado, pero en la opción seleccionada el monto principal visible es **$7,490 MXN al año**, no $624. El usuario puede cambiar a mensual con 1 toque. El bloque de cobro (3.2) se actualiza en vivo según la opción. **No usar "2 meses gratis"** junto a una prueba de "1 mes gratis": confunde sobre cuánto dura la prueba (riesgo de publicidad engañosa, art. 32 LFPC). Si se usa precio tachado, rotularlo: "$8,988 si pagas 12 meses de Pro mensual".

### 3.2. Bloque de cobro (aparece junto al botón, siempre visible)

**Plantilla:**

> **Hoy pagas $0.**
> Tu mes gratis termina el **{fecha_fin_prueba}**.
> Si no cancelas antes, el **{fecha_cobro}** se cobrarán **${monto} MXN** {periodicidad} a tu tarjeta terminación **{ultimos4}**, y se renovará automáticamente {renovacion} hasta que canceles.
> Te avisaremos por correo el **{fecha_recordatorio}** (7 días antes).
> Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el {fecha_fin_prueba} y no se te cobra nada.

Variables:
- `{periodicidad}`: anual → "por 1 año de Pro" · mensual → "por tu primer mes de Pro"
- `{renovacion}`: anual → "cada año ($7,490 MXN)" · mensual → "cada mes ($749 MXN)"
- `{ultimos4}`: si aún no hay tarjeta en esta pantalla, usar "a la tarjeta que registres" y mostrar los 4 dígitos en la pantalla de confirmación.

**Ejemplo renderizado (anual, prueba iniciada el 30 de septiembre de 2026):**

> **Hoy pagas $0.**
> Tu mes gratis termina el **30 de octubre de 2026**.
> Si no cancelas antes, el **30 de octubre de 2026** se cobrarán **$7,490 MXN** por 1 año de Pro a tu tarjeta terminación **4821**, y se renovará automáticamente cada año ($7,490 MXN) hasta que canceles.
> Te avisaremos por correo el **23 de octubre de 2026** (7 días antes).
> Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el 30 de octubre de 2026 y no se te cobra nada.

### 3.3. Casilla de consentimiento (obligatoria, desmarcada) y botón

> ☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {renovacion_corta} a mi tarjeta, y acepto los [Términos de Suscripción](/suscripcion).

- `{renovacion_corta}`: anual → "y cada año después" · mensual → "y cada mes después"
- Botón (deshabilitado hasta marcar la casilla): **Empezar mi mes gratis**
- Si el usuario intenta continuar sin marcar: "Marca la casilla para confirmar el cobro automático. Puedes cancelar cuando quieras."

### 3.4. Alternativa "botón como aceptación" (solo si el abogado la aprueba)

Sin casilla; el botón dice **Empezar mi mes gratis y aceptar el cobro automático** y debajo:

> Al tocar el botón aceptas el cobro automático descrito arriba y los [Términos de Suscripción](/suscripcion).

Es más fluida, pero la casilla genera **mejor evidencia de consentimiento expreso** para contracargos y PROFECO. Recomendación: casilla.

### 3.5. Pantalla de tarjeta (Mercado Pago)

Encima del formulario (Brick de Mercado Pago), repetir en 1 línea:

> Hoy pagas **$0**. Primer cobro: **${monto} MXN** el **{fecha_cobro}**, salvo que canceles antes.

Debajo del formulario: "Pago seguro con Mercado Pago. Chalyb no guarda el número de tu tarjeta."

### 3.6. Confirmación (pantalla + correo de confirmación)

**Pantalla:**
> **¡Listo, {nombre}! Tu mes de Pro gratis ya empezó.**
> Termina el {fecha_fin_prueba}. Primer cobro: **${monto} MXN** el {fecha_cobro} a tu tarjeta ••{ultimos4}.
> [Hacer mis primeros clips] · [Ver mi plan]

**Correo de confirmación (enviar de inmediato; es evidencia):**
- Asunto: **Tu mes de Pro gratis ya empezó: esto es lo que debes saber**
- Cuerpo:
> Hola {nombre}:
> Tu prueba gratis de Chalyb Pro empezó el {fecha_inicio} y termina el {fecha_fin_prueba}.
> **Hoy pagaste $0.** Si no cancelas antes, el **{fecha_cobro}** cobraremos **${monto} MXN** ({plan}) a tu tarjeta ••{ultimos4}, y después **{renovacion}** hasta que canceles.
> Te avisaremos el {fecha_recordatorio}.
> **Cancelar es 1 clic:** [Cancelar mi prueba] (Mi cuenta → Mi plan).
> Documentos que aceptaste: [Términos y Condiciones v{version_tyc}] · [Términos de Suscripción v{version_sus}] · [Aviso de Privacidad v{version_priv}].
> Folio de tu aceptación: {consent_id}

## 4. Recordatorios y avisos de cobro

| Momento | Canal | Asunto / texto |
|---|---|---|
| **7 días antes** del fin de la prueba (día 23) — **obligatorio (≥5 días naturales, art. 76 Bis fr. VIII LFPC; también cumple Quebec: 2–10 días)** | Correo + banner | **Tu prueba gratis termina el {fecha_fin_prueba}** · "El {fecha_cobro} se cobrarán ${monto} MXN a tu tarjeta ••{ultimos4} por {plan}. ¿Prefieres pagar mes a mes? [Cambiar a $749/mes] · ¿No quieres seguir? [Cancelar en 1 clic]" |
| 1 día antes (recomendado) | Correo + banner ámbar | **Mañana termina tu prueba gratis** · "Mañana, {fecha_cobro}, se cobrarán ${monto} MXN. [Ver mi plan] · [Cancelar]" |
| Día del cobro | Correo | **Recibimos tu pago de ${monto} MXN** · comprobante, plan, próxima renovación, enlace a cancelar y a factura |
| Renovación anual: 30 días antes | Correo | **Tu plan Pro anual se renueva el {fecha_renovacion}** · monto, fecha, [Cambiar a mensual] · [Cancelar renovación] |
| Renovación mensual: **7 días antes** — **obligatorio (≥5 días)** | Correo + banner | **Tu plan {plan} se renueva el {fecha_renovacion} por ${monto} MXN** · [Ver mi plan] · [Cancelar] |
| Recordatorio anual para planes mensuales (una vez al año) | Correo | **Resumen anual de tu suscripción** · plan, monto, periodicidad, próxima fecha de cobro, [Cancelar] (California B&P §17602(h), lectura conservadora) |
| Cambio de precio: **exactamente 30 días antes** (ni menos de 30 por Quebec, ni más de 30 por California) | Correo + modal | **Cambia el precio de tu plan a partir del {fecha}** · precio anterior, nuevo, [Acepto el nuevo precio] · [Cancelar sin costo]. **Sin aceptación expresa no se renueva** al nuevo precio; enviar recordatorio 7 días antes de la fecha. |

Guardar evidencia de envío de cada aviso: `message_id` del proveedor de correo, plantilla y versión, fecha y hora UTC, estado de entrega (entregado/rebotado). Si el aviso obligatorio rebota o no se envía, mostrar banner en la app, intentar otro medio y **no cobrar hasta que hayan pasado al menos 5 días naturales desde una notificación efectiva** (regla obligatoria, recogida en la sección 2.7 bis de los Términos de Suscripción). Un cobro sin aviso previo es reembolsable (Términos de Suscripción 7.3).

## 5. Cancelación (1 clic + 1 confirmación)

**Mi cuenta → Mi plan:** botón visible **Cancelar prueba** / **Cancelar suscripción** (no escondido, no en "más opciones").

**Pantalla de confirmación:**
> **¿Cancelar tu {prueba|suscripción}?**
> Seguirás teniendo {plan} hasta el **{fecha_fin_acceso}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados.
> [Sí, cancelar] · [Seguir con {plan}]

(Opcional, una sola vez y saltable: "¿Prefieres pagar mes a mes? [Cambiar a $749/mes]". Si se muestra la oferta, el botón **[Sí, cancelar]** debe seguir visible en la misma pantalla y con el mismo peso visual.)

**Hecho:**
> **Listo, cancelaste.** No se te volverá a cobrar. Tienes {plan} hasta el {fecha_fin_acceso}. Folio: {folio_cancelacion}. Te enviamos la confirmación a {correo}.

**Correo:** "Confirmamos tu cancelación (folio {folio_cancelacion}) el {fecha_hora_cancelacion}. Tu acceso de pago termina el {fecha_fin_acceso}. No habrá más cobros."

## 6. Aviso de riesgo: Señales, Pronósticos, Inversiones (primera activación)

**Modal (bloquea la herramienta hasta aceptar, una vez por herramienta y por versión):**

> **Antes de empezar**
> {Herramienta} da **información general** generada con IA, igual para todos los usuarios de tu plan. **No es asesoría financiera, de inversión ni de apuestas**, no es una recomendación personal para ti y no toma en cuenta tus saldos, posiciones ni objetivos. No garantizamos resultados y **puedes perder todo tu dinero**. Chalyb no es asesor en inversiones registrado ante la CNBV, ni casa de bolsa, exchange o casa de apuestas.
> [Leer aviso completo](/uso-aceptable#avisos)
> ☐ Entiendo y acepto que las decisiones y los riesgos son míos.
> [Entendido, continuar]

## 7. Conectar cuentas y datos financieros

**Conectar red social (antes de OAuth):**
> Vas a conectar tu cuenta de {plataforma}. Chalyb podrá ver tus videos y **publicar solo cuando tú lo indiques** o actives la publicación automática. No vemos tu contraseña. Puedes desconectarla cuando quieras.
> [Conectar {plataforma}]

**Activar publicación automática:**
> ☐ Entiendo que Chalyb publicará clips en **{cuenta}** según las reglas que configuré y que **soy responsable** de lo que se publique.
> [Activar publicación automática]

**Conectar exchange o bróker (datos patrimoniales; consentimiento expreso LFPDPPP):**
> Para conectar {exchange}, Chalyb tratará tus claves de API y datos de tu cuenta (saldos, posiciones, operaciones) solo para mostrártelos y ejecutar las reglas que tú configures, como explica el [Aviso de Privacidad](/privacidad). Recomendamos claves **solo de lectura** (y de operación solo si usarás automatizaciones). **Rechazamos claves con permiso de retiro.**
> ☐ Doy mi consentimiento expreso para que Chalyb trate estos datos financieros.
> [Conectar]

**Activar una automatización (Inversiones):** la regla la escribe el usuario (activo, condición, monto máximo, horario). Antes de activarla:
> Esta automatización enviará órdenes a tu cuenta de {exchange} **solo según la regla que tú definiste**: {resumen_regla}. Chalyb no elige activos, montos ni momentos por ti. Puedes pausarla cuando quieras.
> ☐ Revisé la regla y acepto que las órdenes y sus riesgos son míos.
> [Activar]

**Prohibido sin validación de abogado/CNBV:** botones tipo "Copiar esta señal automáticamente", carteras modelo que se ejecuten solas, o recomendaciones generadas a partir de los saldos, posiciones o perfil de riesgo del usuario (ver REVISION-LEGAL.md, hallazgo C1).

## 8. Cambios a los Términos (re-aceptación)

**Cambio relevante** (afecta derechos, pagos o datos): avisar por correo **≥30 días antes** (Quebec exige 30 días para modificaciones unilaterales) y, al entrar después de la fecha de vigencia, mostrar modal:

> **Actualizamos nuestros Términos**
> A partir del **{fecha_vigencia}** cambian algunos puntos:
> • {cambio_1_en_una_línea}
> • {cambio_2_en_una_línea}
> • {cambio_3_en_una_línea}
> [Ver todos los cambios](/terminos/cambios/{version})
> Si no estás de acuerdo, puedes cancelar tu plan sin costo.
> [Aceptar y continuar] · [No acepto, ver opciones]

- "No acepto, ver opciones" → pantalla con: cancelar suscripción sin penalización, solicitar reembolso proporcional (si plan anual y el cambio lo perjudica), descargar contenido, cerrar cuenta.
- Mientras no acepte: no se le aplica la nueva versión a ningún cobro; se le puede limitar el uso de funciones nuevas, pero **no** bloquear la cancelación ni la descarga de su contenido.
- **Cambio menor** (redacción, nuevas funciones sin perjuicio): banner no bloqueante "Actualizamos los Términos. [Ver cambios]" + registro del evento `terms_notice_shown`.

## 9. Banner de cookies

> Usamos cookies necesarias para que Chalyb funcione y, si aceptas, cookies de analítica y publicidad para mejorar y medir campañas. [Aceptar todas] [Solo necesarias] [Configurar]

Analítica y publicidad **desactivadas** hasta que el usuario acepte.
```


## 9-D · Revised trial path (verbatim from `docs/design/app-reimagine/trial-to-paid-path.md`, revised 2026-09-30 21:18 CT by the legal review)
> UI/UX's trial path after REVISION-LEGAL C2. It's the source for the email bodies E1–E3 and the cancel copy. Where it disagrees with the mockups (checkbox placement), the conflict is D3 / Q5 (default: step 3).

```markdown
# Chalyb: Prueba Pro gratis → Pro anual (UX + copy)
Naming: brand "Chalyb" only as logo. Tools in plain Spanish: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles, Inversiones (no ChalyClip/ChalybClip prefixes in UI).

## 0. Recommended guardrail (important)
Auto-converting a free month into a $7,490 annual charge is the #1 refund/chargeback + PROFECO complaint trigger. Fix without losing the conversion: on the trial screen the user PICKS the plan that starts after the trial, with **Anual preselected** ("Recomendado · Ahorras $1,498 al año"; do NOT say "2 meses gratis" next to a "1 mes gratis" trial — confusing/misleading, art. 32 LFPC) and Mensual $749 as the second option. Same flow, same clicks, but the charge is one they chose. If owner insists on annual-only, keep everything below and make the $7,490 total impossible to miss.

## 1. Path (fewest clicks)
1. **Landing** → CTA "Prueba Pro gratis 1 mes" (1 click)
2. **Crear cuenta**: Google button or email+contraseña (1 step). No extra profile questions.
3. **Tu prueba** (one screen): plan choice (Anual preselected / Mensual) + disclosure block + **mandatory unchecked consent checkbox** + button "Continuar al pago" (disabled until checked). User can go back and change plan before paying. Seller name, address, phone visible (footer/"Quién vende") — art. 76 Bis III LFPC.
4. **Mercado Pago card** (embedded/brick, not a redirect if possible). Above the form repeat 1-line disclosure. Button "Empezar mi mes gratis".
5. **Confirmación**: "¡Listo! Tu mes gratis ya empezó" + dates/price recap + big primary "Hacer mis primeros clips" (goes straight to Clips paso 1). Email #1 sent.
6. **First clip** (3-step Clips wizard: pegar enlace → formato → listos). Trial banner visible but quiet.
7. **Day 23 (7 days before charge)**: email #2 + in-app banner (reminder state). **Mandatory.** If the email bounces/fails: banner + other channel, and do NOT charge until ≥5 calendar days after an effective notice (Suscripción 2.7 bis). Optional extra reminder on day 29.
8. **Day 30**: charge → email #3 (cobro) + Pro continues. OR user canceled → access until end date, then Gratis.
Cancel: Mi cuenta → Mi plan → "Cancelar prueba" → 1 confirm screen → done (2 clicks, no retention maze; 1 optional offer max, and the "Sí, cancelar" button must stay visible on the same screen as the offer — California B&P §17602(e)(2)).
After conversion: monthly renewals get a reminder **7 days before** each charge (same as trial); annual renewals 30 days before; one annual summary email for monthly plans; price increases only with express acceptance, notice exactly 30 days before.

## 2. Copy
**CTA (landing/home):** "Prueba Pro gratis 1 mes" · sub: "Todas las herramientas incluidas. Cancela cuando quieras."

**Plan picker (screen 3):**
- ◉ Anual — **$7,490 MXN al año** · equivale a $624/mes · Ahorras $1,498 vs. 12 meses de Pro mensual ($8,988) · Recomendado
- ○ Mensual — $749/mes

**Disclosure block (screen 3, above card, and on confirmation):**
"Hoy pagas **$0**. Tu mes gratis termina el **{fecha_fin}**.
Si no cancelas, el **{fecha_cobro}** se cobrarán **${monto} MXN** ({anual: 'por 1 año de Pro' | mensual: 'por tu primer mes de Pro'}) a tu tarjeta terminación {••1234}, y se renovará automáticamente {anual: 'cada año ($7,490 MXN)' | mensual: 'cada mes ($749 MXN)'} hasta que canceles.
Te avisamos por correo el {fecha_recordatorio} (7 días antes). Puedes cancelar en 1 clic desde Mi cuenta, sin llamadas."
**Checkbox REQUIRED (unchecked, mandatory)** — art. 76 Bis fr. VIII LFPC requires *consentimiento expreso e informado* for recurring charges; a checkbox is the strongest evidence (also satisfies ROSCA / California "express affirmative consent"). Use the exact copy in `legal/aceptacion-ux.md` §3.3:
"☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {y cada año después | y cada mes después} a mi tarjeta, y acepto los [Términos de Suscripción]." Button "Empezar mi mes gratis" disabled until checked. (Button-only acceptance only if the Mexican attorney approves — see aceptacion-ux §3.4.)

**Confirmación:** "¡Listo, {nombre}! Tu mes de Pro gratis ya empezó." / "Termina el {fecha_fin}. Primer cobro: ${monto} MXN el {fecha_cobro}." / [Hacer mis primeros clips] · link "Ver mi plan".

**Cancel screen:**
Title: "¿Cancelar tu prueba?"
Body: "Seguirás teniendo Pro hasta el **{fecha_fin}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados."
(Optional offer, once: "¿Prefieres pagar mes a mes? [Cambiar a $749/mes]" — with [Sí, cancelar] still visible on the same screen.)
Buttons: [Sí, cancelar] (secondary/danger) · [Seguir con Pro] (primary)
Done: "Listo, cancelaste. No se te cobrará nada. Tienes Pro hasta el {fecha_fin}. Folio: {folio_cancelacion}. Si cambias de opinión, puedes volver a activar Pro en cualquier momento." + confirmation email with folio.

**Email 1 – Bienvenida (día 0)**
Asunto: "Tu mes de Pro gratis ya empezó 🎉"
"Hola {nombre}, ya tienes Chalyb Pro completo: Clips, Señales, En vivo y todo lo demás. Empieza en 1 minuto: pega el enlace de tu stream y te damos tus clips. [Hacer mis primeros clips]
Tu prueba termina el {fecha_fin}. Si no cancelas, el {fecha_cobro} se cobrarán ${monto} MXN ({plan}) a tu tarjeta ••{1234}, y después {renovacion} hasta que canceles. Te avisaremos el {fecha_recordatorio}. Cancela en 1 clic: [Mi plan].
Documentos que aceptaste: [Términos v{x}] · [Suscripción v{x}] · [Privacidad v{x}] · Folio: {consent_id}"
(Email 1 is evidence + the confirmation/copy required by California ARL, Ontario/Quebec distance-contract rules. Send immediately. "Chalyb Pro" is OK as plan/product name.)

**Email 2 – Recordatorio (día 23, 7 días antes del cobro) — VALIDATED: art. 76 Bis fr. VIII LFPC (reforma DOF 12-dic-2025, vigente 13-dic-2025) requires ≥5 días naturales; 7 days complies with margin. Also fits Quebec (2–10 days before free period ends, in force 12-sep-2026). Must be delivered; see bounce rule above.**
Asunto: "Tu prueba gratis termina en 7 días"
"Hola {nombre}, tu mes de Pro gratis termina el {fecha_fin}. El {fecha_cobro} se cobrarán ${monto} MXN ({anual: 'por 1 año de Pro' | mensual: 'por tu primer mes de Pro'}) a tu tarjeta ••{1234} para seguir con Pro, y se renovará automáticamente hasta que canceles. Este mes hiciste {n_clips} clips. [Seguir con Pro] — no tienes que hacer nada.
¿No quieres seguir? [Cancelar en 1 clic]."
(If annual: add "Prefieres pagar mes a mes? [Cambiar a $749/mes]" — big chargeback reducer.)

**Email 3 – Cobro realizado (día 30)**
Asunto: "Bienvenido a Chalyb Pro"
"Hola {nombre}, cobramos ${monto} MXN (IVA incluido) a tu tarjeta ••{1234}. Tu plan Pro está activo hasta el {fecha_renovacion}; se renovará automáticamente por ${monto} MXN salvo que canceles. Cancela en 1 clic: [Mi plan]. [Ver factura] · [Ir a Chalyb]."
(Failed charge variant — Asunto: "No pudimos cobrar tu plan Pro" · "Actualiza tu tarjeta para no perder Pro. Tienes hasta el {fecha_gracia}. [Actualizar tarjeta]")

**Banners (in-app, top, one line + one button):**
- Prueba activa (quiet, gray/brand): "Prueba Pro gratis · te quedan {n} días" [Ver mi plan]
- Últimos 7 días (amber): "Tu prueba termina el {fecha_fin}. Se cobrarán ${monto} MXN el {fecha_cobro}." [Ver mi plan]
- Prueba terminada / cancelada (neutral): "Tu prueba terminó. Estás en el plan Gratis." [Volver a Pro]
- Pago pendiente / past-due (red): "No pudimos cobrar tu plan. Actualiza tu tarjeta antes del {fecha_gracia} para no perder Pro." [Actualizar tarjeta]

## 3. Price display
- **Lead with the real total: "$7,490 MXN al año"** (big). "$624/mes" only as secondary text ("equivale a $624/mes"). Changed for compliance: art. 7 Bis LFPC (total price, notorio y visible) + art. 76 Bis VIII (amount and periodicity clear and prominent); aligned with `legal/aceptacion-ux.md` §1.3/§3.1.
- Savings badge: **"Ahorras $1,498 al año"**. If a strikethrough is used, label it: "$8,988 si pagas 12 meses de Pro mensual" (it is a comparison, not a former price). No "2 meses gratis" badge.
- Never show $624 alone anywhere near the card form or disclosure: there show the real total $7,490 MXN.
- Show Mensual $749 next to it so the annual looks like the deal (anchor effect) and gives a non-scary exit.
- All prices "MXN, IVA incluido" — **launch blocker:** confirm with the accountant; if current prices are before IVA, displayed totals would be $868.84 / $8,688.40 / $2,898.84.
- Dates in plain format: "30 de octubre de 2026", never 30/10/26.

```

---

# 10. BUG COVERAGE (checked against `main` @ `3f27ef3`; full table with evidence in `claude-prompt-chalyb-full-rebuild.coverage.md`)

| ID | Bug | Status on main | Fixed in |
|---|---|---|---|
| B01 | Clips "Abrir"/"Abrir prueba" fails silently (popup blocked after await) | open | P0-1 |
| B02 | Provisioning missing; `external_user_id` empty; "Crear tu cuenta" silent | open | P0-2 |
| B03 | Raw/technical/English error toasts (incl. env var names) | open | P0-4 |
| B04 | Env/config leak + "configuración quedó incompleta" on tool page (= BUILD-SPEC B2) | open | P0-5 (named `SetupState`), P3-14 |
| B05 | `/app/usage` diagnostic strip leak | open | P0-6 |
| B06 | "modo demo"/"Disponible" for Free; card vs page permission mismatch (= BUILD-SPEC B1) | open | P0-3, P0-7, P2-1 |
| B07 | Launch not refused server-side by entitlement | open | P0-3, P2-1 |
| B08 | "ChalyClip"-style names in customer UI | open | P0-8 |
| B09 | Public `/engines` 404 | open | P0-9 (307), P4-3 (308 → `/#herramientas`) |
| B10 | EN logout shows Spanish | open | P0-10 |
| B11 | Admin sees "Free" on `/app/billing` | open | P0-11, P2-12 |
| B12 | Sitemap/robots on non-www | open | P0-12 + OPS-4/OPS-11 |
| B13 | No canonical/hreflang | open | P0-12, P4-8 |
| B14 | Alias 404s (`/planes`, `/privacidad`, `/terminos`, `/sign-up`) | open | P0-13, P2 (SCR-12), P6-1 |
| B15 | Billing history empty after MP payment | verify first | P2-5, P2-12 + OPS-1/OPS-4 |
| B16 | Admin revenue $10 vs $0 | already fixed (PR #17) | — (P5-3 keeps the money truth) |
| B17 | "$10 cobro de prueba" → 1000 tokens copy | verify first | P2-12 |
| B18 | Admin money manual figures / −18,094.6% margin | verify first | P5-3 |
| B19 | Admin nav overload | already fixed (PR #17) | — (P5 re-maps to BUILD-SPEC's 6 items) |
| B20 | Admin top bar 3 metrics / rail only on home | already fixed (PR #17) | — |
| B21 | Fake badges/counts | already fixed (PR #17) | — (P5-7 `ExampleTag` rule) |
| B22 | Dangerous team controls exposed | already fixed (PR #17) | — (P5-2 `ConfirmStep`) |
| B23 | Admin empty states; "+12% vs ayer" at $0 | verify first | P5-1, P5-3 |
| B24 | Admin settings read-only vs "settings that save" | open | P5-6 (BUILD-SPEC: the Mensual/Anual toggle and tool show/hide save; the rest read-only; Q31) |
| B25 | Dinero Pagos/Suscripciones/Costos split | verify first | P5-3 |
| B26 | EN admin settings chrome in Spanish | already fixed (dd205822f); logout remainder = B10 | — |
| B27 | non-www → www redirect | already live (Vercel domain 308); infra | — |
| B28 | Engine secrets must match engines | OPS only | OPS-5 |
| B29 | Existing users who see "Abrir" without provisioning | verify first | P0-2 + OPS-6 |
| B30 | Billing page jargon, Spanish-only | open | P2-12 |
| B31 | Landing claims conflict with new model (sin tarjeta, simulación, 7-day ChalyClip, no IVA) | open | P4-1 |
| B32 | Clips can't be generated on any plan (= BUILD-SPEC B3) | open (QA 2026-09-30) | P0-16 (+ `@smoke` deploy test), P3-2 |
| B33 | MP checkout fails "Una de las partes … es de prueba" (test/prod credential mix) | open, BLOCKER (QA 2026-10-02) | P0-17, OPS-19 |
| B34 | MP checkout shows $868.84 (= $749 × 1.16) instead of $749 | open (QA 2026-10-02) | P0-17, OPS-20 · **superseded 2026-10-03:** charge = displayed price from PRICING-CARDS-SPEC config (all-pending WS-1 / WS-2) |
| B35 | MP webhooks 0% delivered; non-www URL 308s | open (QA 2026-10-02) | P0-17, OPS-4 |

---

# 11. OPS (owner/infra actions; **never** claimed as fixed by a PR)

- **OPS-0 · Before P0:**
  - Copy the box folder `/workspace/chalyb-app-reimagine/` into the repo at `docs/design/app-reimagine/` (BUILD-SPEC, html/, mockups/, generators, `trial-to-paid-path.md`, `legal/`; **exclude** `.bak/`, `legal/.build/`, `legal-original-backup/`, `legal/chalyb-politicas-borrador.v0-backup.pdf`).
  - Copy `/workspace/chalyb/claude-prompt-chalyclip-free-trial.md` to `docs/specs/trial-billing-spec.md`.
  - Copy `/workspace/chalyb-qa/*.md` + `/workspace/chalyb-qa/admin-ux/*.png` to `docs/qa/` (**never** `test-accounts.json` or anything with credentials).
- **OPS-1 · MP webhook secret:** make `MERCADOPAGO_WEBHOOK_SECRET` on Vercel match the MP dashboard (the likely root cause of B15).
- **OPS-2 · Migrations:** apply 0039/0040 if they aren't applied yet. Then apply each phase's migration in order after its PR merges: P0 `tool_display_names` (+ unique constraint if added), P2 `trial_billing_consent`, P3 `tools_notifications` (if created). Confirm the app DB role has no UPDATE/DELETE on `consent_events`.
- **OPS-3 · MP plans (prod):** create `preapproval_plan`s `pro_year` ($7,490 MXN / 12 months, 1-month free trial), `pro_month` ($749 MXN / month, 1-month free trial) and `vip_month` ($2,499 MXN / month, no trial), all IVA-inclusive totals **after D1**. Put the ids in the env vars named in P2. Point subscription and payment webhooks at the existing route.
  > ⚠️ **SUPERSEDED 2026-10-03:** no `preapproval_plan`s are used (card-token preapprovals); amounts and the 1-month trial here are replaced by all-pending OPS-20 ("verify only") and the 7-day Pro trial.
- **OPS-4 · Canonical host:** `NEXT_PUBLIC_APP_URL=https://www.chalyb.com`; the MP notification URL is `https://www.chalyb.com/api/mp/webhook` (non-www 308s `/api/*`). Keep the Vercel non-www → www redirect. **Urgent (B35, 2026-10-02):** the MP dashboard Webhooks URL is still `https://chalyb.com/api/mp/webhook` in Producción, which is why deliveries are 0%. Change it to the www URL in **both** Modo productivo and Modo de prueba, keep the events (Pagos, Planes y suscripciones, Órdenes comerciales) checked, and copy the signature secret into `MERCADOPAGO_WEBHOOK_SECRET` (OPS-1).
- **OPS-5 · Engine secrets (B28):** verify `CHALYBCLIP_/CHALYBCRYPTO_/CHALYBOBS_` `ADMIN_TOKEN` and `SSO_SECRET` per engine, plus `engines.admin_api_base` / `external_url` in prod.
- **OPS-6 · Reconcile (B29):** after P0 deploys, run the admin reconcile for entitled users with an empty `external_user_id`.
- **OPS-7 · Cron:** set `CRON_SECRET`; confirm hourly Vercel crons are available on the plan in use.
- **OPS-8 · Analytics:** confirm Vercel Analytics custom events on the plan; name the provider in the Aviso de Privacidad (`[PROVEEDOR DE ANALÍTICA]`); decide its cookie class (Q14).
- **OPS-9 · E2E/CI:** set the `E2E_*` vars (§7.2) locally and as CI secrets, plus `E2E_SMOKE_VIDEO_URL`; provide a preview with MP sandbox; make `test:legal` and the `@smoke` Clips test required checks on deploy.
- **OPS-10 · Legal and launch:**
  1. Fill every bracket value in `legal/*.md` and `LEGAL_ENTITY_*`: razón social, RFC, domicilio, teléfono, correos, horario, días de gracia/cortesía, créditos, proveedores (hosting, correo, IA, analítica, PAC), plazo de conservación, persona responsable (Quebec), versión/fecha.
  2. Get a licensed Mexican attorney's signature on REVISION-LEGAL §5 items 1–11 (and US/Canada counsel for its list).
  3. Optional voluntary PROFECO adhesion-contract registration (art. 88; M10) and a check against NMX-COE-001-SCFI-2018 (M11).
  4. Set up immutable storage for legal versions and the daily consent-hash batch; optionally a NOM-151 provider (M9).
  5. Then `LEGAL_PUBLISH=true`, then (after OPS-17 and the D2 decision) `TRIAL_FLOW_ENABLED=true`.
- **OPS-11 · Search Console:** submit `https://www.chalyb.com/sitemap.xml`; check canonicals after P0/P4.
- **OPS-12 · Resend:** verify the sender domain, set `RESEND_WEBHOOK_SECRET`, and enable delivered/bounced webhooks to `/api/resend/webhook` (P2-6).
- **OPS-13 · Engine teams:** document in `docs/engines/*.md`:
  - Clips (job API or deep-link params, supported sources, privacy guarantee, upload, account linking);
  - Señales (plan-level signal feed that takes no user input, supported channels);
  - En vivo (OBS control API);
  - Asistente, Pronósticos, Inmuebles, Inversiones (APIs; for Inversiones, an exchange permission-check endpoint so withdrawal keys can be rejected).
- **OPS-14 · Mercado Pago:** confirm `free_trial` with 12-month frequency in MXN; preapproval amount/frequency updates (plan changes, VIP proration); **pausing or moving the next payment date** (bounce hold, P2-6; price-change non-renewal, P6-6); a stable payment-method id (one-trial guard); refund API access for admins.
- **OPS-15 · UI/UX:** approve the AA tokens (§5, Q28) and the logo/font (Q27). (Mockups 03/06/07 were regenerated at 21:34 with "6" and "Ver mi plan"; nothing left to redraw.)
- **OPS-16 · Supabase Auth:** set the password policy to 8 characters to match `signup.password.hint`.
- **OPS-17 · Accounting:** confirm whether $749 / $7,490 / $2,499 include IVA (D1), the operator's tax residence, the IVA rate for users abroad, and CFDI issuance (PAC). This blocks real charges.
- **OPS-18 · WhatsApp:** if WhatsApp notices/support are wanted, set up the business channel (needed for the bounce rule's alternate channel beyond in-app, Señales delivery and "Hablar con una persona").
- **OPS-19 · MP test setup (B33):** in MP Developers → Tu integración → Cuentas de prueba, create a **test seller** and a **test buyer**. Put the test seller's access token and public key on the Preview environment with `MP_ENV=test`, and the test buyer's email in `MP_TEST_PAYER_EMAIL`. Pay with the test buyer + an MP test card (cardholder name `APRO`) on a preview deploy. Then run "Medir la calidad de la integración" with that Order ID within 7 days.
- **OPS-20 · MP plan amounts (B34):** if the subscription uses a `preapproval_plan`, open each plan in MP and check its amount. A plan at $868.84 must be replaced by one at $749 (Pro mensual) / $7,490 (Pro anual), matching `PRICING` (plan amounts can't always be edited once subscribers exist; create new ones and update the env ids).
  > ⚠️ **SUPERSEDED 2026-10-03:** replaced by all-pending OPS-20 (verify that no plans exist; sandbox charge = $997 Pro mensual with `start_date` = now + 7 d).

---

# 12. OPEN QUESTIONS (owner/attorney decisions; each ships as a flag/config with the default shown; never hardcoded)

1. **Q1 · IVA (D1). `PRICES_INCLUDE_IVA`, default `true`.** The mockups and BUILD-SPEC say "IVA incluido", and an earlier QA note / the older trial prompt records the owner as having confirmed "IVA incluido". BUILD-SPEC §0.1/§11.7 and REVISION-LEGAL C3 still require the **accountant's** confirmation and call it a launch blocker. If false, the totals become $868.84 / $8,688.40 / $2,898.84 via config. **Blocks real charges.**
2. **Q2 · Quebec (D2). `QUEBEC_PAID_BLOCK`, default `true`.** Option A (translate documents and flow to French + the special clauses + Ley 25 duties) vs Option B (block paid plans for Quebec residents). Also: may Quebec users keep Gratis? *Default:* paid plans blocked; Gratis allowed only if legal approves. **Blocks selling in Quebec.**
3. **Q3 · Plan choice in the trial. `TRIAL_PLAN_CHOICE_ENABLED` (BUILD-SPEC `billingToggleEnabled`), default ON.** Off = only Pro anual offered; the billing block still states amount and period. The P5 Ajustes toggle overrides it.
4. **Q4 · Engine capabilities:** Clips sources ("YouTube, Twitch, Kick y Facebook"), whether "Tu video es privado" is guaranteed, uploads, account linking, job APIs, and the same for the other tools. *Default:* `TOOL_HUB_MODE_*=off` except Clips per P0.
5. **Q5 · Checkbox placement (D3). `TRIAL_CONSENT_ALSO_ON_PLAN_STEP`, default `false`.** `trial-to-paid-path.md` puts it on step 2; aceptacion-ux §3.3, mockups 14/15 and BUILD-SPEC put it on step 3. *Default:* step 3; also on step 2 if the attorney asks.
6. **Q6 · Button as acceptance without a checkbox (D4).** Only with the attorney's approval (aceptacion-ux §3.4). *Default:* checkbox required.
7. **Q7 · Pro scope. `PRO_INCLUDES_ALL_TOOLS`, default `true`.** Every mockup and BUILD-SPEC sell Pro as all tools; the code today gives Pro 1 live engine. What differentiates VIP besides credits and priority? **Blocks P2 launch.**
8. **Q8 · Legacy trial:** retire the 7-day Clips trial, the 50,000-token welcome gift and the token "grace" for new accounts? *Default:* stop for new accounts, honor active ones.
9. **Q9 · Plan-change terms:** terms §4.3/§4.4 (monthly→annual immediate with credit) vs BUILD-SPEC §6.10 (at the next charge date; VIP immediate with proration). *Default:* BUILD-SPEC; Law aligns the terms.
10. **Q10 · Day-29 reminder (D5). `TRIAL_DAY29_REMINDER_ENABLED`, default `false`.**
11. **Q11 · CFDI. `CFDI_ENABLED`, default `false`.** Mockups 07/30 and the FAQ promise CFDI; nothing issues it. *Default:* MP receipts only; CFDI rows and the FAQ hidden.
12. **Q12 · Grace:** `[DÍAS DE GRACIA]` and access during grace. *Default:* `PRICING.graceDays=7`, full plan during grace.
13. **Q13 · Credits and video limits (D8). `PRICING.credits`, `PRICING.maxVideoHours`, default `null` (hidden).** Mapping to tokens (code: Pro 1,000,000/month) and the reset day (code: the 1st).
14. **Q14 · Analytics consent:** is Vercel Analytics cookieless/necessary, or gated? *Default:* gated until consent.
15. **Q15 · Advanced options in Pro:** autopublish is VIP-only in `TIER_CAPS`; Planes sells "Opciones avanzadas para profesionales" in Pro. *Default:* the cap decides; "Incluido en VIP" on locked rows.
16. **Q16 · Support promise (D6). `SUPPORT_SLA_CONFIRMED`, default `false`; `SUPPORT_WHATSAPP_URL` unset.** *Default:* "Te respondemos lo antes posible, en español."; WhatsApp hidden.
17. **Q17 · "Acceso API" for customers.** *Default:* hidden.
18. **Q18 · "Tienes la idea" program (D7). `PARTNER_PROGRAM_TERMS_URL` unset.** *Default:* BUILD-SPEC copy without any % or amount, plus the form only.
19. **Q19 · Free includes Clips. `FREE_INCLUDES_CLIPS`, default `true`** (BUILD-SPEC §4 requires it). Free caps: watermark, SD, 7-day retention; the owner confirms COGS.
20. **Q20 · "Las 7 herramientas" while 4 engines aren't active** (art. 32 LFPC misleading-advertising risk). *Default:* every list and count is derived from active tools; hidden tools appear nowhere.
21. **Q21 · Señales labels (D10):** "Confianza alta/media" and "Buen momento para comprar/vender" as general, same-for-everyone labels; the attorney confirms the C1 analysis (LMV art. 225) and what changes if securities are covered. *Default:* keep them, uniform.
22. **Q22 · Responsible-gambling line (D11).** *Default:* no link until an official resource is verified.
23. **Q23 · Prize promotions / plan giveaways (D12).** *Default:* prohibited.
24. **Q24 · Bounce hold when MP can't pause or move a charge:** the fallback procedure (refund per terms §7.3). *Default:* admin attention item + manual refund.
25. **Q25 · Security line (REVISION-LEGAL M7):** add "Conexión cifrada; tus datos de tarjeta los tokeniza Mercado Pago" under the Brick? *Default:* BUILD-SPEC's `pay.secure` only.
26. **Q26 · Trial length:** 30 days (`PRICING.trial.days`) vs MP's "1 month". *Default:* whatever MP actually applies, shown exactly.
27. **Q27 · Brand:** the mockups' "C" mark + system/Inter vs the shipped emblem + Familjen Grotesk. *Default:* shipped emblem + mockup layout + Inter.
28. **Q28 · AA tokens:** `#6C6C74` (ink3 text) and `#167A3E` (green text/buttons). *Default:* use them.
29. **Q29 · EN legal docs:** Spanish with a "Spanish prevails" note, or translations? *Default:* Spanish + note.
30. **Q30 · Admin items outside BUILD-SPEC's 6** (Royalties, AI Models, Labs): placement. *Default:* as on main, reachable via "Más".
31. **Q31 · Admin settings scope (B24):** BUILD-SPEC makes only the Mensual/Anual toggle and the tool show/hide switch save. Should anything else save? *Default:* the rest stays read-only.
32. **Q32 · `chalybstream`:** customer name, or keep it hidden? *Default:* hidden.
33. **Q33 · Attorney sign-off list (REVISION-LEGAL §5):** the liability structure for consumers vs businesses (A1), price increases with express acceptance, courts/governing law, the privacy merger clause and art. 35 wording, the AI-likeness and safe-harbor implementation, antilavado for Inmuebles (M13), and voluntary PROFECO registration. *Default:* code implements the Law-revised texts; publishing waits (OPS-10).
34. **Q34 · Retiring an active tool (REVISION-LEGAL M5):** notice period (30 days "when possible") and alternative or refund. *Default:* admin `ConfirmStep` warning; the notice is sent manually.
35. **Q35 · Repeat-infringer threshold** (uso-aceptable §5.4 placeholder). *Default:* the counter is stored; no automatic termination until Law sets the number.
