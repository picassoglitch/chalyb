# Chalyb · PRICING-CARDS-SPEC: plan cards redesigned for conversion (es + en)

> **Target:** the REBUILD stack, branch `claude/rebuild-p5-admin` @ `c163dfd` (worktree `.wt-p5`). Nothing on `main` changes.
> **Surfaces:** landing `#planes` (`src/components/landing/plans-summary.tsx`) and `/planes` + `/app/planes` (`src/components/app/billing/plans-view.tsx`, data in `plans-page.tsx`, CTA targets in `src/lib/billing/plans-cta.ts`).
> **⚖ LAW REVIEW APPLIED (Oct 3, 09:10): read §16 first.** Source: `legal/PRICING-2026-10-03-REVISION.md` + `legal/aceptacion-ux.md` §3–§4.1 + `legal/terminos-de-suscripcion.md`. §16 supersedes **§14 entirely** (3-day trial is dead) and every trial / badge / reference-price / tax-footer statement in §0–§13. Mockups 80–85 + 84b, Pro Lealtad 86–88 and the new **89** are re-rendered to §16.
> **Mockups (new):** `mockups/80-…85-*.png` + `84b`, built by `build_pricing.py` (HTML in `html/80-…85-*.html`, reuses `html/style.css`) and captured by `render_pricing.py` (Playwright, 2×, Inter). No existing mockup or script was changed.
> **Rule order:** BUILD-SPEC §11 / `legal/REVISION-LEGAL.md` (Law) **wins** over Marketing. Every string marked **⚖** is trial or charge wording and counts as consent-adjacent evidence: **PENDIENTE REVISIÓN LEGAL + bump UI_VERSION** (`src/lib/billing/consent.ts:11`, today `'rebuild-p2'`).
> **Amounts (FINAL, owner Oct 3 08:41):** customer prices, IVA included: Gratis $0 · Pro **$997/mes** (struck reference **$1,662**, "40% de descuento") · Pro anual **$9,970/año** (promo applied, owner 08:51; trial hero flow) · VIP **$3,799/mes** · VIP anual **$36,325/año**. USD: Pro $50/mo (struck **$84**, "40% off") · $500/yr · VIP $200/mo · $2,000/yr. ~~Trial 3 days, no pre-charge reminders~~ → **Trial (Law, 09:10): 7 days, Pro mensual + Pro anual, never VIP / VIP anual / Pro Lealtad; ONE charge notice on day 0 (§16).** In code, amounts are `{monto}` / `{ahorro}` / `{pct}` placeholders from config. See **§0** (decisions + exact numbers), **§13** (price code impact), **§14** (trial).

---

## 0. FINAL (Oct 3, 08:41–08:49). Read this first: it supersedes every amount and every trial rule in §2–§12

§2–§12 still describe the *logic* (layout, gating, keys, tests) using the old P5 renders ($868.84 / $8,688.40 / 30-day trial on Pro anual only) as examples. **Wherever they disagree with §0, §13 or §14, §0/§13/§14 win.**

### 0.1 Owner decisions still open (blocking)

**#1 · Pro anual is not a better deal than Pro mensual, while VIP anual is.**
**Update 08:51: the owner set Pro anual = $9,970 (promo applied).** That gives Pro anual a real saving: 12 × $997 = $11,964 → saves **$1,994 (16.67% → "16%")**, so the accent pill is back on the card. **But VIP anual still saves more: $45,588 − $36,325 = $9,263 (20.3% → "20%").** "Pro anual must stay clearly the best deal" is still not true in % terms. The "Mejor oferta" badge (kept, owner) sits on a 16% plan next to a 20% VIP, and the toggle pill "Ahorra hasta 20%" is VIP's number. `proIsBestDeal` (§12.2) would drop the badge, and `pricing-ladder.test.ts` fails. The badge shows only because the owner kept it, and it needs Law's OK (L3). *(Before 08:51, Pro anual was $11,964 = exactly 12 × $997, a $0 saving.)*

| Option (MXN, IVA incl.) | Pro anual | Saves vs 12 × $997 | % shown (floor) | Pro beats VIP's 20%? |
|---|---|---|---|---|
| Before 08:51 | $11,964 | $0 | – (no line) | ❌ |
| **Now (owner 08:51)** | **$9,970** | **$1,994** | **16%** | ❌ VIP 20% |
| …or keep Pro at $9,970 and lower VIP | $9,970 | $1,994 | 16% | ✅ if VIP anual ≥ $38,294 (VIP shows ≤ 15%), e.g. 11× = $41,789 (8%) |
| Tie with VIP | $9,571 | $2,393 | 20% | ❌ tie, badge still not substantiated |
| Smallest that wins | $9,451 | $2,513 | 21% | ✅ |
| 25% off (= 9×) | $8,973 | $2,991 | 25% | ✅ |
| 30% off | **$8,374** | $3,590 | 30% | ✅ ($8,376 floors to **29%**) |

USD has the same issue in a milder form: Pro $500 vs $600 and VIP $2,000 vs $2,400 both save **16.67% → "16%"**, a tie, so "Best value" isn't backed by the %. Fixes: Pro yearly $480 (20%), or VIP yearly $2,160 (10%).
**Open sub-question (D20):** is $9,970 a **promo for the first year only** ("promo applied") or the **standing** Pro anual price? The cards say "Se renueva cada año" under $9,970, which is only true if renewals are also $9,970. If renewals go back to $11,964, the card, checkout and terms must say so (e.g. "$9,970 el primer año, después $11,964 al año"), and `PRICES` needs a promo field. Rendered assuming $9,970 renews.

**#2 · ✅ Resolved (owner, Oct 3 08:55): reference price $1,662 / $84, "40%".** The struck reference is now **$1,662** (MXN) → (1,662 − 997) / 1,662 = **40.01% → "40% de descuento"**, and **$84** (USD) → (84 − 50) / 84 = **40.48% → "40% off"**. $83 was not used: 39.76% floors to 39%, and showing "40%" would overstate the discount. Percentages are still computed (`discount()` / `discountPct()`), never typed by hand. **$1,395 remains the real former price** (owner, 08:46), so $1,662 and $84 need Law's OK (**L8**).
*(History: with $1,395 the discount was 28.53% → "28%"; 40% off $1,395 would be $837.)*

### 0.2 Exact numbers shown in the mockups (IVA included, whole pesos)
| | Gratis | Pro mensual | Pro anual | VIP mensual | VIP anual |
|---|---|---|---|---|---|
| Big number | $0 | **$997** MXN al mes | **$9,970** MXN al año | **$3,799** MXN al mes | **$36,325** MXN al año |
| Under it | Sin tarjeta · Para siempre | Se renueva cada mes · ~~$1,662~~ **40% de descuento** | Se renueva cada año · "o $997 MXN al mes en plan mensual" · accent pill **"Ahorras $1,994 al año · 16%"** | Se renueva cada mes · grey link "Cambia a Anual y ahorra $9,263 al año" | Se renueva cada año · "o $3,799 MXN al mes en plan mensual" · grey "Ahorras $9,263 al año · 20%" |
| 12 × monthly | – | – | $11,964 (saves $1,994) | – | $45,588 (saves $9,263) |
| Trial charge on day 3 | – | $997 MXN | **$9,970 MXN por el año completo** | – | – |
| Trial | – | **3 días gratis** | **3 días gratis** | none | none |

Toggle pill: **"Ahorra hasta 20%"** (VIP's %, the max over plans offered annually with savings > 0; hidden if none). Badge: "Mejor oferta" in Anual, "Recomendado" in Mensual / flow off.
USD (84, Yearly, **final prices, no longer an example**): Pro **$500 USD / year**, "or $50 USD/mo on the monthly plan", accent "Save $100 a year · 16%"; VIP **$2,000 USD / year**, "or $200 USD/mo…", grey "Save $400 a year · 16%"; pill "Save up to 16%". Pro monthly: ~~$84~~ "40% off" (only in Monthly mode; 84 is Yearly, so it doesn't appear there).
**Percent rounding:** floor (D14). The brief's "~17%" is 16.67%, shown as **16%**; "17%" would overstate it. One switch (`PCT_ROUNDING`) if Law and the owner prefer rounding.

### 0.3 Reference price (owner, 08:55)
Shown: ~~$1,662~~ "40% de descuento" (MXN) and ~~$84~~ "40% off" (USD). The real former price was **$1,395** (owner, 08:46), so the higher reference needs Law's sign-off (L8). Code/test impact in §13.4.

---

## 1. Mockups

> **Current (Law-applied, Oct 3 09:16).** Rows below this box are the 08:50 history; the live content of every PNG is:
>
> | File | What changed for Law |
> |---|---|
> | `80-precios-anual.png` | Badge **"Más popular"**, chip "7 días gratis", CTA **"Empezar mis 7 días gratis"**, note "**Hoy pagas $0.** El 10 de octubre se cobran $9,970 MXN por el año completo y se renueva cada año, automáticamente. Cancela cuando quieras.", ref line "o paga mes a mes: $997 MXN al mes (plan mensual)" (VIP: $3,799). Toggle still defaults to Anual (allowed, §16.2) |
> | `81-precios-mensual.png` | `SHOW_REFERENCE_PRICE=True`: ~~$1,662~~ + "Precio anterior en **[sitio]** hasta el **[fecha]**. Aquí pagas 40% menos. Precio de lanzamiento vigente hasta el **[fecha]**." (yellow = owner placeholders). Note "…El 10 de octubre se cobran $997 MXN y después cada mes, automáticamente…". No bare "40%" pill |
> | `82-precios-prueba-usada.png` | Trial used: no trial wording; "Más popular" |
> | `83-precios-movil.png` | 80 at 390 px |
> | `84-precios-en.png` | USD, US: "Most popular", "7 days free", "Start my 7-day free trial", "$0 today. On October 10 you'll be charged US$500 for the full year, plus any sales tax, and it renews every year until you cancel." Footer: "Prices in US dollars. Sales tax, if any, is added at checkout and shown before you pay." No struck US$84 |
> | `84b-precios-en-ca.png` (NEW) | Canada: same, with "plus applicable GST/HST (and QST in Quebec)" and footer "Prices in US dollars (USD). GST/HST and, in Quebec, QST are added where applicable and shown before you pay." |
> | `85-precios-sin-prueba.png` | `SHOW_REFERENCE_PRICE=False` fallback: "Precio de lanzamiento: $997 MXN al mes" |
> | `86/87/88-*reducto*.png` | **Law-reviewed (§R, 09:17), see §15.12.** No pending mark. Bars "10% menos" … "60% menos" + legend "% = menos que el mes 1", nothing under bar 1; rounding line; months 1–4 sentence; Law's reset box, unchecked checkbox and disabled "Pagar $1,662 y empezar Pro Lealtad"; 87 banner "El 8 de octubre de 2026 se cobran $997 MXN de tu Pro Lealtad (mes 5), 40% menos que tu mes 1…" |
> | `89-aviso-nuevo-precio.png` (NEW) | In-app modal, Pro $749 → $997 (+33%), sent 3 oct 2026 = exactly 30 days before 2 nov 2026; Law §4.1 copy; [Acepto el nuevo precio] · [No, gracias] · [Cancelar mi plan]; reminder 26 oct. Renders owner option (a) |
>
> Build: `python3 build_pricing.py && python3 render_pricing.py` · `python3 build_reducto.py && python3 build_aviso.py && python3 render_reducto.py` (render_reducto also captures 89).

| File | State | What it shows (08:50 history) |
|---|---|---|
| `mockups/80-precios-anual.png` | Desktop 1440 · Anual · trial available (**hero flow**) | Pill "Ahorra hasta 20%". Pro: "Mejor oferta", chip "3 días gratis", **$9,970 MXN al año**, "Se renueva cada año", "o $997 MXN al mes en plan mensual", accent "Ahorras $1,994 al año · 16%", CTA "Prueba Pro gratis 3 días", "**Hoy pagas $0.** El 6 de octubre se cobran $9,970 MXN por el año completo, automáticamente. Cancela cuando quieras." VIP: **$36,325 MXN al año**, "o $3,799 MXN al mes…", grey "Ahorras $9,263 al año · 20%", "Elegir VIP anual" |
| `mockups/81-precios-mensual.png` | Desktop · Mensual · trial available | Pro: "Recomendado", chip "3 días gratis", **$997 MXN al mes**, ~~$1,662~~ + "40% de descuento", CTA "Prueba Pro gratis 3 días", note "**Hoy pagas $0.** El 6 de octubre se cobran $997 MXN automáticamente. Cancela cuando quieras.". VIP **$3,799 MXN al mes** + grey link "Cambia a Anual y ahorra $9,263 al año", "Elegir VIP mensual" |
| `mockups/82-precios-prueba-usada.png` | Desktop · Anual · signed in on Gratis, trial used | No chip / footnote / trial wording. Pro $9,970 + "Ahorras $1,994 al año · 16%", "Elegir Pro anual", "Se cobra hoy…". Gratis: "Tu plan" + disabled "Tu plan actual" |
| `mockups/83-precios-movil.png` | Mobile 390 · Anual · trial available | Same as 80, stacked with Pro first; prices on one line at 390 px |
| `mockups/84-precios-en.png` | English / USD, Yearly, trial available, **final prices** | Pill "Save up to 16%". Pro "Best value", "3 days free", **$500 USD / year**, "or $50 USD/mo…", "Save $100 a year · 16%", "Try Pro free for 3 days", "$0 today. On October 6 you'll be charged $500 automatically. Cancel anytime." VIP **$2,000 USD / year**, "Save $400 a year · 16%" |
| `mockups/85-precios-sin-prueba.png` | `TRIAL_FLOW_ENABLED` off | No toggle, monthly only. Pro $997 + ~~$1,662~~ 40% de descuento, "Elegir Pro mensual"; VIP $3,799, "Elegir VIP"; no trial wording |

> **Status, Oct 3 08:50: all six PNGs are re-rendered with the final prices and the 3-day trial.** `build_pricing.py` reads every amount from one table of IVA-included totals (`PRICES`, `REF`, `USD`, `USD_REF`, `TRIAL_DAYS`). Savings lines show only when savings > 0; discount % is computed. Layout check on every shot: equal card heights, aligned rows, prices on one line, nothing spilling.

Re-render: `python3 build_pricing.py && python3 render_pricing.py [80 81 …]`. The render script prints, for each shot: card heights (must be equal on desktop), CTA and list y-positions (must be equal), price line height (one line), and any element spilling past its card or the viewport. All six shots pass.

---

## 2. What changed and why (Marketing ⟷ Law resolution)
> ⚠ Amounts and trial rules in §2–§12 are the pre-Oct-3 examples. §0, §13 and §14 win.

| # | Topic | Marketing asked | Law requires | **Resolution** |
|---|---|---|---|---|
| 1 | Headline | Drop "Un plan con todo incluido" (3 tiers contradict it) | – | Replaced. Options: **A "Empieza gratis, crece con Pro"** (in mockups) · B "Empieza gratis. Sube a Pro cuando lo necesites." · C "Elige cuánto quieres que trabajen por ti". `/planes` h1 "Un plan. Todas las herramientas." goes too: it is both a tier contradiction and a tool claim (row 6). |
| 2 | Big number, Anual | (Owner 2026-10-02: lead with monthly so Pro doesn't look pricier than VIP) | The real charge and its frequency are the big number (art. 7 Bis / 76 Bis LFPC; §11.1) | **Law.** Anual: **"$8,688.40 MXN al año"** big, then "Se renueva cada año". The units "al año" / "al mes" and VIP's "Solo plan mensual" carry the comparison. The owner's concern goes to D2 (default toggle). |
| 3 | Secondary value line | One number only | "Equivale" is allowed only small and secondary. "vs. $10,426.08" only in that exact form | **One line: "Ahorras $1,737 al año vs. mensual".** "(equivale a $724 al mes)" and "vs. $10,426.08 pagando mes a mes" come **off the cards**. Why: (a) $724 is a price-shaped per-month number next to a yearly charge, which is exactly the pattern §11.1 restricts, and it can't appear near a payment block anyway; (b) $724 is rounded *down* 3 centavos ($724.03), so it slightly understates the cost; the savings figure is floored, so it can only understate the benefit, which is the safe direction; (c) savings is the motivating number and Marketing gets a single figure; (d) it removes the `$10,426.08` string from the cards, so the banned-phrase test has less to police. Keys stay in the file for other surfaces (§5.4). |
| 4 | Monthly price | "MXN al mes" on the price line | "$868.84 MXN al mes · se renueva cada mes" | Big "$868.84" + "MXN al mes" on **one line** (`nowrap`). "Se renueva cada mes" sits directly under it in the same price block, the same pattern as Anual. `billing.price.monthLine` (one line) stays for compact contexts. |
| 5 | Free month | Prominent chip | It must be clear, honored and conditional. It is a 30-day trial, Pro anual only, once per account and card | Chip **"1 mes gratis con Pro anual"** shows only when `trialOffered && interval==='year'`. Disclosure under the CTA ("Hoy pagas $0. Al terminar tus 30 días se cobran $8,688.40 MXN al año, salvo que canceles. Te avisamos 7 días antes."). Footnote: "Mes gratis: prueba de 30 días, solo con Pro anual, una vez por cuenta y por tarjeta." All ⚖. |
| 6 | Tool access | Don't claim a tool count (code contradicts itself) | Terms say "UN Engine" while flags say all tools | **Omitted.** Removed `plans.pro.tag` "Todas las herramientas", `plans.pro.f1` "Las {n} herramientas…", Gratis "✕ Señales, En vivo y las demás herramientas", and the landing tagline. See D7. |
| 7 | Bullets | 3–5 outcome bullets, real limits only | – | 4 / 5 / 4 bullets built from `TIER_CAPS` (history 7/90/365, storage 500 MB/5 GB/50 GB, Clips SD/HD/4K, watermark only on Gratis, 0/12/unlimited live streams to clip). No credits or jobs. |
| 8 | VIP | "Para quién es" + "Todo lo de Pro, más…" | – | Tag "Para quien transmite a diario o maneja varios canales". List header "Todo lo de Pro, más:". |
| 9 | Toggle | Mensual/Anual above the cards | The pill can't make an unconditional trial claim (today `plans.toggle.save` = "1 mes gratis" with no check, `plans-view.tsx:86`) | Toggle centered above the cards. Pill **"Ahorras $1,737"**, which is true in every state. The trial claim lives only on the Pro card. |
| 10 | "2 meses gratis" | Never | Banned (test) | Not used anywhere. No bare $8,988 / $10,426.08 either. The en copy also avoids "two months free". |
| 11 | Flag off | – | No claim the flow can't honor | `TRIAL_FLOW_ENABLED` off → no chip, no footnote, no trial CTA, **and no Anual**: without the flow the only working checkout is the legacy monthly `/app/subscription`, so an annual price on the card would not match the charge. (85) |
| 12 | Layout | Price unit on one line, no clipped cards, equal heights, Pro emphasized | Charge text ≥ 14 px (we use 15.5–18.5) | One 3-column CSS grid with **`subgrid` rows** (equal heights; price, CTA and list rows aligned across cards). **Equal column widths.** Pro is emphasized by the 3 px accent ring, white background, large shadow, "Recomendado" badge and the only primary button. Price font scales with the card (container query) and never wraps. Stacked below 1024 px with Pro first. |

---

## 3. Layout spec (shared by both surfaces)

- **Grid:** `.ch-pc-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(6,auto); column-gap:24px; row-gap:0 }`.
  **Card:** `.ch-pc { grid-row:span 6; display:grid; grid-template-rows:subgrid; row-gap:0; min-width:0; border-radius:28px; padding:34px 28px 32px; background:var(--bg) }`.
  Every card renders **exactly 6 direct children, in this order**, even when a slot is empty (`<div/>`):
  1. `hd`: name (26/700), "para quién" (17.5, ink2), optional trial chip (Pro)
  2. `pb`: price line + renewal line
  3. `vl`: the single value line (savings pill, "Cambia a Anual…" link, VIP "Solo plan mensual", or empty)
  4. `ct`: CTA (60 px, full width)
  5. `bn`: note under the CTA (15.5 px, centered)
  6. `ft`: divider, list header ("Incluye:" / "Todo lo de Pro, más:") and bullets
  Fallback: `@supports not (grid-template-rows: subgrid)` gives `.ch-pc{display:flex;flex-direction:column}` with `min-height` on `hd`/`pb`/`vl`.
- **Pro emphasis:** `.ch-pc--pro { background:#fff; box-shadow:0 0 0 3px var(--accent), var(--shadow-lg) }`, badge centered on the top border (`top:-17px`). **No** negative margins or wider column. Today's `1fr 1.12fr 1fr` + `align-items:center` (`chalyb-public.css` ≥900px block) is what produced the uneven heights and the squeezed side cards in the current screenshot.
- **Current plan:** the badge becomes **"Tu plan"** (`--ink` background) on the user's card, and its button is `ch-btn--gray` with `aria-disabled="true"`, "Tu plan actual". On Pro, "Tu plan" replaces "Recomendado".
- **Price line:** `.ch-pc__pb { container-type:inline-size }`; `.ch-pc__pr { display:flex; align-items:baseline; gap:8px; white-space:nowrap }`; amount `font-size:clamp(34px,13.4cqi,46px); font-weight:750; letter-spacing:-.045em`; unit `clamp(15px,5.4cqi,18.5px); 600; ink2`. This fits "$8,688.40 MXN al año" and "$2,898.84 MXN al mes" on one line from a 258 px content box (1024 px viewport) up to desktop. The rule exists so it can never wrap again.
- **Breakpoints:** ≥ 1024 px: 3 columns. < 1024 px: one column, gap 30, Pro first (`order:-1` on `.ch-pc--pro`; DOM order stays Gratis · Pro · VIP). Toggle is full width on mobile.
- **Toggle:** `role="radiogroup"`, two `role="radio"` buttons, 54 px, pill on the Anual option. When it changes, the Pro price block is announced (`aria-live="polite"` on `pb`). Fire the existing `landing_pricing_toggle` event.
- **Colors:** the savings pill uses the **accent tint** (`Pill kind="acc"`), never green (BUILD-SPEC §1.1: green is not for prices). Today `plans-view.tsx:86` and `trial-picker.tsx:65` use `kind="ok"`, so change both.
- **Below the cards:** `billing.price.tax` "Precios en MXN, IVA incluido." · trial footnote (only when `trialOffered`) · link `landing.plans.seeAll` (landing only).
- **CSS home:** new `.ch-pc*` rules in `src/styles/chalyb-tokens.css` (both surfaces load it). Then delete `.pub-pl*` / `.pub-plans` (`chalyb-public.css:454-550, 993-1004`) and `.ch-plans` / `.ch-plancard*` (`chalyb-tokens.css:1561-1612`) once nothing references them.

---

## 4. State logic

### 4.1 Inputs (all already computed in `plans-page.tsx` / `plans-cta.ts`)
`flow = trialFlowEnabled()` · `monthlyOffered = billingToggleEnabled()` · `signedIn` · `isAdmin` · `billing.primary.state` / `planKey` · `trialUsed = billing.trialUsed` (`profiles.pro_trial_started_at`) · `quebecBlocked` · `freeIncludesClips()`.

### 4.2 Derived (new: compute once on the server in a `loadPlansProps()` helper used by **both** `PlansSection` and the landing)
```ts
const annualOffered = flow;                        // Pro anual is only sold through the new flow
const intervals = flow ? (monthlyOffered ? ['month','year'] : ['year']) : ['month'];
const defaultInterval = intervals.includes(PRICING.defaultInterval) ? PRICING.defaultInterval : intervals[0];
const proBusy = isAdmin || state === 'trialing' || (paid && !onVip);   // current / trialing
const trialOffered = flow && !trialUsed && !proBusy && !quebecBlocked;
// client, per toggle:
const showTrial = trialOffered && interval === 'year';
```
Anonymous visitors: `trialUsed` is unknown, so it counts as `false`. The one-trial-per-card check happens at payment (`start-subscription.ts:136-143` → `CARD_TRIAL_USED`); see bug B8.

### 4.3 `plansCta()`: new return shape
```ts
pro: { hrefYear: Route | null; hrefMonth: Route | null; label: 'trial' | 'paid' | 'current' | 'trialing' }
```
| Who | `hrefYear` | `hrefMonth` |
|---|---|---|
| Anonymous, flow on | `/sign-in?mode=signup&intent=trial&interval=year` | `/sign-in?mode=signup&plan=pro&interval=month` |
| Signed in, flow on, trial offered | `/app/prueba` (picker, Anual preselected) | `/app/prueba/pago?plan=pro_month` |
| Signed in, flow on, trial used | `/app/prueba/pago?plan=pro_year` (paid consent path, already supported in `pago/page.tsx`) | `/app/prueba/pago?plan=pro_month` |
| Flow off (anyone) | `null` (Anual hidden) | anon `/sign-in?mode=signup&plan=pro` · signed in `/app/subscription` |
| Quebec blocked | `null` | `null` |
The `label: 'return'` ("Volver a Pro") and `'noTrial'` ("Elegir Pro") states go away. Their replacement is `'paid'`, which renders `ctaYear` / `ctaMonth`. This also replaces the client-side `proHref` rewrite at `plans-view.tsx:54`. Check that `/sign-in` keeps `interval` through to `/app/prueba` (LANDING-SPEC §5 already specifies it). If it doesn't, add it.

### 4.4 Pro card truth table
| State | Toggle | Chip | Big price | Value line (`vl`) | CTA | Note under CTA (`bn`) | Footnote |
|---|---|---|---|---|---|---|---|
| (a) trial available | Anual | ✅ `plans.trialChip` ⚖ | `$8,688.40` `MXN al año` · Se renueva cada año | `plans.pro.save` | `plans.pro.cta` "Empieza tu mes gratis" ⚖ → `hrefYear` | `plans.pro.note` ⚖ | ✅ ⚖ |
| (d) trial available | Mensual | ❌ | `$868.84` `MXN al mes` · Se renueva cada mes | `plans.pro.switchYear` (switches the toggle) | `plans.pro.ctaMonth` "Elegir Pro mensual" → `hrefMonth` | `plans.pro.monthNoTrial` ⚖ | ✅ |
| (b) trial used | Anual | ❌ | annual | `plans.pro.save` | `plans.pro.ctaYear` "Elegir Pro anual" → `hrefYear` | `plans.pro.notePaid` ⚖ | ❌ |
| (b) trial used | Mensual | ❌ | monthly | `plans.pro.switchYear` | `ctaMonth` | `notePaid` | ❌ |
| (c) flow off | *(hidden; Mensual only)* | ❌ | monthly | – | `ctaMonth` → `hrefMonth` | `notePaid` | ❌ |
| Pro (paid / past_due / cancelled_active) | as chosen | ❌ | as chosen | as chosen | **"Tu plan actual"** (disabled) + badge "Tu plan" | – | ❌ |
| Trialing | as chosen | ❌ | as chosen | as chosen | "Ya estás probando Pro" (disabled) | – | ❌ |
| Admin | as chosen | ❌ | | | "Tu plan actual" (disabled) | – | ❌ |
| Quebec | as chosen | ❌ | | | disabled + `plans.quebec` banner | – | ❌ |
Header subtitle: `plans.sub` ⚖ only when `trialOffered`, otherwise `plans.subNoTrial`.
Gratis: signed-in free user → badge "Tu plan" + "Tu plan actual". VIP: `vip.cta` / `vip.ctaUp` (from paid Pro) / current.
The same rules apply to **every other trial claim** outside the cards (§5.5).

---

## 5. Component-by-component changes

### 5.1 New `src/components/app/billing/plan-cards.tsx` (client)
Extract the cards **and** the toggle from `plans-view.tsx` into one component used by both surfaces, so the landing and `/planes` can't drift again. Today they are two components, two key namespaces and two CSS systems.
```ts
interface PlanCardsProps {
  cta: PlansCta;                       // §4.3
  trialOffered: boolean;
  intervals: ('month' | 'year')[];
  defaultInterval: 'month' | 'year';
  features: Record<'gratis' | 'pro' | 'vip', PlanFeature[]>;  // §5.6, built on the server
  current: 'gratis' | 'pro' | 'vip' | null;
  headingLevel: 2 | 3;                 // landing h3, /planes h2
}
```
- Prices: `planPrice('pro_year' | 'pro_month' | 'vip_month').totalCents` → `formatMXN`. Savings: **`formatMXNFloor(annualMath().yearSavingsCents)`** (new helper in `lib/billing/format.ts`: `formatMXN(Math.floor(c / 100) * 100)`). Use it on the toggle pill, `plans.pro.save` and `plans.pro.switchYear` so the landing and /planes show the same "$1,737".
- `plans.pro.note` placeholders: `monto = formatMXN(planPrice('pro_year').totalCents)`, `dias_prueba = PRICING.trial.days`, `dias_aviso = PRICING.trial.reminderDaysBefore` (this removes another hand-typed "7").
- Render with `t.rich` for `<b>`.
- `data-cta` on the Pro button: `pro_year_trial` | `pro_year` | `pro_month` (analytics).

### 5.2 `plans-view.tsx`
- Keep: page header (h1 + sub), the Quebec notice, the FAQ.
- Replace lines 74–150 (toggle + three cards) with `<PlanCards … headingLevel={2} />`.
- Header: `plans.title` (new text) · `trialOffered ? plans.sub : plans.subNoTrial` (already conditional, good).
- Delete: the `Intl.ListFormat` tool list (:44) and the `tools` prop (no tool claim on cards); `proYearEq` + `vsMonth` lines (:121-126); `monthAlt` (:131); the unconditional `toggle.save` "1 mes gratis" (:86).
- FAQ: show `faq.q1/a1` ("¿Cómo funciona el mes gratis?") **only when `trialOffered`**. Feed `a1` with `{dias_aviso}` instead of the hand-typed "7" (⚖ string).

### 5.3 `plans-page.tsx` → `loadPlansProps()`
- Move the existing body (user, billing, flow, `plansCta`) into `export async function loadPlansProps(): Promise<PlanCardsProps & {…}>`, add the derived fields from §4.2 and `features` (§5.6), and drop the engines query (only used for the tool list).
- `PlansSection` = `<PlansView {...await loadPlansProps()} />`.

### 5.4 `landing/plans-summary.tsx`
- Becomes a thin server wrapper: `SectionHead` (label `landing.plans.label`, title `plans.title`, sub `trialOffered ? plans.sub : plans.subNoTrial`) + `<PlanCards {...props} headingLevel={3} />` + tax line + trial footnote + `landing.plans.seeAll` link.
- Props come from `loadPlansProps()` (the landing page is already dynamic: it calls `getCurrentUser()`). `LandingPage` passes them down. `trialHref` is no longer needed here.
- Remove: the deal box (`dealTitle` / `dealEq` / `dealTotal`, :62-75), the `Gift` import, `proMonthNote`, `perMonth`. Pro no longer leads with the monthly price while the toggle is on Anual (§2 row 2).
- Keep `<span id="pricing">` and `data-testid="plans-summary"`.

### 5.5 Same claim outside the cards (bug B1/B6, needs the same gating)
| Key / place | Today | Rule |
|---|---|---|
| `landing.cta` (hero + final CTA), `landing.sticky` | "Prueba Pro gratis 1 mes" always | `trialOffered` → keep ⚖. Flow off → **new `landing.ctaNoTrial`** "Empieza gratis" / "Start free". Signed in → **new `landing.ctaSignedIn`** "Ver planes" / "See plans" |
| `landing.publicNav.cta` | "Prueba Pro gratis" always | same; **new `landing.publicNav.ctaNoTrial`** "Empieza gratis" / "Start free" |
| `meta.description` | "…Prueba Pro gratis 1 mes con el plan anual…" always | **new `meta.descriptionNoTrial`** without the claim when flow is off |
| `landing.faq.q1/a1` | trial Q&A always | render only when flow on |
| `home.included.gratis`, `home.included.cta.trial`, `tools.strip`, `tool.offer.trialCta`, `launch.trialCta`, `checkout.tool` | trial claims | check each caller gates on `trialFlowEnabled() && !trialUsed`. Not verified in this pass |
Code: `hero.tsx`, `final-cta.tsx`, `sticky-cta.tsx`, `public-nav.tsx` pick the label from `{flow, signedIn}`. `trialCtaHref()` already branches on the flag; only the **labels** are wrong today.

### 5.6 Features from `TIER_CAPS` (new pure `src/lib/billing/plan-features.ts`)
```ts
planFeatures('FREE' | 'PRO' | 'VIP', { freeIncludesClips }): PlanFeature[]  // { key, values?, included }
```
| Bullet | Source | Gratis | Pro | VIP |
|---|---|---|---|---|
| Clips quality / watermark | `clipExportMaxQuality`, `clipWatermark` | `feat.clipsTry` (only if `freeIncludesClips()`) | `feat.noWatermarkHd` | `feat.clips4k` |
| Live streams to clip | `clipStreamsPerMonth` | `feat.noStreams` (✕) | `feat.streams` {n}=12 | `feat.streamsUnlimited` (Infinity) |
| History | `historyDays` | `feat.history` {dias}=7 | `feat.history` {dias}=90 | `feat.historyYear` (365) |
| Storage | `storageMB` → `500 MB` / `5 GB` / `50 GB` (≥1000 → GB, decimal like the caps) | `feat.storage` | `feat.storage` | `feat.storage` |
| Cancel | – | – | `feat.cancel` | (inherited via "Todo lo de Pro") |
VIP renders only what's **above** Pro (header "Todo lo de Pro, más:").
⚠ The Clips caps are enforced in the **separate Clips app** (`tiers.ts:72-75`). Confirm it actually enforces 12 / unlimited, SD/HD/4K and the watermark before publishing (D8). Note: Marketing called the 0/12/unlimited cap "En vivo transmisiones". In code it is `clipStreamsPerMonth` ("live streams Clips allows per month"), not the En vivo tool, so the copy says "Clips de … transmisiones en vivo".

---

## 6. i18n keys: final strings
**⚖ = PENDIENTE REVISIÓN LEGAL + bump UI_VERSION.** "NEW" = add to both files. Placeholders must match between es/en (`i18n-parity.test.ts`). No string may contain "token", "tier", "engine" (`customer-copy.test.ts`).

### 6.1 Section header + toggle
| Key | es | en | Status |
|---|---|---|---|
| `landing.plans.label` | Planes | Pricing | en changed |
| `plans.title` | Empieza gratis, crece con Pro | Start free. Grow with Pro. | changed (also the `/planes` h1) |
| `plans.sub` | Con Pro anual, tu primer mes es gratis. Cancela en 1 clic, sin llamadas. | Get a 30-day free trial when you go Pro yearly. Cancel online anytime. | changed **⚖** |
| `plans.subNoTrial` | Cancela en 1 clic, sin llamadas. | Cancel online anytime, no calls. | changed |
| `plans.toggleAria` | Cómo quieres pagar | Billing period | en changed |
| `plans.toggle.month` | Mensual | Monthly | – |
| `plans.toggle.year` | Anual | Yearly | – |
| `plans.toggle.save` | Ahorras {ahorro} | Save {ahorro} | changed: **trial claim removed**, placeholder now used |
| `plans.trialChip` | 1 mes gratis con Pro anual | 30 days free with Pro yearly | NEW **⚖** |
| `plans.trialFootnote` | Mes gratis: prueba de {dias_prueba} días, solo con Pro anual, una vez por cuenta y por tarjeta. | Free trial: {dias_prueba} days, yearly plan only, one per account and card. | NEW **⚖** |
| `plans.yourPlan` | Tu plan | Your plan | NEW (badge) |
| `plans.current` | Tu plan actual | Your current plan | – |
| `plans.trialing` | Ya estás probando Pro | You’re on your Pro trial | en changed |
| `plans.featsTitle` | Incluye: | What you get: | NEW |
| `billing.price.unitYear` | MXN al año | MXN a year | NEW (replaces `landing.plans.perMonth`) |
| `billing.price.unitMonth` | MXN al mes | MXN a month | NEW |
| `billing.price.renewYear` / `renewMonth` | Se renueva cada año / Se renueva cada mes | Renews every year / Renews every month | – |
| `billing.price.tax` | Precios en MXN, IVA incluido. | Prices in MXN, IVA (VAT) included. | – |
| `landing.plans.seeAll` | Ver todos los planes y qué incluyen | Compare all plans | en changed |

### 6.2 Cards
| Key | es | en | Status |
|---|---|---|---|
| `plans.gratis.name` | Gratis | Free | – |
| `plans.gratis.tag` | Para conocer Chalyb | See what Chalyb can do | en changed |
| `billing.price.free` | Sin tarjeta · Para siempre | No card needed · Free forever | en changed |
| `plans.gratis.cta` | Crear cuenta gratis | Create free account | en changed |
| `plans.pro.badge` | Recomendado | Recommended | – |
| `plans.pro.name` | Pro | Pro | – |
| `plans.pro.tag` | Para quien publica cada semana | For creators who post every week | changed (was the tool claim "Todas las herramientas") |
| `plans.pro.save` | Ahorras {ahorro} al año vs. mensual | Save {ahorro} a year vs. monthly | NEW |
| `plans.pro.switchYear` | Cambia a Anual y ahorra {ahorro} al año | Switch to yearly and save {ahorro} a year | NEW |
| `plans.pro.cta` | Empieza tu mes gratis | Start your 30-day free trial | changed **⚖** |
| `plans.pro.ctaYear` | Elegir Pro anual | Choose Pro yearly | NEW |
| `plans.pro.ctaMonth` | Elegir Pro mensual | Choose Pro monthly | en changed |
| `plans.pro.note` | `<b>Hoy pagas $0.</b>` Al terminar tus {dias_prueba} días se cobran {monto} MXN al año, salvo que canceles. Te avisamos {dias_aviso} días antes. | `<b>$0 today.</b>` After {dias_prueba} days, you’ll be charged {monto} MXN a year until you cancel. We’ll email you {dias_aviso} days before. | changed **⚖** |
| `plans.pro.notePaid` | Se cobra hoy. Cancela en 1 clic, sin llamadas. | Charged today. Cancel online anytime. | NEW **⚖** |
| `plans.pro.monthNoTrial` | Se cobra hoy. El mes gratis es solo con Pro anual. | Charged today. The free trial is only on Pro yearly. | changed **⚖** |
| `plans.vip.name` | VIP | VIP | – |
| `plans.vip.tag` | Para quien transmite a diario o maneja varios canales | For daily streamers and multi-channel creators | changed ("para quién es") |
| `plans.vip.featsTitle` | Todo lo de Pro, más: | Everything in Pro, plus: | NEW |
| `plans.vip.noYear` | Solo plan mensual | Monthly billing only | changed |
| `plans.vip.cta` / `ctaUp` | Elegir VIP / Subir a VIP | Choose VIP / Upgrade to VIP | – |

> **Superseded in part by §12.5** (VIP anual, reference line, savings %, "Mejor oferta"). Where §6.2 and §12.5 disagree, §12.5 wins.

### 6.3 Feature bullets (`plans.feat.*`, all NEW)
| Key | es | en |
|---|---|---|
| `clipsTry` | Haz clips para probar (calidad SD, con marca de agua) | Test clips (SD, watermarked) |
| `noWatermarkHd` | Clips sin marca de agua, en HD | Watermark-free clips in HD |
| `clips4k` | Clips en 4K | 4K clip exports |
| `noStreams` (✕) | Clips de tus transmisiones en vivo | Clips from your live streams |
| `streams` | Clips de hasta {n} transmisiones en vivo al mes | Clip up to {n} live streams a month |
| `streamsUnlimited` | Clips de transmisiones en vivo sin límite al mes | Unlimited live streams to clip |
| `history` | Tus resultados se guardan {dias} días | {dias} days of history |
| `historyYear` | Tus resultados se guardan 1 año | A full year of history |
| `storage` | {espacio} para tus videos y archivos | {espacio} of storage |
| `cancel` | Cancela en 1 clic, sin llamadas | Cancel online anytime, no calls |
| `notIncluded` (sr-only, existing `plans.notIncluded`) | No incluye | Not included |

### 6.4 Outside the cards (flag gating, §5.5)
| Key | es | en | Status |
|---|---|---|---|
| `landing.cta`, `landing.sticky` | Prueba Pro gratis 1 mes | Start your free trial | en changed; shown only when `trialOffered` **⚖** |
| `landing.ctaNoTrial` | Empieza gratis | Start free | NEW |
| `landing.ctaSignedIn` | Ver planes | See plans | NEW |
| `landing.publicNav.cta` | Prueba Pro gratis | Free trial | en changed **⚖** |
| `landing.publicNav.ctaNoTrial` | Empieza gratis | Start free | NEW |
| `meta.descriptionNoTrial` | Clips para tus redes, señales de cripto y tu transmisión en un solo lugar. Precios en MXN, IVA incluido. | Clips for your socials, crypto alerts and your stream in one place. Prices in MXN, VAT included. | NEW |
| `plans.faq.a1` | …Te avisamos por correo {dias_aviso} días antes… (rest unchanged) | …We email you {dias_aviso} days before… | placeholder replaces "7" **⚖** |

### 6.5 Delete after the migration (no remaining readers)
`landing.plans.{title, sub, gratis, gratisCta, pro, badge, vip, vipCta, proMonthNote, dealTitle, dealEq, dealTotal, proCta, perMonth}` · `plans.pro.{f1, f3, ctaNoTrial, ctaReturn, monthAlt}` · `plans.gratis.{note, f1, f2, f3, fNo}` · `plans.vip.{f1, f2, f4}`. **Keep** `billing.price.{proYearBig, proYearEq, vsMonth, saveYear, monthLine}` and `plans.pro.fCredits` for the trial picker, Mi plan and the future credits line. Verify with `rg` before deleting.

### 6.6 English / USD market version (mockup 84: **final prices**, billing still not shippable)
Same keys as the en column, with the currency as a placeholder, and the amounts below:
| | Value in 84 | Note |
|---|---|---|
| Pro monthly / yearly · VIP monthly / yearly | **$50 / $500 · $200 / $2,000 USD** (final, owner Oct 3). Pro struck reference $84 → "40% off" in Monthly | Both save 16.67% → "16%" (tie; see §0.1 #1). No more EXAMPLE tags |
| Price line | "$390 USD / year" · "Renews every year" | Charge + frequency is the big number. That is also what ROSCA and Cal. B&P §17602 expect ("clear and conspicuous") |
| Tax line | "Prices in US dollars." (no IVA) | Sales tax / GST / HST treatment TBD with the accountant |
| Footnote | "Free trial: 30 days, yearly plan only, one per account and card." | ⚖ (US/CA counsel per REVISION-LEGAL.md) |
To ship USD: the strings need `{moneda}` instead of the literal "MXN" in both locales (`unitYear` / `unitMonth` / `pro.note`). It also needs a currency-aware `formatMoney`, USD amounts in `config/pricing.ts`, a USD Mercado Pago path (today the webhook gate rejects USD, `price-rules.test.ts:68`), and the Quebec decision (`plans.quebec`).

---

## 7. Copy-only vs needs code (per `pricing-map.md` §"Safe as a copy-only change")

| Change | Copy only (es.json + en.json) | Needs code | Needs billing / owner |
|---|---|---|---|
| Headline, sub, tags, badge, CTA texts for labels that already exist, `vip.noYear`, `toggle.save` text, en rewrites | ✅ | | |
| `toggle.save` showing the **floored** savings | | ✅ `formatMXNFloor` | |
| Trial chip, footnote, `pro.note` / `notePaid` / `monthNoTrial` only when allowed | | ✅ `trialOffered` + interval gating (`plans-view.tsx:86`, `plans-summary.tsx:62-77`) | ⚖ legal review, UI_VERSION bump |
| Drop "equivale" / "vs." lines, deal box, tool list | | ✅ | |
| Feature bullets with real limits | | ✅ `plan-features.ts` reads `TIER_CAPS` | Confirm the Clips app enforces them (D8) |
| Unit on the price line, equal heights, no clipping, Pro first on mobile | | ✅ CSS + markup (`PlanCards`) | |
| One shared `PlanCards` for landing + /planes | | ✅ | |
| Flag off ⇒ no Anual, no claims; landing/nav/sticky labels | | ✅ `plansCta`, hero / final / sticky / nav | |
| "Tu plan" badge / current-plan state on the landing | | ✅ landing loads billing state via `loadPlansProps()` | |
| Rounded prices (e.g. $869 / $8,690 / $2,899) | | ✅ `LIST_CENTS` | ✅ grandfathering (`GRANDFATHERED_CENTS`, `pro_year` has none), 30-day notice (`terms.es.tsx:155`), tests |
| USD market | | ✅ (§6.6) | ✅ prices, tax, MP USD, US/CA counsel |
| Tool-access claim on Pro | | ✅ flag + `TIER_CAPS.PRO.liveEnginesCount` | ✅ terms §(`terms.es.tsx:146`) |

---

## 8. Test impacts

| Test | Impact |
|---|---|
| `tests/price-rules.test.ts` · "forbidden price claims" (:84-103) | **Still passes:** no "2 meses gratis" and no bare `$8,988` / `$10,426.08` in the new strings (the cards stop printing `vsMonth`). **Extend** the regex to `/2 meses gratis\|dos meses gratis\|two months free\|2 months free/i`, since en copy is being rewritten. |
| `price-rules.test.ts` · `annualMath()` deepEqual (:29-36) | Unchanged: the floor is a format helper, not a new `annualMath` field. Add `formatMXNFloor(173_768) === '$1,737'`. |
| `tests/public-site.test.ts` · "plan summary renders the config totals" (:186-199) | **Breaks:** it greps `plans-summary.tsx` for `planPrice('pro_year')` / `annualMath()`. Point it at `plan-cards.tsx` (and keep the `tb('tax')` check on `plans-summary.tsx`). |
| `public-site.test.ts` · "landing components contain no amounts" | Still passes (amounts only via config; `$0` lives in messages). Add `plan-cards.tsx` to the scan. |
| `public-site.test.ts` · "trial CTA follows TRIAL_FLOW_ENABLED" | Still passes. Add a test for the **label** selection (flow off → `ctaNoTrial`, signed in → `ctaSignedIn`). |
| `tests/billing-ui.test.ts` · "Planes CTAs per state" (:44-59) | **Breaks** (new shape §4.3). Rewrite: anon flow on → `hrefYear` trial signup; flow off → `hrefYear: null`, `label: 'paid'`; trialUsed → `label: 'paid'`, `hrefYear: '/app/prueba/pago?plan=pro_year'`; trialing / current / VIP / Quebec unchanged. |
| `tests/i18n-parity.test.ts` | New keys in both files; placeholders `{ahorro}`, `{monto}`, `{dias_prueba}`, `{dias_aviso}`, `{n}`, `{dias}`, `{espacio}` match. |
| `tests/customer-copy.test.ts` | Passes (no "token" / "tier" / "engine"). |
| **NEW** `tests/plan-cards.test.ts` | (1) `trialOffered=false` ⇒ rendered output has none of `plans.trialChip`, `trialFootnote`, `pro.cta`, `pro.note`. (2) interval `month` ⇒ no chip, CTA `ctaMonth`. (3) `intervals=['month']` ⇒ no toggle, no "al año". (4) Pro big number is `planPrice('pro_year')` with "MXN al año" when yearly. (5) no "equivale" on cards. |
| **NEW** `tests/plan-features.test.ts` | Bullets match `TIER_CAPS` (7/90/365, 500 MB / 5 GB / 50 GB, SD/HD/4K, watermark only on FREE, 0/12/∞), and `clipsTry` is hidden when `FREE_INCLUDES_CLIPS=false`. |
| e2e (if present) | Selectors on `.pub-pl*` / `.ch-plancard` → `.ch-pc*` / `data-testid`. |

---

## 9. Acceptance criteria

1. Desktop ≥1024: three cards, **equal height**; the price, CTA and list rows line up across all three; Pro has the accent ring, "Recomendado" and the only primary button. No card or child crosses the card or viewport edge at 1024, 1280, 1440 and 1920 px.
2. Every price reads on **one line** with its unit ("$8,688.40 MXN al año", "$868.84 MXN al mes", "$2,898.84 MXN al mes") at every width ≥ 320 px.
3. Mobile < 1024: cards stacked, **Pro first**, toggle full width.
4. Anual: the big number is the **annual charge**, followed by "Se renueva cada año" and **exactly one** value line, "Ahorras $1,737 al año vs. mensual". No "equivale", no "$10,426.08", no "2 meses gratis" anywhere in the bundle.
5. Mensual: "$868.84 MXN al mes" + "Se renueva cada mes"; no chip; CTA "Elegir Pro mensual" goes to `pro_month` checkout (charged today).
6. Trial available + Anual: chip "1 mes gratis con Pro anual", CTA "Empieza tu mes gratis", $0-today disclosure with amount, frequency, 30 days and reminder days from `PRICING`, plus the footnote "una vez por cuenta y por tarjeta".
7. Trial used: **no** chip, footnote or free-month wording anywhere on the page (sub, toggle, FAQ q1); CTA "Elegir Pro anual" goes to `/app/prueba/pago?plan=pro_year`.
8. `TRIAL_FLOW_ENABLED` off: no free-month claim on the landing (hero, nav, sticky, plans, FAQ, meta description) or on `/planes`; no Anual option; the Pro CTA says "Elegir Pro mensual" and the price shown equals what `/app/subscription` charges.
9. Signed-in users see "Tu plan" + a disabled "Tu plan actual" on their plan, on both the landing and `/planes`.
10. Savings shows the same floored figure ($1,737) on the toggle, the card and the trial picker.
11. The savings pill is accent-tinted, never green.
12. Bullets come from `TIER_CAPS`. No tool-count or "todas las herramientas" claim; no credits/jobs.
13. All ⚖ strings are signed off by legal and `UI_VERSION` is bumped in the same release.
14. All tests in §8 pass; `pnpm lint` and `typecheck` are clean.

---

## 10. Decisions needed from the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Headline | ✅ **Approved Oct 3: "Empieza gratis, crece con Pro".** en: the mockup and §6.1 use "Start free. Grow with Pro."; the owner note says "Start free, grow with Pro". Pick one punctuation |
| D2 | Default toggle on the landing. Anual (= `PRICING.defaultInterval`, where the trial lives) puts **$8,688.40/año next to VIP $2,898.84/mes**, which is your 10-02 concern. Law doesn't allow leading with the monthly price while Anual is selected. | Anual default. The units, VIP's "Solo plan mensual" and the savings line carry it. Alternative: default to Mensual on the landing only. **Update Oct 3:** the accepted monthly reference line (§12.2) addresses the "Pro looks pricier than VIP" concern while keeping the yearly charge dominant |
| D3 | Drop "(equivale a $724 al mes)" from the cards (and later from the trial picker) | Drop (§2 row 3) |
| D4 | Flag off: hide Anual entirely (85) vs. ship `TRIAL_FLOW_ENABLED` first | Hide until the flow is live; otherwise the annual price doesn't match the monthly legacy charge |
| D5 | "1 mes gratis" vs "30 días gratis" in es | Keep "1 mes gratis" in the chip + "prueba de 30 días" in the footnote; legal may prefer "30 días" everywhere (en already says 30 days) |
| D6 | ~~Round prices~~ | ✅ **Superseded:** final prices in §0, code in §13 |
| D7 | Pro tool access: `PRO_INCLUDES_ALL_TOOLS=true` vs `TIER_CAPS.PRO.liveEnginesCount=1` vs terms "UN Engine a tu elección" | Resolve (flag + caps + terms) before any tool claim returns to the cards |
| D8 | Confirm the Clips app enforces watermark / SD-HD-4K / 12-∞ streams, and that "streams" means live streams processed by Clips | Confirm before publishing the bullets |
| D9 | `FREE_INCLUDES_CLIPS` stays on (COGS TODO in `flags.ts`) | Confirm; the Gratis clips bullet depends on it |
| D10 | VIP extras that exist in code but aren't on the card: auto-publish, unlimited brand kits, priority support | Add one only if it is live in the Clips app / support today |
| D11 | USD market: tax line, MP USD charging, Quebec, US/CA counsel | Prices are final (§0.2); billing in USD still not possible |
| D12 | Legal sign-off of all ⚖ strings + `UI_VERSION` bump | Required before deploy |

## 11. Bugs found while mapping (current P5)
- **B1** Flag off (the default): landing `landing.cta` / `landing.sticky` / `publicNav.cta` "Prueba Pro gratis…" and the landing deal box + `proCta` "Empieza con 1 mes gratis" still promise a free month, but the click goes to sign-up → legacy `/app/subscription`, which **charges $868.84 today**.
- **B2** `/planes` Anual pill "1 mes gratis" ignores `trialOffered` (`plans-view.tsx:86`), so a user who already used the trial still sees it.
- **B3** Landing deal box doesn't know `trialUsed` (`plans-summary.tsx:62-77`).
- **B4** Flag off on `/planes`: the Anual view shows $8,688.40/año, but the CTA ("Elegir Pro") goes to the legacy **monthly** checkout.
- **B5** Trial used → CTA "Volver a Pro" goes through the trial picker; Law wants "Elegir Pro anual" straight to the paid annual checkout.
- **B6** Other unconditional trial claims: `meta.description`, `landing.faq.q1/a1`, `home.included.*`, `tools.strip`, `tool.offer.trialCta`, `launch.trialCta`, `checkout.tool`. Gating not verified.
- **B7** Layout: `.pub-plans` uses `1fr 1.12fr 1fr` + `align-items:center` (uneven heights); the 42 px price with a wrapping "MXN al mes"; the side cards squeeze and clip between 900 and ~1100 px.
- **B8** An anonymous visitor whose **card** already had a trial gets `CARD_TRIAL_USED` at payment after seeing the claim. Check that the pay page explains it and offers the paid annual option (not verified).
- **B9** Savings is shown as $1,737.68 (trial picker) vs $1,737 (landing), and the pill is green (`kind="ok"`) in two places.
- **B10** "7 días" is hand-typed in `plans.pro.note` and `plans.faq.a1` instead of coming from `PRICING.trial.reminderDaysBefore`.

---

## 12. Follow-up (Oct 3): annual for every paid plan + monthly reference line (structure; prices now final, see §0/§13)

**Status:** the owner approved the *structure* (every paid plan gets an annual option; Gratis stays $0; Pro anual must stay clearly the best deal; Marketing's monthly reference line is accepted). The *discount plan* (VIP 11×) was **disputed at 08:35 and is on hold**. Everything below except §12.1 is price-independent: amounts are `{monto}` / `{ahorro}` / `{pct}` placeholders fed from `config/pricing.ts`.

### 12.1 ~~Proposal under review~~ SUPERSEDED by §0.2 / §13.1 (kept for history)
I checked the math by running a copy of P5 `src/config/pricing.ts` + `src/lib/billing/format.ts` (with `vip_year` added and `annualMath(tier)` generalized as in §12.4) under `tsx`. Integer centavos, `withIva = round(list × 116 / 100)`.
| | Pro (10×, unchanged) | VIP (11× proposed) |
|---|---|---|
| List before IVA, monthly / yearly | $749 / $7,490 | $2,499 / $27,489 |
| Total with IVA, monthly | $868.84 (86,884¢) | $2,898.84 (289,884¢) |
| Total with IVA, **yearly (big number)** | **$8,688.40** (868,840¢) | **$31,887.24** (3,188,724¢) |
| 12 × monthly | $10,426.08 | $34,786.08 |
| Savings (exact) | $1,737.68 | $2,898.84 (= exactly one month) |
| Savings shown (`formatMXNFloor`) | **$1,737** | **$2,898** |
| Savings % | 16.667 % → **16** (floor) / 17 (round) | 8.333 % → **8** |
| With `PRICES_INCLUDE_IVA=true` | $7,490 / save $1,498 / 16 % | $27,489 / save $2,499 / 8 % |
- Your numbers check out: $27,489 × 1.16 = $31,887.24; 12 × $2,898.84 = $34,786.08; difference $2,898.84 → $2,898 floored.
- **Percentage rounding (D14):** Pro is 16.67 %. "17 %" rounds the saving **up**, which breaks the rule the code already follows for pesos (`plans-summary.tsx:70`: "never claim more than is saved"). The builder therefore uses **floor → 16 %** (`PCT_ROUNDING = "floor"`). It's one switch if the owner and Law accept "17 %".
- **USD example (D17):** VIP $1,290/yr vs $129/mo is **10×** (saves $258, 16.67 %), the same discount as Pro, so Pro would no longer be the best deal. The matching 11× example is **$1,419/yr** (saves $129, 8 %). Not rendered; on hold with the rest.
- The VIP savings equals exactly one month's price. It must **never** be phrased as "1 mes gratis" / "X meses gratis", only as "Ahorras $X al año" (test in §12.6).

### 12.2 Card structure (price-independent)
**Anual selected**
| Slot (§3 rows) | Gratis | Pro | VIP |
|---|---|---|---|
| badge | – | **"Mejor oferta"** (`plans.pro.badgeBest`) only if `proIsBestDeal` (below); else "Recomendado". "Tu plan" still overrides | – ("Tu plan" if current) |
| `hd` | name · tag | name · tag · trial chip (only `trialOffered`) | name · tag (no chip, **no trial on VIP**) |
| `pb` | $0 · Sin tarjeta | **{monto} MXN al año** · Se renueva cada año · *ref line* | **{monto} MXN al año** · Se renueva cada año · *ref line* |
| `vl` | – | **accent pill** `plans.pro.save` "Ahorras {ahorro} al año · {pct}%" | **plain grey text** (ink2, 600, no pill) `plans.vip.save` |
| `ct` | Crear cuenta gratis | trial / "Elegir Pro anual" (§4.4) | **"Elegir VIP anual"** → `hrefYear` |
| `bn` | – | trial disclosure / `notePaid` | `notePaid` "Se cobra hoy. Cancela en 1 clic, sin llamadas." |

**Mensual selected:** Pro is unchanged from §4.4. VIP: "{monto} MXN al mes" · "Se renueva cada mes" · grey link **`plans.vip.switchYear`** "Cambia a Anual y ahorra {ahorro} al año" (sets the toggle to Anual; `lnk` in `--ink2`, so Pro's accent link stays the louder one) · CTA **"Elegir VIP mensual"**. No reference line in Mensual.

**Reference line** (`plans.refMonth`, Marketing, accepted pending Law check L1): shown only in Anual, under the renewal line, on every card whose plan has a monthly option. Style: 15.5 px, `--ink2`, regular weight. *Not* `--ink3`: #8E8E96 on white is about 3.3:1 and fails AA for small text, which the layout test caught. It must stay visibly smaller than the yearly amount, must never say "equivale", and appears on the cards only, never next to the payment form (§11.1 spirit).

**Toggle pill:** `plans.toggle.save` "Ahorra hasta {pct}%", with `pct` = max over plans **offered annually right now**. If only Pro anual is offered, it is Pro's %.

**Rules computed on the server (pure, unit-tested):**
```ts
const offeredYear = (['pro','vip'] as const).filter(t => annualOffered && planExists(`${t}_year`));
const pct = (t) => Math.floor(annualMath(t).yearSavingsCents * 100 / annualMath(t).yearVsMonthlyCents); // D14
const proIsBestDeal = offeredYear.includes('pro') && offeredYear.every(t => t === 'pro' || pct('pro') > pct(t));
const togglePct = Math.max(...offeredYear.map(pct));
```
`proIsBestDeal` makes the "Mejor oferta" claim self-checking: if final prices ever give VIP an equal or better discount, the badge falls back to "Recomendado" by itself, and a test fails (§12.6).
**Graceful fallback:** if `vip_year` isn't configured (`LIST_CENTS.vip.year` absent), VIP shows its monthly price in both toggle positions with `plans.vip.noYear` "Solo plan mensual", i.e. the first design. That lets the cards ship before VIP anual billing does.

**Layout:** a 10-character amount ("$NN,NNN.NN") needs a smaller price coefficient. Amount `clamp(30px, 12.2cqi, 46px)`, unit `clamp(14px, 5cqi, 18.5px)` (was 13.4 / 5.4 cqi). I ran a layout test with a 10-character dummy amount, written to `/tmp/pl/` only and **not** a deliverable, at 1440 and 390: cards equal height (803/803/803), price on one line in all cards, no spill, CTAs aligned. The real PNGs re-render from the same code once the numbers land.

### 12.3 Trial flow off (mockup 85): can VIP anual show? **No, not with today's code.**
VIP anual needs no trial, but every annual checkout lives behind the trial-flow gate. `/app/prueba/pago` and `/app/billing/cambiar` call `requireTrialFlow()` (`trial-gate.ts:19`), which redirects to the legacy `/app/subscription` when the flow is off. That legacy path builds `frequency: 1` monthly preapprovals at `TIER_PRICING` (`subscription-actions.ts:235, 357`), so a VIP-anual card with the flag off would show an annual charge and bill monthly: the B4 bug again. So **85 stays as rendered** (Mensual only, no toggle, no annual for any plan).
**To unlock annual without the trial (code dependency):**
1. Split the gate in `flags.ts`: `paidCheckoutEnabled()` = the non-trial blockers (`LEGAL_*`, `CONSENT_ENCRYPTION_KEY`, `CRON_SECRET`; annual plans need the consent evidence and the 30/7-day reminder cron too). `trialFlowEnabled()` = `paidCheckoutEnabled() && TRIAL_FLOW_ENABLED`.
2. `requireTrialFlow` → `requirePaidCheckout` for the paid routes (`/app/prueba/pago?plan=…` paid path and `/app/billing/cambiar`). Keep `requireTrialFlow` for `/app/prueba` (picker) only.
3. In §4.2: `annualOffered = paidCheckoutEnabled()`, `trialOffered = trialFlowEnabled() && !trialUsed && …`. Then "flag off, checkout on" shows Pro anual (no trial, "Elegir Pro anual") and VIP anual.

### 12.4 Code requirements for `vip_year` (P5 refs; nothing here is done)
| # | Where | Change |
|---|---|---|
| 1 | **New migration** `supabase/migrations/00NN_vip_year_plan_key.sql` | Drop and re-add both CHECKs from `0042_trial_billing_consent.sql:60-68` (`plan_key` and `pending_plan_key`) with `('pro_month','pro_year','vip_month','vip_year')` |
| 2 | `src/config/pricing.ts` | `LIST_CENTS.vip.year` (:24); `PlanKey` adds `'vip_year'` (:28); `planPrice` case (:63-72); **`annualMath(tier: 'pro' \| 'vip' = 'pro')`** (:82-93; the default keeps the existing deepEqual test green); `planHasTrial` stays `pro_year` only (:127); new `formatMXNFloor` helper in `lib/billing/format.ts` |
| 3 | Price gate, `lib/payments/subscription-sync.ts:143` | `planKey === 'pro_year' ? []` → `planPrice(planKey).interval === 'year' ? []`. Yearly plans have **no grandfathered amounts**; without this, a `vip_year` renewal would also accept the old VIP **monthly** list amount. `GRANDFATHERED_CENTS` (`pricing.ts:101`) itself stays monthly-only |
| 4 | Plan names (`Record<PlanKey,…>` gives compile errors) | `start-subscription.ts:103-107` (MP statement "Chalyb VIP anual"), `subscription-sync.ts:652-654`, `app/api/cron/billing/route.ts:37-41` |
| 5 | Plan names by **ternary** (no compile error, silent bugs) | `lib/admin/people-actions.ts:112` (would call vip_year "Pro mensual"), `lib/billing/billing-actions.ts:144` (`=== 'vip_month' ? 'VIP'`) and `:165` (`=== 'pro_year' ? 'anual'`). Switch to `planPrice(k).tier` / `.interval` |
| 6 | Key lists | `lib/billing/api.ts:5` `PLAN_KEYS`; `components/dashboard/admin/people-table.tsx:37`; `dashboard/(admin)/ajustes/page.tsx:18` |
| 7 | `lib/billing/plans-cta.ts:19, 41` | `onVip` = tier VIP (either key); VIP `hrefYear` / `hrefMonth` (`/app/billing/cambiar?plan=vip_year\|vip_month`, anon `…signup&plan=vip&interval=…`) |
| 8 | `lib/billing/plan-change.ts:17-18, 60` | `to === 'vip_month'` → tier VIP. Timing: Pro → VIP (either interval) `now`; `vip_month ↔ vip_year` `period_end` (same as Pro, terms §4.3). Refund math at :60 uses the VIP monthly price; make it use `planPrice(to)` |
| 9 | `app/[locale]/(dashboard)/app/billing/cambiar/page.tsx:55` | Accept `vip_year` (today anything unknown becomes `pro_year`) |
| 10 | MP preapproval `start-subscription.ts:186` | Already `frequency: 12` when `interval === 'year'`. Verify `plan_key='vip_year'` is written so the gate (#3) and reminders use it |
| 11 | Reminders `lib/billing/reminders.ts:65-71` | Already interval-based (**30 d optional + 7 d mandatory**). Add a test for vip_year; check the email templates name the plan via #4 |
| 12 | JSON-LD `lib/seo/json-ld.ts:37-39` | Add `offer('vip_year', 'Chalyb VIP · Anual')` (unitCode ANN is automatic). Consider a separate `Product` for VIP |
| 13 | UI | `plans-view` / `PlanCards` (§12.2); trial picker unchanged (Pro only), but it must not offer VIP; Mi plan / settings (`settings/page.tsx:74` already interval-aware) |
| 14 | Legal content | `content/legal/terms.es.tsx` / `terms.en.tsx` :8 + §4 list: add VIP anual; the terms text still says "UN Engine" (D7) |
| 15 | Admin revenue views | Verify MRR / "Dinero" normalises `vip_year` like `pro_year` (÷12). Not checked |
| 16 | Legacy `TIER_PRICING` (`lib/payments/pricing.ts:33`) | No change (monthly legacy / tier fallback for rows without `plan_key`) |

### 12.5 New / changed strings (es / en). ⚖ = PENDIENTE REVISIÓN LEGAL + bump UI_VERSION
| Key | es | en | Status |
|---|---|---|---|
| `plans.toggle.save` | Ahorra hasta {pct}% | Save up to {pct}% | changed again (was "Ahorras {ahorro}") ⚖ |
| `plans.pro.badgeBest` | Mejor oferta | Best value | NEW ⚖ (claim, L3) |
| `plans.pro.save` | Ahorras {ahorro} al año · {pct}% | Save {ahorro} a year · {pct}% | changed (was "… vs. mensual") ⚖ |
| `plans.refMonth` | o {monto} MXN al mes en plan mensual | or {monto} MXN a month on the monthly plan | NEW ⚖ (L1) · USD variant: "or {monto} USD/mo on the monthly plan" |
| `plans.vip.save` | Ahorras {ahorro} al año · {pct}% | Save {ahorro} a year · {pct}% | NEW ⚖ |
| `plans.vip.switchYear` | Cambia a Anual y ahorra {ahorro} al año | Switch to yearly and save {ahorro} a year | NEW |
| `plans.vip.ctaYear` | Elegir VIP anual | Choose VIP yearly | NEW |
| `plans.vip.ctaMonth` | Elegir VIP mensual | Choose VIP monthly | NEW (`plans.vip.cta` "Elegir VIP" stays for monthly-only) |
| `plans.notePaid` | Se cobra hoy. Cancela en 1 clic, sin llamadas. | Charged today. Cancel online anytime. | **renamed** from `plans.pro.notePaid` (shared Pro/VIP) ⚖ |
| `plans.vip.noYear` | Solo plan mensual | Monthly billing only | kept, fallback only (§12.2) |
| `checkout.trial.year` / `checkout.pay.*` / `checkout.paid.consent` | – | – | Verify the paid-consent sentence renders "{monto} MXN … cada año" correctly for `vip_year` (consent evidence ⚖) |
| MP statement / emails | "Chalyb VIP anual" | – | via `PLAN_NAMES` (#4) |

### 12.6 Test impacts (in addition to §8)
- `price-rules.test.ts` Q1: add `planPrice('vip_year').totalCents` (= 3_188_724 if 11× is confirmed) and `formatMXN` → '$31,887.24'; add `annualMath('vip')` deepEqual; `planHasTrial('vip_year') === false`.
- `price-rules.test.ts` banned phrases: widen to `/meses gratis|months free/i` (plural only, so it bans any "N meses gratis" / "N months free" while allowing today's "1 mes gratis" / "1 month free"); add `$34,786.08` (VIP 12× monthly) to the bare-amount regex beside `$10,426.08`.
- Price gate test: `vip_year` accepts exactly its total and **rejects** the grandfathered VIP monthly list amount (#3).
- **New** `pricing-ladder.test.ts`: `pct('pro') > pct('vip')` strictly. This guards "Pro anual is the best deal" against future price edits; `proIsBestDeal` must agree.
- `billing-ui.test.ts`: VIP `hrefYear` / `hrefMonth`; `onVip` for `vip_year`. `plan-change` tests for vip_month↔vip_year, pro_year→vip_year. Reminders test: vip_year gets renew_30d + renew_7d.
- i18n parity: new placeholders `{pct}`, `{ahorro}`, `{monto}` in both files.

### 12.7 Acceptance criteria (additions to §9)
1. Anual: both paid cards show the **yearly charge** as the biggest number + "Se renueva cada año" + the grey reference line; the line uses `--ink2` and is smaller than the amount.
2. Pro's savings line is an accent pill with %, VIP's is plain grey with %. Pro's % is strictly higher, or the badge falls back.
3. "$NN,NNN.NN MXN al año" stays on one line at every width ≥ 320 px; cards stay equal height on desktop.
4. Mensual: VIP "Elegir VIP mensual" + a working "Cambia a Anual…" link (sets the toggle; focus stays on the toggle).
5. No "meses gratis" / "months free" anywhere; VIP savings never framed as free months.
6. Flow off: no annual option for any plan (until §12.3 is done).
7. Renewing a `vip_year` subscription charges exactly `planPrice('vip_year')`, with reminders 30 and 7 days before.

---

## Owner decisions (Oct 3, 2026)
- Headline approved: **"Empieza gratis, crece con Pro"** (en: "Start free, grow with Pro").
- Marketing follow-up (accepted, pending Law check): in Anual mode, below the big "$8,688.40 MXN al año", add a small grey reference line "o {montoMensual} MXN al mes en plan mensual" (en: "or {monthly} /mo on the monthly plan"), so Pro doesn't look pricier than VIP at a glance. Keep the yearly charge as the largest number. Use the same pattern in the USD version.
- **Annual for every paid plan** (Oct 3, follow-up). Gratis stays $0; VIP gets an annual option with **no trial**; Pro anual must stay clearly the best deal. Structure in §12; implementation list in §12.4.
- **Pro badge** in Anual: "Mejor oferta" / "Best value". **Kept by the owner** although `proIsBestDeal` is false with the final prices (§0.1 #1, L3).
- **Final prices** (08:41): §0.2. **$1,395 is a real former price** (owner, 08:46).
- **Trial** (08:47): 3 days, Pro mensual + Pro anual, never VIP. **App Store model** (08:49): no reminder before the trial charge; one disclosure + one consent checkbox at checkout; a confirmation email/receipt with how to cancel (§14).
- **Monthly reference line accepted** (Marketing): "o {monto} MXN al mes en plan mensual" under each yearly price, in `--ink2` for AA contrast. Pending Law check L1.

### Pending (owner)
| # | Decision | Status / recommendation |
|---|---|---|
| D13 | ✅ **Resolved: VIP anual $36,325 (20%).** ~~VIP anual multiplier.~~ Proposed **11× monthly list** ($27,489 list → $31,887.24 with IVA; saves $2,898.84 → shown $2,898; 8 %), versus Pro 10× (16 %) | ⏸ **ON HOLD: the owner disagreed with the discount plan (08:35).** Waiting for final numbers. Any value works as long as the VIP % stays strictly below Pro's (`pricing-ladder.test.ts`). Billing work in §12.4 is needed whatever the number |
| D14 | Savings % rounding: floor (Pro **16 %**) vs round (17 %) | Floor, consistent with the floored peso amounts; 17 % overstates 16.67 % |
| D15 | "Mejor oferta" only in Anual and only while Pro's % is strictly highest; "Recomendado" in Mensual / flow off | Recommended |
| D16 | Flow off (85): annual hidden for **all** plans, VIP included | Yes, until `paidCheckoutEnabled()` is split from `trialFlowEnabled()` (§12.3) |
| D17 | ✅ Resolved: USD final ($500 / $2,000), but Pro and VIP tie at 16% | See §0.1 #1 |
| **D18** | **Pro anual 16% vs VIP anual 20%** (after $9,970) | **Open. §0.1 #1** |
| **D20** | **$9,970: first-year promo or standing price?** | **Open. §0.1 #1; rendered as standing** |
| **D19** | ✅ Resolved 08:55: struck **$1,662 / $84**, "40%" (computed: 40.01% / 40.48%) | Pending Law L8 |

### Law checks (binding, before release)
| # | Item |
|---|---|
| L1 | **Monthly reference line** on annual cards ("o $997 MXN al mes en plan mensual"): confirm it is a permitted secondary price (it is the real price of another plan, not an "equivale"), and confirm its size/color hierarchy under §11.1 (yearly charge stays the dominant number) |
| L2 | **VIP anual in the Suscripción terms** (`legal/terminos-de-suscripcion.md`): the table (§1, line ~27), **§4 "Plan anual"** (today Pro only: 4.1 single advance charge, 4.2 no prorated refund, 4.3 monthly↔annual switch), §3.3 annual reminder "30 días" (reword to "planes anuales"), §2.2 (VIP has no trial, already stated), §7 refunds for unused months; plus `terms.es.tsx` / `terms.en.tsx` §4 list. Price-change notice (30 days) applies |
| L3 | ✅ **Resolved by Law 09:10: badge → "Más popular" / "Most popular"** (needs sales data, §16.6); "Ahorra hasta 20%" OK as a maximum. History: Comparative claims: "Mejor oferta" / "Best value" and "Ahorra hasta {pct}%" need substantiation. **With the final prices, "Mejor oferta" sits on Pro anual (16%) while VIP anual saves 20%, and the 20% in the pill is VIP's** (§0.1 #1). Also "40% de descuento" / "40% off" (computed from $1,662 / $84) |
| L4 | ✅ **Law 09:10: own checkout copy + checkbox (§16.9).** History: Consent / statement text for the VIP anual paid checkout (`checkout.paid.consent`, MP statement "Chalyb VIP anual"): consent evidence, so bump `UI_VERSION` |
| L8 | ⚠ **Law 09:10: $1,662 conditionally allowed (label A + evidence + limited period), behind `SHOW_REFERENCE_PRICE` (§16.5); US$84 not allowed.** History: **Reference price $1,662 MXN / $84 USD** (struck, "40% de descuento" / "40% off"). The real former price was **$1,395**, so $1,662 / $84 must be justified as a real prior or regular price: PROFECO / LFPC (art. 32, misleading information) and the NOM rules on price information in Mexico; FTC Guides Against Deceptive Pricing (16 CFR 233.1, former-price comparisons) in the US. Otherwise use $1,395 (28%) or "precio de lanzamiento" without a struck price |
| L5 | ✅ **Resolved by Law 09:10: 3-day trial rejected; 7 days + day-0 charge notice + hold rule (§16.1, §16.3).** History: **No reminder before the trial charge (App Store model, owner 08:49).** The P5 code asserts every charge notice is ≥ 5 calendar days ahead and cites **LFPC art. 76 Bis fr. VIII** (`pricing.ts:115, 130-135`); the current terms promise "Te avisamos por correo al menos 7 días antes del primer cobro… Si no podemos avisarte, no te cobramos". Law must confirm that a checkout disclosure + consent + confirmation email is enough for a 3-day trial (MX, and US/CA automatic-renewal laws), and approve the terms change (§14.3) |
| L6 | New trial strings ⚖ (chip, CTA, disclosures "Hoy pagas $0. El {fecha} se cobran {monto} MXN por el año completo, automáticamente. Cancela cuando quieras." (Anual) / "…se cobran {monto} MXN automáticamente…" (Mensual), footnote, confirmation email, consent sentence). The Mensual line doesn't state the frequency, and the Anual line doesn't say it renews; the card shows "Se renueva cada mes/año" right above it, and the checkout sheet must too. **Bump `UI_VERSION`** |
| L7 | ✅ **Law 09:10: exactly 30 days + express acceptance; modal mockup 89 (§16.8).** History: Price increase for existing subscribers ($749 → $997, $2,499 → $3,799): 30-day notice + express acceptance per terms §5.2–5.3 (§13.3) |

---

## 13. Code impact of the final prices (P5 `c163dfd` refs; nothing implemented)

### 13.1 Every amount changes
| Key | Today in P5 (`LIST_CENTS`, before IVA → total) | Final total (IVA incl.) | `LIST_CENTS` with `PRICES_INCLUDE_IVA=true` | Back-computed list (flag false) |
|---|---|---|---|---|
| `pro_month` | 74,900 → 86,884 ($868.84) | **99,700** ($997) | 99_700 | 85_948 → 99,700 ✅ |
| `pro_year` | 749,000 → 868,840 ($8,688.40) | **997,000** ($9,970, owner 08:51) | 997_000 | 859_483 → 997,000 ✅ |
| `vip_month` | 249,900 → 289,884 ($2,898.84) | **379,900** ($3,799) | 379_900 | 327_500 → 379,900 ✅ |
| `vip_year` (new, §12.4) | – | **3,632,500** ($36,325) | 3_632_500 | **impossible**: 3_131_465 → $36,324.99; 3_131_466 → $36,325.01 |
| ref. `pro_month` (new) | – | **166,200** ($1,662; USD 84) | `REFERENCE_CENTS.pro_month` | same |
Production (`main`) charges **$749.00 / $2,499.00**, with no IVA added. $868.84 / $2,898.84 are the unreleased P5 defaults.

### 13.2 IVA handling: use totals (`PRICES_INCLUDE_IVA=true`)
Back-computing can't produce $36,325 exactly (above), so the owner's prices only work as **totals**:
1. `LIST_CENTS` = the totals above; rename it `PRICE_CENTS` and update the header comment (Q1 changes: "prices include IVA").
2. **Flip the default in code**, `readBool('PRICES_INCLUDE_IVA', true)`, instead of relying on an env var. A missing env var would otherwise add 16% on top ($997 → $1,156.52). Set the env var explicitly in every Vercel environment and in `.env.local.example` as well.
3. **Packs flip too:** with the flag on, `withIva(packs)` returns the list price, so packs drop from $172.84 / $694.84 / $2,318.84 to $149 / $599 / $1,999. To keep today's pack prices, restate them as totals (17_284 / 69_484 / 231_884), or have the owner confirm the new pack prices.
4. `ivaPortion()` keeps working for receipts (e.g. $997 → IVA $137.52, base $859.48). Formatting: every final amount is whole pesos, so `formatMXN` prints no decimals.

### 13.3 Grandfathering and the price increase
- **Bug if done naively:** `GRANDFATHERED_CENTS = { PRO: [LIST_CENTS.pro.month], VIP: [LIST_CENTS.vip.month] }` (`pricing.ts:101-104`) is **derived from the list**. Editing `LIST_CENTS` silently drops the old amounts, and the price gate (`webhook-verify.ts:88`, `subscription-sync.ts:143`) would **refuse every existing renewal**. Hard-code them: `PRO: [74_900, 86_884]`, `VIP: [249_900, 289_884]` (live main amounts + P5 IVA-added amounts, in case P5 ships first), and `packs` = the old pack amounts for in-flight checkouts.
- **Increase per subscriber:** Pro $749 → $997 (**+33.1%**; from $868.84, +14.8%); VIP $2,499 → $3,799 (**+52.0%**; from $2,898.84, +31.1%).
- **Terms already bind this:** `terms.es.tsx:155` and `terminos-de-suscripcion.md` §5.2–5.3 require email + in-app notice **at least 30 calendar days before** the renewal where the new price applies (old price, new price, date, how to cancel). The increase applies **only with express acceptance** ("Acepto el nuevo precio"); with no acceptance, the plan doesn't renew and drops to Gratis at period end. §14.1 (US/CA) also says 30 days.
- **Code:** consent events `price_change_notice_sent / _accepted / _declined` exist (`consent-core.ts:23-25`). Not verified: a notice job, the acceptance UI, updating the MP preapproval `transaction_amount` on acceptance, and cancel-at-period-end on decline/no answer. Until a subscriber accepts, they keep renewing at their old amount (that's why the grandfather list matters).
- **Legal text with old amounts:** `terminos-de-suscripcion.md` lines 7, 25, 47, 51 ($749 / $7,490 / $2,499) and `terms.*.tsx` §4 list; JSON-LD offers (`json-ld.ts:37-39`) read config, so they follow automatically.

### 13.4 Reference price + discount ($1,662 / $84, owner 08:55, pending L8)
- New config `REFERENCE_CENTS = { pro_month: 166_200 }` (USD: 8_400) and pure `discountPct(now, ref) = floor((ref − now) × 100 / ref)` → **40** (40.01%; USD 40.48%). Never a hand-typed %.
- Strings: `plans.pro.wasPrice` "{monto}" (rendered inside `<s>`, with sr-only "Precio regular:" / "Regular price:") and `plans.pro.discount` "{pct}% de descuento" / "{pct}% off". Shown only next to the **Pro monthly** price (Mensual mode, flow off), never next to the annual price, the payment form or the consent text.
- **Test conflict:** `public-site.test.ts:175-182` bans `line-through|<s>|<del>` in `src/components/landing/*`, and BUILD-SPEC §11.1 / LANDING-SPEC only allowed a struck price as "vs. mes a mes". Update both docs to reflect the owner decision. The `<s>` lives in `PlanCards` (not in the landing dir); the test must allow it only around a `REFERENCE_CENTS` value (e.g. assert `<s>` appears only with `formatMXN(REFERENCE_CENTS…)`).

### 13.5 Savings = 0 must hide, never print "Ahorras $0"
- `annualMath('pro').yearSavingsCents` is **199_400** with $9,970 (it was 0 at $11,964). The guard stays: `plans.pro.save`, `plans.pro.switchYear` and the toggle % must render only when `> 0`. `togglePct = max` over plans with savings > 0; hide the pill if none.
- `annualMath()` deepEqual tests (`price-rules.test.ts:29-50`, `public-site.test.ts:186-199`) change: Pro `{ yearMonthlyEquivalentCents: ≈83_083 (never displayed), yearVsMonthlyCents: 1_196_400, yearSavingsCents: 199_400 }`; VIP `{ 302_708 (= $3,027.08, never displayed), 4_558_800, 926_300 }`.

### 13.6 Tests to update / add
- `price-rules.test.ts`: totals 99_700 / 997_000 / 379_900 / 3_632_500; `formatMXN` → "$997", "$9,970", "$3,799", "$36,325"; savings "$1,994" / "$9,263"; flag default `true`; packs; the "PRICES_INCLUDE_IVA=true treats list prices as totals" test becomes the default case; bare-amount ban: add `$11,964` and `$45,588` (12 × monthly). Never print them as a "vs." anchor.
- Price gate: renewals at 74_900 / 86_884 (Pro) and 249_900 / 289_884 (VIP) are still accepted; `pro_year` / `vip_year` accept only their totals.
- `public-site.test.ts`: new totals; struck-price rule (§13.4).
- `pricing-ladder.test.ts` (§12.6): **fails with today's numbers** (Pro 16% vs VIP 20%). Keep it as the release gate for decision #1; don't skip it.
- New: `discountPct(99_700, 166_200) === 40`, `discountPct(5_000, 8_400) === 40`, and a guard test: `discountPct(5_000, 8_300) === 39` (so $83 can never display "40%"); savings line hidden when savings = 0.

---

## 14. ~~Trial: 3 days~~ SUPERSEDED by §16 (Law 09:10: a 3-day trial can't meet the ≥5-day notice of LFPC art. 76 Bis VIII). Kept for history. Trial: 3 days on Pro (mensual + anual), never VIP, App Store model (owner, Oct 3 08:47 / 08:49)

### 14.1 What the user sees
- Chip **"3 días gratis"** / "3 days free" on the Pro card **in both modes**, only when `trialOffered`. Never on VIP.
- Pro CTA in both modes: **"Prueba Pro gratis 3 días"** / "Try Pro free for 3 days". Trial used or flow off: "Elegir Pro anual" / "Elegir Pro mensual" + "Se cobra hoy…" (82, 85 unchanged).
- **Hero flow = Pro anual** (`PRICING.defaultInterval: 'year'`). Day 3: MP charges the **full annual amount, $9,970 MXN**, automatically.
- Disclosure under the CTA and at checkout ⚖, Anual: **"Hoy pagas $0. El {fecha} se cobran {monto} MXN por el año completo, automáticamente. Cancela cuando quieras."** (mockup: "El 6 de octubre se cobran $9,970 MXN por el año completo…"). Mensual: **"Hoy pagas $0. El {fecha} se cobran {monto} MXN automáticamente. Cancela cuando quieras."** ($997). en: "$0 today. On {date} you'll be charged {amount} for the full year, automatically. Cancel anytime." `{fecha}` = signup + 3 days in the user's zone; `{monto}` = `planPrice(key).totalCents`. New keys `plans.pro.trialNoteYear` / `plans.pro.trialNoteMonth` (⚖, replace `plans.pro.note` / `monthNoTrial`).
- Sub: "Prueba Pro gratis 3 días. Cancela en 1 clic, sin llamadas." Footnote ⚖: "Prueba Pro gratis 3 días: mensual o anual, una vez por cuenta y por tarjeta. VIP no tiene prueba."
- Every "1 mes gratis" / "mes gratis" / "30 días" claim goes: **29 lines in `es.json`, 19 in `en.json`** (landing hero/nav/sticky "Prueba Pro gratis 1 mes" → "Prueba Pro gratis 3 días", trial picker, banners, FAQ q1, meta description). Re-grep before release.
- **Checkout = Apple-style confirmation sheet:** one summary (plan, amount, frequency, first charge date, how to cancel) + **one consent checkbox** + pay button. No extra screens.

### 14.2 Notices: no reminder before the trial charge
- **Removed for trials:** no signup-reminder or day-before emails. The trial-end reminder (`trial_7d`, and the optional `trial_1d` / `TRIAL_DAY29_REMINDER_ENABLED`) is **dropped** from `reminders.ts` and the cron for `state === 'trialing'`. **Renewal reminders stay as they are** (annual: 30 d optional + 7 d mandatory; monthly: 7 d before each renewal).
- **Kept:** one **confirmation email / receipt at subscription** (transactional, not a reminder): plan, $0 today, amount + frequency, first charge date, **how to cancel** (link), and the consent record ID.
- Code: `PRICING.trial = { days: 3, plans: ['pro_month','pro_year'], requiresCard: true }` (drop `reminderDaysBefore`); `trialDates()` drops `reminderAt`; **`assertReminderWindows()` must stop including the trial** (today it throws at import time for any notice < 5 days, citing LFPC art. 76 Bis fr. VIII, see Law L5); delete the `trial_7d` / `trial_1d` kinds and their email templates; the confirmation email is sent from `start-subscription.ts` after a successful trial start.

### 14.3 Other code changes
| Where | Change |
|---|---|
| `config/pricing.ts:111-114, 125-129` | `trial.days: 30 → 3`; `planHasTrial(k)` → `k === 'pro_month' \|\| k === 'pro_year'` (never VIP); update the comments ("Anual only") |
| `start-subscription.ts:124-126, 190-191` | `wantsTrial` now true for `pro_month`; MP `auto_recurring.start_date = now + 3 days` (via `trialDates`). Verify MP accepts a 3-day `start_date` on a card-token preapproval and doesn't charge the card at creation |
| **Revert / rework `c163dfd`** ("a free month can't turn into Mensual") | `changeTiming` `trial_annual_only` (409 `TRIAL_ANNUAL_ONLY`), `reactivationStart`, Mi plan's hidden switch and the cancel sheet's dropped Mensual offer assume an Anual-only trial. With trials on both, decide: switching interval during the trial keeps the same charge date and charges the new plan's amount |
| `plans-cta.ts`, `PlanCards` | Trial CTA + chip for Mensual too; anon `hrefMonth` → `signup&plan=pro&interval=month` (trial) |
| Trial picker `/app/prueba` | Both intervals start a trial; copy says 3 days |
| `trial-dates.ts` `trialDaysLeft` | Fine (banner "te quedan {n} días" now 3 → 0) |
| Consent (`consent.ts`, `disclosureParagraphs`, `consentSentence`, `checkout.*`) | Rewrite every 30-day / 7-day-notice sentence to the §14.1 disclosure. **Bump `UI_VERSION`** (`consent.ts:11`, today `'rebuild-p2'`), because the consent evidence text changes |
| `billing-cron` (`vercel.json`: daily at 15:00 UTC) | No trial notices any more. The trial→paid transition is MP's own charge on `start_date`; the cron only syncs |
| Terms: `terminos-de-suscripcion.md` §2.1 "30 días naturales" → 3; §2 "solo Pro anual" → Pro mensual y anual; top bullet "Te avisamos por correo al menos 7 días antes del primer cobro… Si no podemos avisarte, no te cobramos" → **remove for trials** (renewal notices stay); §2.5 amounts; `terms.es.tsx` / `terms.en.tsx` | ⚖ |

### 14.4 Tests
- `price-rules`: `planHasTrial('pro_month') === true`, `('pro_year') === true`, `('vip_month' / 'vip_year') === false`; `PRICING.trial.days === 3`.
- `trialDates(start).chargeAt === start + 3 d`; no `reminderAt`.
- `reminders`: `dueNotices` for `trialing` returns **[]**; renewal notices unchanged (monthly 7 d; annual 30 d + 7 d). `assertReminderWindows` ignores the trial.
- `start-subscription`: `pro_month` + trial unused → mode `trial`, `start_date` = +3 d; trial used → `paid`; VIP → `paid`.
- `billing-core` tests added by `c163dfd` (`TRIAL_ANNUAL_ONLY`): rewrite for the new rule.
- Confirmation email: contains amount, frequency, charge date and the cancel link.
- Banned phrases: add `/mes gratis|month free|30 días gratis|30-day free/i` to the copy test so no old claim survives; `UI_VERSION !== 'rebuild-p2'`.

---

## 15. Plan Pro Lealtad (owner idea, Oct 3 09:02): Pro gets cheaper every month you stay

> **⚖ Law reviewed Pro Lealtad (Oct 3, 09:17): `legal/PRICING-2026-10-03-REVISION.md` §R, `terminos-de-suscripcion.md` §4 bis, `aceptacion-ux.md` §4.2. Read §15.12 first; it overrides §15.1–§15.11 where they differ** (reset on refund/chargeback, "Precio regular", the 3 strings, L12). **Name: Pro Lealtad / Pro Loyalty (owner, 09:50; §15.1); `plan_key` `pro_lealtad`.**

**Mockups:** `mockups/86-precios-reducto.png` (desktop pricing, Pro Lealtad selected), `87-mi-plan-reducto.png` (Mi plan, user in month 4), `88-reducto-movil.png` (390 px). Built by `build_reducto.py` (reads `PRICES` / `REF` from `build_pricing.py`, so the $1,662 base has one source; reuses the app shell from `build_fix3.py`) and captured by `render_reducto.py` (Playwright 2×, Inter; checks overflow, spill and off-screen elements; all clean).

### 15.1 Name
**Named by the owner (Oct 3, 09:50): Pro Lealtad (es) / Pro Loyalty (en).** Toggle option "Lealtad" (en "Loyalty"). Internal `plan_key` = `pro_lealtad`. Working name until 09:50 was "Pro Reducto" (dropped: "reducto" means a stronghold, not "something that goes down"); mockup **file names** keep `reducto` (`86-precios-reducto.png`, `87-mi-plan-reducto.png`, `88-reducto-movil.png`, `build_reducto.py`, `render_reducto.py`) so existing links don't break. The name is one constant (`NAME`). **i18n keys renamed** `*.reducto.*` → `*.lealtad.*` (`plans.toggle.lealtad`, `plans.lealtad.*`, `billing.lealtad.*`, `checkout.lealtad.consent`); code identifiers too (`lealtadPriceCents`, `lealtadSchedule`, `LEALTAD`, `lealtadOpenToNewCustomers`, consent events `lealtad_started` / `lealtad_step_notice_sent` / `lealtad_step_advanced` / `lealtad_reset`), migration `0046_pro_lealtad.sql`. Nothing is implemented yet, so the rename is free.

### 15.2 Schedule (IVA included; base = the $1,662 regular price, no 40% promo)
Each step price is rounded **down** to the whole peso, so the advertised % is always met or beaten. **The floor is $664, not $665:** 1,662 × 0.4 = 664.80, and $665 would be 59.99% off (not a real 60%), while $664 is 60.05% off.

| Month | Discount | Charge | Real % off |
|---|---|---|---|
| 1 | 0% | **$1,662** | 0 |
| 2 | 10% | **$1,495** | 10.05 |
| 3 | 20% | **$1,329** | 20.04 |
| 4 | 30% | **$1,163** | 30.02 |
| 5 | 40% | **$997** | 40.01 (= Pro mensual) |
| 6 | 50% | **$831** | 50.00 |
| 7 and after | 60% | **$664** | 60.05 |

| 12-month total | Pro Lealtad | Pro mensual (12 × $997) | Pro anual |
|---|---|---|---|
| Year 1 | **$11,461** | $11,964 | **$9,970** |
| Year 2 | **$7,968** | $11,964 | $9,970 (if it renews at $9,970, D20) |
| 2 years | $19,429 | $23,928 | $19,940 |

**Where Pro Lealtad wins, honestly:**
- **vs Pro mensual:** each monthly bill is lower from **month 6** ($831 < $997). The running total is lower from **month 11** ($10,797 vs $10,967). Year 1 saves $503 (4.2%).
- **vs Pro anual:** Pro anual is **clearly cheaper in year 1** ($1,491 less, 13%). **From year 2 Pro Lealtad is cheaper** ($7,968 vs $9,970, $2,002 less), and over 2 years it's $511 cheaper. So "Pro anual stays a clear deal" holds **only for the first year**.

**Owner decision D21 (keep Pro anual the clear deal):**
| Option | Effect | Note |
|---|---|---|
| **A (recommended)** Keep the 60% floor; Pro anual **renews at ≤ $7,490** from year 2 | Anual beats Pro Lealtad every year (year 2: $7,490 vs $7,968) | A price *decrease* at renewal (no acceptance needed). Fits the loyalty idea |
| B Floor 50% ($831) | Year 2: $9,972 vs anual $9,970 (only $2 apart); **year 1 $12,463 > Pro mensual** | Kills the "real 60%" headline, and Pro Lealtad loses to mensual in year 1 |
| C Keep as is | Anual wins year 1 only | Must not claim anual is "always" the best deal |

The cards (86/88) say exactly what's true: "En el primer año, Pro anual sigue siendo lo más barato… si te quedas, en el 2.º año pagas $7,968."

### 15.3 Placement
**Third toggle option "Mensual / Anual / Lealtad"** with a "Solo Pro" tag. When it's selected, the three cards are replaced by **one wide Pro Lealtad panel**: left = price + CTA + disclosures; right = the staircase (7 bars with amount, −% and month; horizontal rows on mobile), then a 3-way comparison (Pro Lealtad year 1 / Pro mensual / Pro anual). Under it: "Gratis y VIP no tienen Pro Lealtad: ver Mensual y Anual". *Why not an option inside the Pro card:* the staircase needs width and the full schedule must be visible before purchase (L9); squeezed into a 1/3-width card it would hide the disclosures. Mobile: the toggle becomes 3 equal segments with the tag under the label.

### 15.4 Rules (counter = `loyalty_step`, 0 … 6)
| Event | Counter |
|---|---|
| A charge is approved | +1 (max 6). Next bill drops one step |
| Charge fails, MP retries and one succeeds **within the grace window** (`graceDays: 7`) | **No reset**; that month counts once paid |
| Charge fails and nothing succeeds by the end of grace (MP `paused` → we cancel / grace ends) | **Reset**: the subscription ends; coming back starts at $1,662 |
| Pause | Chalyb has no user pause today (MP `paused` only comes from failed charges, see above). If one is added later: **reset** (it breaks "consecutive"), disclosed in the pause dialog |
| Cancel (→ Gratis) | **Reset** at period end. **Undoing the cancellation before period end = no reset** (nothing was interrupted) |
| Upgrade to VIP (either interval) | **Reset** (leaves Pro Lealtad) |
| Switch to Pro mensual or Pro anual | **Reset** |
| Switch **into** Pro Lealtad from Pro mensual/anual | Starts at month 1 ($1,662). No credit for earlier months (disclosed on the confirm page) |
| Card change / payment-method change | No reset |
| Refund or chargeback of a Pro Lealtad charge | ~~Reset~~ → **No reset (Law R.4).** The month still counts. A chargeback decided for Chalyb with the amount unpaid → failed-payment flow (day-0 + day-5 notices, 7 days) → reset only after that |
| Base price change | Existing schedule locked; any increase needs 30-day notice + express acceptance (terms §5.2–5.3) |
| **3-day trial** | **No trial on Pro Lealtad** (owner's recommendation, agreed): month 1 is the full price charged today. A trial would blur "month 1" and stack two promos |

### 15.5 Data model (P5 refs)
- **Migration `supabase/migrations/0046_pro_lealtad.sql`:** re-create the `plan_key` / `pending_plan_key` CHECKs (`0042_trial_billing_consent.sql:60-68`) with `'pro_lealtad'` (+ `'vip_year'` if §12.4 hasn't shipped). Add to `subscriptions`: `loyalty_step smallint not null default 0 check (loyalty_step between 0 and 6)` (the step of the **next** charge); `loyalty_mp_amount_cents integer` (what we last set in MP); `loyalty_reset_at timestamptz`. On `payments`: `loyalty_step smallint` (step that charge was billed at, for audit and refunds).
- **`config/pricing.ts`:** `LEALTAD = { baseCents: REFERENCE_CENTS.pro_month, stepPct: 10, floorPct: 60 }`, `lealtadPriceCents(step) = floor(base × (100 − min(step × stepPct, floorPct)) / 100 / 100) × 100`, and `lealtadSchedule()`. `PlanKey` adds `'pro_lealtad'` (tier PRO, interval month). `planPrice('pro_lealtad')` returns the month-1 price; anything that bills uses the new `chargeFor(sub)`, which reads `loyalty_step`.
- Every `PlanKey` site from §12.4 #2–#9 (plan names "Chalyb Pro Lealtad", key lists, `plans-cta`, `plan-change` timing: entering or leaving Pro Lealtad = `period_end`, `cambiar` page) and `planHasTrial('pro_lealtad') === false`.

### 15.6 Mercado Pago
A preapproval charges a fixed `auto_recurring.transaction_amount`, but MP lets you change it with `PUT /preapproval/{id}` (`auto_recurring.transaction_amount` + `currency_id`; MP docs "Change amount").
- **Recommended: update the preapproval amount after each approved charge.** In the approved-payment webhook: `loyalty_step += 1`, then PUT `lealtadPriceCents(step)`, about 30 days before the next charge. Within one subscription **the amount only ever goes down**; a reset is always a *new* subscription with a new preapproval at $1,662. **Daily reconcile** in the billing cron: for every `pro_lealtad` subscription, if MP's amount ≠ the expected amount, PUT again. If it's still wrong 48 h before `next_charge_at`, alert ops. Verify in the MP sandbox (MLM): the PUT works on card-token preapprovals with no payer re-authorization, and whether MP emails the payer about the change.
- Rejected: **our own charge job** (one-off `/v1/payments` on a stored card each month). It means storing cards via the Customers API, our own scheduling, retries and dunning, plus card-on-file / CVV rules: more PCI and ops risk for no user benefit.
- **Price gate** (`subscription-sync.ts:136-150`, `webhook-verify.ts:81-123`): for `pro_lealtad`, expected = `lealtadPriceCents(loyalty_step)`. Also accept `lealtadPriceCents(loyalty_step − 1)` only during the 48 h after the step advanced (payment-vs-PUT race). No grandfathered amounts. **Never accept more than the base.** If a charge comes in *above* the expected step (a PUT failed): grant access, **automatically refund the difference**, and alert. *Below* expected: accept and alert.

### 15.7 Notices
Pro Lealtad is monthly, so the existing **7-day pre-renewal notice stays mandatory** and now states the new amount ("El 8 de octubre se cobran $997 MXN: mes 5, 40% menos"). This is also the in-app banner in 87. The "no reminders" App Store model (§14.2) applies to the trial only. Confirmation email at signup: the full schedule + the reset rule + how to cancel.

### 15.8 Strings (es / en). ⚖ = pending legal + `UI_VERSION` bump
| Key | es | en |
|---|---|---|
| `plans.toggle.lealtad` / `.lealtadTag` | Lealtad · Solo Pro | Loyalty · Pro only |
| `plans.lealtad.who` | Para quien se queda: cada mes que sigues con Pro, pagas menos. | For people who stay: every month you keep Pro, you pay less. |
| `plans.lealtad.price` | {monto} MXN el primer mes | {amount} for your first month |
| `plans.lealtad.then` | Baja {step}% cada mes que sigues, hasta {piso} MXN al mes ({pct}% menos) desde el mes {mes}. | Drops {step}% every month you stay, down to {floor}/mo ({pct}% off) from month {month}. |
| `plans.lealtad.cta` | Elegir Pro Lealtad | Choose Pro Loyalty |
| `plans.lealtad.note` ⚖ | Se cobra hoy {monto}. Después, cada mes: {calendario} MXN, y se queda en {piso} mientras sigas. Sin prueba gratis. | Charged today: {amount}. Then each month: {schedule}, staying at {floor} while you stay. No free trial. |
| `plans.lealtad.reset` ⚖ ~~SUPERSEDED §15.12.4~~ | Si cancelas o cambias de plan, tu descuento vuelve a cero y Pro Lealtad empieza otra vez en {monto}. | If you cancel or change plans, your discount resets and Pro Loyalty starts again at {amount}. |
| `plans.lealtad.compare` | En el primer año, Pro anual sigue siendo lo más barato. Pro Lealtad cuesta menos que Pro mensual desde el mes 6 y, si te quedas, en el 2.º año pagas {anio2}. | In year one, Pro yearly is still the cheapest. Pro Loyalty costs less than Pro monthly from month 6, and if you stay, year two costs {year2}. |
| `billing.lealtad.step` | Mes {n}: pagas {monto}, {pct}% menos. | Month {n}: you pay {amount}, {pct}% off. |
| `billing.lealtad.progress` | Tu descuento: {pct}% de {max}% · Faltan {n} meses | Your discount: {pct}% of {max}% · {n} months to go |
| `billing.lealtad.warn` ⚖ ~~SUPERSEDED §15.12.4~~ | Si cancelas o cambias de plan, pierdes tu descuento. Tu precio vuelve a {monto} MXN al mes y empieza a bajar desde cero. Cambiar de tarjeta no lo afecta. | If you cancel or change plans, you lose your discount… Changing your card doesn't affect it. |
| `billing.lealtad.changeSub` | Reinicia tu descuento Pro Lealtad | Resets your Pro Loyalty discount |
| `billing.lealtad.cancelSub` | Sigues con Pro hasta el {fecha}. Si vuelves después, empiezas en {monto}. | You keep Pro until {date}. If you come back later, you start at {amount}. |
| `checkout.lealtad.consent` ⚖ ~~SUPERSEDED §15.12.4~~ | Acepto que se cobre {monto} hoy y, cada mes, {calendario} MXN, quedando en {piso} MXN al mes; que el descuento se reinicia si cancelo o cambio de plan; y que puedo cancelar en cualquier momento. | (en equivalent) |

### 15.9 Tests
- `lealtadPriceCents(0…6)` = 166_200, 149_500, 132_900, 116_300, 99_700, 83_100, 66_400; `step > 6` stays 66_400; every step's real % ≥ advertised (`(base − p) × 100 / base >= step × 10`).
- Totals: 12-month 1_146_100; months 13–24 796_800 (pins the honest comparison copy).
- Counter: approved charge → +1 (cap 6); paid within grace → no reset; grace expiry / refund / chargeback / cancel at period end / plan change → new subscription at step 0; undo-cancel → unchanged; card change → unchanged.
- MP: after an approved charge, a PUT with the next amount is issued; the reconcile cron re-PUTs on mismatch; a reset creates a new preapproval at 166_200.
- Gate: accepts the expected step; accepts step − 1 only within 48 h; rejects > base; over-charge → access + partial refund + alert.
- `planHasTrial('pro_lealtad') === false`; the 7-day monthly notice for `pro_lealtad` carries the next step's amount.
- Copy: no "gratis" in Pro Lealtad strings; the schedule string is built from `lealtadSchedule()` (never typed); i18n parity for `{calendario}`, `{piso}`, `{step}`, `{mes}`.

### 15.10 Law checks
| # | Item |
|---|---|
| L9 | ✅ Law R.2: allowed with full schedule + dates at checkout. History: **Full schedule up front:** every charge amount and when it applies (month 1 … 7+) must be shown before purchase (card, checkout sheet, confirmation email). The 86/88 panel shows all seven amounts plus the "se cobra hoy" line. Confirm this satisfies LFPC art. 7 Bis / 76 Bis (total and periodicity) for a **variable-amount** subscription, and the US/CA auto-renewal rules if Pro Lealtad is ever offered in USD |
| L10 | ✅ Law R.2: exact checkbox in §15.12.3. History: **Consent text** (`checkout.lealtad.consent`): one checkbox covering today's amount, the schedule, the reset rule and cancellation. Consent evidence → bump `UI_VERSION` |
| L11 | ✅ Law R.4: cancel / plan change / unpaid after 7-day grace OK; refund + chargeback must not reset. History: **Reset disclosure:** shown next to the CTA (86/88), on Mi plan (87, plus on every "Cambiar de plan" row and in the cancel row), on the plan-change confirm page and in the cancel flow. Confirm it's prominent enough, and that resetting on a plan change (a loss of an accrued benefit) is allowed |
| L12 | ❌ **Law R.5: No. Pro Lealtad's $1,662 does NOT support the struck $1,662 on Pro mensual; "Precio regular" removed.** History: **"Precio regular $1,662" as month 1:** Pro Lealtad would actually charge $1,662, which may help substantiate the struck $1,662 on Pro mensual (L8). Law to decide whether that counts and from when |
| L13 | ✅ Law R.3: yes, a notice ≥ 7 days before **every** charge with that month's amount. History: Monthly pre-charge notices state the changing amount (§15.7); confirm the 7-day notice is required for each changed amount |

### 15.11 Acceptance (Pro Lealtad)
1. The toggle shows Mensual / Anual / Lealtad; Pro Lealtad shows one panel with all 7 amounts and the reset warning above the fold at 1440 × 900.
2. The month-1 charge is exactly $1,662; month n charges `lealtadPriceCents(min(n−1, 6))`; the floor is $664.
3. Mi plan shows the current step ("Mes 4: pagas $1,163, 30% menos"), a progress bar to 60%, the next charge (amount + date + step) and the reset warning.
4. Any reset path starts a new subscription at $1,662; a card change doesn't.
5. MP's preapproval amount equals the next step at least 48 h before every charge (reconcile cron).

### 15.12 Law review applied (§R, Oct 3 09:17). Mockups 86–88 re-rendered

**15.12.1 Verdict.** Allowed with the full schedule, today's charge, monthly renewal and reset rule shown before payment and one checkbox. Name: **Pro Lealtad** (en Pro Loyalty), owner 09:50; `NAME` constant; the Terms carry the name (no placeholder).

**15.12.2 Panel (86/88), Law ux §4.2**
- Header: "Pro Lealtad · Se renueva cada mes · Sin prueba gratis". Price "$1,662 MXN el primer mes".
- Explanation: "Cada mes que sigues pagando, tu precio baja 10% del precio del mes 1, hasta **$664 MXN al mes desde el mes 7** (60% menos)."
- Bars:
  - each bar shows the month and the amount;
  - the % label is "10% menos" … "60% menos", with the legend "% = menos que el mes 1" (Law allows a legend);
  - the aria-label says "10% menos que el mes 1";
  - **nothing under bar 1** (no "Precio regular", no "Sin descuento").
- Rounding line: "**Montos con IVA incluido, redondeados hacia abajo al peso entero**; el descuento real es igual o mayor al indicado."
- Comparison:
  - "Del mes 1 al 4 pagas más que en Pro mensual ($997); desde el mes 6 pagas menos. En el primer año, Pro anual ($9,970) es lo más barato."
  - Then "Segundo año, si sigues: Pro Lealtad $7,968 · Pro anual $9,970 · Pro mensual $11,964". The $9,970 assumes it renews at that price (D20/D21).
  - Box label "Lo más barato el 1.er año" (was "El mejor precio…").
- Charge line: "**Se cobra hoy $1,662 MXN.** Después se cobra automáticamente cada mes el monto del calendario, hasta que canceles. Te avisamos por correo y en la app 7 días antes de cada cobro, con su monto y fecha."
- Reset box: amber, body size (≥ 14 px), next to the CTA, never an accordion. Text is `plans.lealtad.reset` below.
- Checkbox (unchecked) + button **"Pagar $1,662 y empezar Pro Lealtad"**, disabled until checked, with the hint "Marca la casilla para continuar." In the mockup they sit in the panel (one-step for a signed-in user).
  - In code they may live on the checkout sheet. The checkout block then adds the real dates (Law: "Hoy, 3 de octubre de 2026, se cobran $1,662 MXN a tu tarjeta terminación 4821 (mes 1 de Pro Lealtad). Después… 3 de noviembre de 2026: $1,495 · … · desde el 3 de abril de 2027: $664 MXN cada mes…").
  - A missing day of the month → the last day of that month (Términos 3.2).
- From Pro mensual/anual, the confirmation screen says: "Pro Lealtad empieza en el mes 1 ($1,662) al terminar tu periodo actual; tus meses en otro plan no cuentan."

**15.12.3 Checkbox (`checkout.lealtad.consent`, Law's exact text, mandatory, unchecked)**
> ☐ Acepto que Chalyb cobre **hoy $1,662 MXN** a mi tarjeta y después, **automáticamente cada mes**, $1,495, $1,329, $1,163, $997 y $831 MXN, y luego **$664 MXN al mes** mientras siga suscrito, hasta que cancele. Entiendo que **mi precio vuelve a empezar en $1,662** si cancelo, cambio de plan o un pago queda sin cubrir 7 días después de fallar, y acepto los [Términos de Suscripción](/suscripcion).

Button: **Pagar $1,662 y empezar Pro Lealtad**. Consent record `lealtad_started`: the rendered schedule with dates, the checkbox text, `UI_VERSION` (bumped).

**15.12.4 Law's 3 replacement strings (es; en pending: Pro Lealtad isn't sold in USD yet)**
| Key | es (exact) |
|---|---|
| `checkout.lealtad.consent` | §15.12.3 |
| `plans.lealtad.reset` | ⓘ **Tu precio vuelve a $1,662 si** cancelas (al terminar tu mes pagado), cambias a otro plan o un pago queda sin cubrir 7 días después de fallar. Cambiar de tarjeta, un reembolso o un contracargo no lo reinician. |
| `billing.lealtad.warn` (87) | Same reset rule as `plans.lealtad.reset` (Law: "update … to the reset rule above"). It replaces "Si cancelas o cambias de plan, pierdes tu descuento…" and so also covers ux §4.2's "Un reembolso o contracargo no lo reinicia." |

Related 87 strings:
- `billing.lealtad.step`: "Mes {n}: pagas {monto}, {pct}% menos que el mes 1."
- `billing.lealtad.progress`: "{pct}% menos que el mes 1 · Mes {n} · faltan {k}". The ticks are "Mes 1 … Mes 7+".
- `billing.lealtad.changeSub`: "Tu precio vuelve a empezar en $1,662". Law's ux §4.2 now uses this same wording (the "descuento" conflict is resolved).
- `billing.lealtad.cancelSub` (ux §4.2): "Sigues con Pro hasta el {fecha}. No habrá más cobros. Si vuelves después, Pro Lealtad empieza otra vez en $1,662." One line, [Sí, cancelar] visible, no extra step.

**15.12.5 Reset rules (replace the §15.4 reset rows), Términos 4 bis.4–4 bis.5**
| Trigger | Result |
|---|---|
| Cancel, effective at period end | Reset. Undo before period end → keeps the step |
| Switch / upgrade to any other plan (Pro mensual, Pro anual, VIP, VIP anual) | Reset; warned on each row and on the confirm page with the amount |
| Payment still unpaid **7 days after failing** | Reset (subscription ends). Paid within grace → the month counts |
| Refund (any type) | **No reset**; the month counts. Refund + cancel → the cancel rule |
| Chargeback filed / decided for the user | **No reset** |
| Chargeback decided for Chalyb, amount unpaid | Failed-payment flow (day 0 + day 5 notices, 7 days) → reset only after that |
| Card / payment-method change | No reset |
| Chalyb- or MP-side cause: notice hold (2.7 bis), MP error, failed amount PUT, plan modified/withdrawn, forced plan change | **Never resets** |
| Pause (if ever added) | Reset, disclosed in the pause dialog |
- **A reset ends the subscription.** Coming back = a **new** subscription + new preapproval at 166_200, with the schedule shown again and a **fresh checkbox**. There is no code path that raises `transaction_amount` on a running preapproval (Términos 4 bis.4: "nunca te cobraremos $1,662 MXN en una suscripción que ya está en marcha").
- **Plan withdrawn** (`lealtadOpenToNewCustomers = false`): hidden for new users. Existing subscribers **keep their schedule and step** (4 bis.3, art. 90 fr. I). Any increase goes through §5 (30 days + acceptance).
- Optional (Law-recommended, owner decision): a **30-day return window** that resumes the step after cancelling. Copy is ready in ux §4.2: "Si vuelves antes del {fecha_fin + 30 días}, retomas tu mes {n}."

**15.12.6 Notices (Términos 4 bis.6, ux §4.2)**
- **Signup confirmation email** (immediate). Subject "Tu Pro Lealtad empezó: tu calendario de cobros". It holds the full schedule with dates, the reset rule, how to cancel and `consent_id`.
- **Before every charge (months 2, 3, …, forever): email + in-app banner 7 days before**, with that month's amount, the date, the step, the next amounts and a cancel link.
  - Subject: "El {fecha_cobro} se cobran ${monto} MXN de tu Pro Lealtad (mes {n})".
  - From month 7 on: "Ya estás en tu precio más bajo: $664 MXN al mes mientras sigas."
  - Banner in 87: "El **8 de octubre de 2026** se cobran **$997 MXN** de tu Pro Lealtad (mes 5), 40% menos que tu mes 1. ¿No quieres seguir? Cancela antes de esa fecha y no se te cobra."
  - If Pro Lealtad is ever sold in the US: send 10 days before.
- **Delivery / hold:** a notice not delivered by charge − 5 days → hold the charge until 5 days after an effective notice (2.7 bis, same `holdDecision` as §16.3). **A hold never changes `loyalty_step`** and never counts as a missed month.
- **Failed payment:** emails on **day 0 and day 5** of the 7-day grace. Subject "No pudimos cobrar tu Pro Lealtad: tienes hasta el {fecha_limite} para conservar tu precio". The body states the reset consequence.
- Plus the yearly summary for monthly plans.

**15.12.7 Struck $1,662 on Pro mensual (R.5): Pro Lealtad does NOT support it**
- Pro Lealtad's month-1 $1,662 is the entry step of a different, concurrent product. It is not a former price of Pro mensual. Using it as support makes the reference look *more* fictitious (FTC 233.1, LFPC art. 32/46, Canada s.74.01(3)).
- **The strike on Pro mensual still depends only on the owner's evidence from the other site** (§16.5: same seller/RFC, same product, recent, label A, limited period). `SHOW_REFERENCE_PRICE` stays default false.
- Never cite Pro Lealtad in that evidence file. Pro Lealtad's % are always "menos que el mes 1", never a discount off a regular price.

**15.12.8 USD: open owner item.** Pro Lealtad isn't offered in USD until the owner fixes the amounts and the US/CA items are done. Law's derived figures, *only if* the base is US$84 (which §16.5 doesn't allow as a struck price): US$84, 75, 67, 58, 50, 42, then 33 (year 1 US$574, year 2 US$396). Quebec stays blocked.

**15.12.9 Mercado Pago: sandbox test required (Law R.7)**
- Can `PUT /preapproval/{id}` with a **lower** `auto_recurring.transaction_amount` be applied to a card-token preapproval **without payer re-authorization**? And does MP email the payer?
- Until verified, Pro Lealtad can't ship. The fallback (own charge job) was rejected in §15.6.
- Same sandbox session: pausing a preapproval for a notice hold without breaking the step (§16.3, OPS-14).

**15.12.10 Tests: Law's 13 checks (R.6), extending §15.9**
1. `lealtadPriceCents(0..6)` = 166_200, 149_500, 132_900, 116_300, 99_700, 83_100, 66_400.
   - `step > 6` stays 66_400.
   - Floor: `lealtadPriceCents(1) !== 149_600` and `lealtadPriceCents(6) !== 66_500`.
   - Real % ≥ advertised.
   - Linear, not compounding: `lealtadPriceCents(2) === 132_900` (not 134_600).
2. Totals: months 1–12 = 1_146_100; months 13–24 = 796_800.
3. Panel, checkout block, checkbox and confirmation email each contain:
   - all 7 amounts;
   - "hoy" + $1,662;
   - a renewal phrase ("cada mes" / "automáticamente");
   - the 3 reset triggers;
   - "redondeados hacia abajo";
   - and in the checkout block, a date per step.
   - Strings are built from `lealtadSchedule()`, never typed.
   - Banned: "gratis" (except "Sin prueba gratis"), "Precio regular", "descuento" without "mes 1".
4. Consent record `lealtad_started` stores the rendered schedule with dates, the checkbox text and the bumped `UI_VERSION`.
5. `planHasTrial('pro_lealtad') === false`.
6. `dueNotices()` for `pro_lealtad`: a mandatory notice 7 days before **every** charge, carrying `lealtadPriceCents(loyalty_step)` and the step number. Month 7+ notices still fire, with the floor text.
7. `holdDecision()` applies to Pro Lealtad. A hold never changes `loyalty_step` and never counts as a missed month.
8. Reset → **new** subscription/preapproval at 166_200 only after new consent:
   - cancel at period end → reset; undo-cancel → none;
   - plan change → reset;
   - unpaid after 7-day grace → reset; paid within grace → none, the month counts.
   - No code path raises `transaction_amount` on an existing preapproval.
9. Refund (any type, without cancel) → `loyalty_step` unchanged; the month counts. Refund + cancel → cancel rule.
10. Chargeback filed → no reset. Decided for the user → no reset. Decided for Chalyb and unpaid → failed-payment flow (day-0/day-5 notices, 7 days) → reset only after that.
11. Chalyb/MP-side failure (PUT failed, processor error, hold) → no reset.
12. MP amount gate (§15.6): accept expected, or step − 1 within 48 h; never above the base. An overcharge → access + automatic refund of the difference, with no effect on the step.
13. `lealtadOpenToNewCustomers = false` hides Pro Lealtad for new users but keeps existing schedules and steps.
- Added for the mockup copy: no "Revisión legal pendiente", "Precio regular" or "Sin descuento" string ships (checked against `html/86–88`).

**15.12.11 Still open (Pro Lealtad)**
- USD amounts (owner).
- MP lower-amount PUT without re-authorization (sandbox).
- Optional 30-day return window (owner).
- D21: Pro anual year-2 price.
- Law: whether PROFECO treats losing an accrued step as a "penalización" (Law: no precedent, interpretation only).
- ~~Name~~ resolved: Pro Lealtad (09:50).


---

## 16. Law review 2026-10-03 applied (supersedes §14 and the trial / badge / reference-price / footer parts of §0–§13)

Sources: `legal/PRICING-2026-10-03-REVISION.md` (Q1–Q7), `legal/aceptacion-ux.md` §3.2–§3.6, §4, §4.1, `legal/terminos-de-suscripcion.md`, `trial-to-paid-path.md`. Text in quotes below is **Law's exact copy**: don't paraphrase it, and bump `UI_VERSION` if it changes.

### 16.1 Trial: 7 days, Pro only
- **7 days** on **Pro mensual and Pro anual**. **No trial** on VIP, VIP anual or Pro Lealtad. One trial per account and per card (unchanged).
- Example: trial starts 3 oct 2026 → ends and charges **10 oct 2026**.
- Cards (80/81/83/84): chip "7 días gratis" · CTA **"Empezar mis 7 días gratis"** (EN "Start my 7-day free trial").
  - Monthly note: "**Hoy pagas $0.** El {fecha} se cobran $997 MXN y después cada mes, automáticamente. Cancela cuando quieras."
  - Annual note: "…se cobran $9,970 MXN por el año completo y se renueva cada año, automáticamente. Cancela cuando quieras."
  - Footnote: "Prueba Pro gratis 7 días: mensual o anual, una vez por cuenta y por tarjeta. VIP no tiene prueba."
- Banned strings anywhere in trial/charge UI and email: "mes gratis", "1 mes", "3 días", "30 días" (as trial length), "equivale".
- Code (P5 `src/config/pricing.ts`):
  - `PRICING.trial = { days: 7, reminderDaysBefore: 7 }`.
  - `planHasTrial(p)` → `p === 'pro_month' || p === 'pro_year'`.
  - Add the invariant `5 ≤ reminderDaysBefore ≤ days` to `assertReminderWindows`; a test that `days: 3` throws.
  - MP preapproval `auto_recurring.start_date = trial_start + 7 days`.

### 16.2 Checkout (consent evidence → `UI_VERSION` bump)
- **Never preselect the annual option in checkout.** Preselect Pro mensual, or nothing (Law: preselecting a $9,970 charge after only 7 days raises chargeback risk). The **cards' toggle may still default to Anual**: it's a price display, not consent. Law only restricts checkout (aceptacion-ux §3.1 note).
- Charge block next to the button: aceptacion-ux §3.2, verbatim, with `{periodicidad}` / `{renovacion}` / `{ultimos4}`.
  - "o paga mes a mes: $997 MXN al mes (plan mensual)" may appear **only on the price cards**. Never in the charge block, never next to the checkbox (Q5).
- **Mandatory checkbox, unchecked by default:**
  > ☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {y cada mes después | y cada año después} a mi tarjeta, y acepto los [Términos de Suscripción](/suscripcion).
- EN:
  > ☐ I agree that unless I cancel before **{charge_date}**, Chalyb will automatically charge **US${amount}** {and every year after|and every month after} (plus applicable sales tax) to my card, and I accept the [Subscription Terms](/subscription).
  - Canada: replace "sales tax" with "GST/HST (and QST in Quebec)". This needs Law's OK.
- Button **"Empezar mis 7 días gratis"** stays disabled until the box is checked.
  - On an attempt without the box checked: "Marca la casilla para confirmar el cobro automático. Puedes cancelar cuando quieras."
- MP card screen, above the Brick: "Hoy pagas **$0**. Primer cobro: **${monto} MXN** {cada mes|por 1 año} el **{fecha_cobro}**, salvo que canceles antes."
  - Below the Brick: "Pago seguro con Mercado Pago. Chalyb no guarda el número de tu tarjeta."
- Confirmation screen: aceptacion-ux §3.6 ("¡Listo, {nombre}! Tus 7 días de Pro gratis ya empezaron. …").

### 16.3 Day-0 charge notice = confirmation (the only pre-charge email)
- **Owner:** no reminder emails (Apple-style). **Law:** ONE charge notice, sent on day 0, is mandatory (≥ 5 calendar days before the charge, LFPC art. 76 Bis VIII). They are merged: **one email, sent immediately on trial activation.** It is the legal charge notice and also the confirmation/receipt with how to cancel.
- Subject: **"Aviso de cobro: el {fecha_cobro} se cobrarán ${monto} MXN si no cancelas"**. Body: aceptacion-ux §3.6, verbatim. It includes:
  - start and end dates; "Hoy pagaste $0";
  - amount, plan, card ••{ultimos4}, renewal; "Faltan 7 días";
  - for annual only, the switch-to-monthly link;
  - the 1-click cancel link; document versions; `consent_id`.
- EN subject: "Charge notice: you'll be charged US${amount} on {charge_date} unless you cancel".
- ⚠ **Conflict to resolve with the owner:** the owner asked to merge this with the *welcome* email. Law says "**no mezclar con bienvenida ni marketing**". So the merge is notice + confirmation/receipt only. No onboarding tips, product tour or promos in this email. Any welcome content goes in a separate email or in the app (the confirmation screen already has [Hacer mis primeros clips]).
- **Hold rule:**
  - Deadline: the notice must be recorded as **delivered by day 2** (5 days before the charge).
  - If it bounces or isn't confirmed:
    - show an amber in-app banner;
    - try another channel;
    - **hold the charge until 5 calendar days after an effective notice** (Términos 2.7 bis). The user keeps Pro at no cost meanwhile.
  - Code already in P5:
    - `src/lib/billing/reminders.ts` → `holdDecision` / `HOLD_LOOKAHEAD`;
    - subscription fields `reminder_delivered_at`, `charge_hold_until`;
    - Resend webhook `src/app/api/resend/webhook/route.ts` → `email_dispatches.bounced_at`;
    - daily billing cron (15:00 UTC = 09:00 CDMX) → MP `PUT /preapproval/{id}` with `status: paused`, then `authorized`.
  - Change for 7 days: the delivery deadline = `charge_date − 5 days` (day 2), and the hold window = `effective_notice + 5 days`.
  - **MP sandbox check required (OPS-14):**
    - can a preapproval in its trial period (before the first charge) be `paused` and later `authorized` without MP charging on the original `start_date`?
    - when resuming after `next_payment_date`, does MP charge immediately, skip, or need a new `start_date`?
    - Until verified, the fallback is cancel + recreate the preapproval with a new `start_date`. Ask Law whether that needs a new consent.

### 16.4 Reminders
| Notice | Status |
|---|---|
| Day 0 charge notice (§16.3) | **Mandatory, ON** |
| Day 6 "Mañana termina tu prueba gratis" (email + amber banner, aceptacion-ux §4 row 2) | **OFF (owner, Apple-style). Optional:** Law *recommends* it, **strongly for Pro anual ($9,970)**. Ship behind `TRIAL_DAY6_REMINDER=false` so it's a config flip |
| Monthly renewals: 7 days before | ON (unchanged) |
| Annual renewals (Pro anual, VIP anual): 30 + 7 days before (7 mandatory) | ON (unchanged) |
| Yearly summary for monthly plans (California §17602(h), conservative) | ON, once a year |
| Price change: exactly 30 days before + 7-day reminder | ON (§16.8) |

### 16.5 Reference price $1,662: behind `SHOW_REFERENCE_PRICE`
- The owner chose it, and Law says it's **conditionally allowed**. It stays in the design but only renders when `SHOW_REFERENCE_PRICE=true` (default **false**). Mockup 81 shows it on; 85 shows the fallback.
- **Label A (Law's wording):**
  - struck ~~$1,662~~;
  - "Precio anterior en **{sitio}** hasta el **{fecha}**. Aquí pagas 40% menos.";
  - "Precio de lanzamiento vigente hasta el **{fecha_fin_promo}**."
  - 40% is computed (40.01% floored). No standalone "40% de descuento" pill.
- **Limited, stated period:** show it for a fixed window. Law's example is up to **90 days after the $1,662 price ended**. Then the flag turns off automatically: `REFERENCE_PRICE_UNTIL` date, checked server-side.
- Consider hiding it from logged-in grandfathered subscribers (they pay $749).
- **Flag off fallback:** "Precio de lanzamiento: $997 MXN al mes". **USD:** "Launch price: US$50/month", **never** a struck US$84 (`USD_REF = {}`).
- **Evidence checklist (owner must supply before the flag can be turned on):**
  1. Dated screenshots / Wayback captures of the other site showing $1,662 MXN for this Pro plan, with the period it was charged.
  2. Processor exports (MP / Stripe) showing real charges at $1,662.
  3. CFDI invoices issued at $1,662.
  4. **Same RFC / legal entity** as chalyb.com (otherwise it's another provider's price → not allowed).
  5. **Same product:** tools, credits/limits, monthly period, currency, **IVA included**. A side-by-side of the plan descriptions.
  6. The offer was open to the public, not a private quote.
  7. Offer period published on chalyb.com (start/end).
  8. Records showing the price decision was made before launch.
  9. Retain all of it for 10 years.
- Values for `{sitio}`, `{fecha}`, `{fecha_fin_promo}` are owner placeholders (yellow in 81).
- Tests:
  - when the flag is on, the label contains the site and date;
  - no USD reference price exists;
  - `discountPct(166_200, 99_700) === 40` and `discountPct(166_000, 99_700) === 39` guards stay;
  - `tests/public-site.test.ts:175-182` (bans `line-through|<s>|<del>` on the landing) must allow the strike **only** inside the flagged component, or the landing keeps the fallback.

### 16.6 Badge
- "Mejor oferta" / "Best value" → **"Más popular" / "Most popular"** on Pro, in every mode (Law Q3: an unexplained superlative on a 16% plan next to VIP's 20% is risky).
- "Más popular" is also a factual claim. Keep data showing Pro is the most-chosen paid plan (e.g. share of paid signups in the last 90 days). If that data doesn't exist yet, use "Recomendado".
- "Ahorra hasta 20%" pill: OK as a maximum.
- `proIsBestDeal` no longer gates the badge. Replace it with `badgeFor(plan)`.

### 16.7 Tax footers
- MX: "Precios en MXN, IVA incluido." (needs `PRICES_INCLUDE_IVA=true`, §13.2).
- US (84): "Prices in US dollars. Sales tax, if any, is added at checkout and shown before you pay."
- Canada (84b): "Prices in US dollars (USD). GST/HST and, in Quebec, QST are added where applicable and shown before you pay." The Canada card notes say "plus applicable GST/HST (and QST in Quebec)".
- Select by billing country (geo-IP for display; the billing address decides).
- Quebec rules still apply (trial / price-change notices, French copy, OPC). See Law's file. The accountant must confirm GST/HST/QST registration.

### 16.8 Price-increase flow for existing subscribers (mockup 89)
- Who: Pro $749 → $997; VIP $2,499 → $3,799. Grandfathered amounts recognised: Pro `[74_900, 86_884]`, VIP `[249_900, 289_884]`.
- When:
  - notice **exactly 30 days** before the renewal where the new price applies: not 29 (Quebec), not 31 (CA / NY);
  - reminder **7 days before** if there's no answer.
- Channels: email (aceptacion-ux §4.1) + in-app modal (mockup 89, shown at next login until answered).
- Modal copy (verbatim):
  - title **"Cambia el precio de tu plan Pro"**;
  - "Hoy pagas $749 MXN al mes. A partir del 2 de noviembre de 2026: **$997 MXN al mes**, IVA incluido.";
  - "Solo se te cobrará si lo aceptas. Si no, conservas Pro hasta el 2 de noviembre de 2026 y después pasas a Gratis, sin cobro.";
  - buttons [Acepto el nuevo precio] · [No, gracias] · [Cancelar mi plan].
  - Mockup adds a $749 → $997 "+33%" visual (33.1% floored) and "Te lo recordamos el 26 de octubre de 2026 si aún no decides."
- **No express acceptance → no charge at the new price.**
  - **Owner decision (a)/(b):** (a) the plan doesn't renew → Gratis at period end (rendered; Términos §5.3), or (b) the user keeps paying $749.
  - `build_aviso.py` has `OPTION="a"|"b"` and swaps the sentence to "Si no, seguirás pagando $749 MXN al mes."
- Code:
  - consent events `price_change_notice_sent` / `_accepted` / `_declined` (already in P5);
  - store the shown text + `UI_VERSION`;
  - on accept → MP `PUT /preapproval/{id}` `transaction_amount` effective on the next cycle;
  - on decline/no answer (a) → set `cancel_at_period_end`;
  - cancel must never be blocked.
- Tests:
  - the notice date = renewal − 30 days exactly (also at month ends / DST);
  - no charge at the new price without an `_accepted` event;
  - reminder at −7 days only if unanswered.

### 16.9 VIP anual (Law Q4)
- No trial; charged on the day of purchase.
- Checkout copy:
  > **Hoy se cobran $36,325 MXN** (IVA incluido) por 1 año de VIP a tu tarjeta terminación **{ultimos4}**. Se renovará automáticamente el **{fecha_renovacion}** y cada año después por $36,325 MXN hasta que canceles. Te avisaremos 30 y 7 días antes. Cancela en 1 clic desde Mi cuenta → Mi plan; conservas VIP hasta el final del año pagado.
- Own checkbox (unchecked, mandatory):
  > ☐ Acepto el cobro de $36,325 MXN hoy y su renovación automática cada año, y acepto los [Términos de Suscripción](/suscripcion).
- `plan_id = 'vip_year'`; the consent record stores the exact text.
- Plan changes:
  - VIP → VIP anual: immediate, with credit for the unused month;
  - VIP anual → VIP: at the end of the year;
  - no pro-rata refund except Términos §7.3.
- Card ref line: we use Law's Q5 wording "o paga mes a mes: $3,799 MXN al mes (plan mensual)". Law's Q4 card example still says "o $3,799 MXN al mes en plan mensual"; ask Law to confirm the Q5 wording covers VIP too.

### 16.10 `UI_VERSION`
Bump `src/lib/billing/consent.ts` `UI_VERSION` from `'rebuild-p2'` to `'rebuild-p5-law-2026-10-03'`. The consent record stores:
- disclosure text, checkbox text, `trial_days: 7`;
- plan (`pro_month` / `pro_year` / `vip_year`), amount, currency, tax country, `SHOW_REFERENCE_PRICE` state.

### 16.11 Pro Lealtad (86–88): ~~Law review pending~~ → **reviewed 09:17, see §15.12** (the draft checkbox below is superseded by Law's text in §15.12.3)
Law did not review Pro Lealtad. The mockups carry a yellow "Revisión legal pendiente · Pro Lealtad" tag. The same patterns are applied so the review is about the concept, not the copy:
- No trial. Charged today $1,662.
- Card note: "Se renueva cada mes, automáticamente. Te avisamos por correo 7 días antes de cada cobro, con el monto."
  - The monthly 7-day renewal notice carries **that month's step amount** (the amount changes every month, which makes the notice essential).
- Staircase month 1 is labelled "Sin descuento", not "Precio regular" (Law Q2 risk: $1,662 isn't proven as a regular price).
- Draft checkbox (unchecked, mandatory; **for Law**):
  > ☐ Acepto el cobro de $1,662 MXN hoy y los cobros automáticos de cada mes después: $1,495, $1,329, $1,163, $997, $831 y después $664 MXN al mes mientras siga, y acepto los [Términos de Suscripción](/suscripcion). Si cancelo o cambio de plan, el precio vuelve a $1,662 MXN.
- Open for Law:
  - whether $1,662 as the Pro Lealtad base needs the §16.5 evidence (it isn't struck, but it's the "0%" anchor);
  - whether "60% menos" is an art. 32 comparative claim;
  - the reset-on-cancel rule;
  - the Terms clause for a decreasing schedule;
  - the name.

### 16.12 Tests to add (Law's list + this section)
- `trialDates(start)` → end = charge = start + 7 days.
- `dueNotices`: day 0 notice only; day 6 only when `TRIAL_DAY6_REMINDER`.
- `holdDecision`:
  - delivered by day 2 → charge;
  - bounced → hold;
  - no confirmation by day 2 → hold;
  - re-notified on day 4 → charge on day 9.
- Email template snapshot: the subject uses `{fecha_cobro}` + `{monto}`; no welcome/marketing blocks.
- Banned phrases (§16.1) across `messages/*.json` + email templates.
- Billing-core:
  - CTA "Empezar mis 7 días gratis";
  - checkbox unchecked by default; button disabled;
  - no annual preselection in checkout.
- No "o paga mes a mes" string inside checkout components.
- VIP anual consent text equality.
- Price change: 30 days exactly; no charge without acceptance.

### 16.13 Still needs the owner
D20 ($9,970 first-year promo vs standing price) · D21 (Pro Lealtad vs anual in year 2) · $1,662 evidence + `{sitio}` / `{fecha}` / promo end date · price-increase option (a)/(b) · data backing "Más popular" · day-6 reminder stays OFF despite Law's recommendation (esp. annual) · welcome content kept out of the day-0 email · MP sandbox pause/resume during trial + preapproval amount PUT (Pro Lealtad, price change) · accountant: IVA included, US sales tax / CA GST-HST-QST · Pro Lealtad: USD amounts (§15.12.8) + MP lower-amount PUT sandbox test + optional 30-day return window · D18 (Pro 16% vs VIP 20%, now less pressing with "Más popular").
