# Brand assets — what the app needs, exactly

Everything the codebase loads as brand artwork, with the format and size each
consumer actually renders at. Hand this to whoever produces the assets.

## Status

Every slot below is **filled**, derived from the supplied 3D logo render — a
379×338 fully-opaque PNG whose emblem measures 275×275, with the grey gradient
backdrop keyed out by modelling it from the four corners and subtracting. The
Nexo-era artwork is gone: `public/chalybclip-mark.png` was the NexoClip "NC"
monogram with only the filename changed, and the platform mark was the Nexo
**N** (`fusion-mark.tsx` called its own geometry the "N-path", while
`icon.svg` described the identical path as a "Chalyb 'C'").

**What is still owed, and why it matters:**

| Gap                       | Consequence today                                                            |
| ------------------------- | ---------------------------------------------------------------------------- |
| No vector master          | Every asset is a 275px raster upscaled to its slot. The 512px ones are soft. |
| No simplified small cut   | The favicon is a blur at 16px. It only reads from ~48px up.                  |
| No flat single-colour cut | `BrandMark` lost its `currentColor` tinting and is now an `<Image>`.         |
| No wordmark file          | The social image sets `CHALYB` in Bricolage Grotesque, not the real face.    |

Sections A–F below are unchanged: they are still the ask. Supplying them
replaces the derived assets in place — the paths and sizes do not move.

The derivation is reproducible; the script is recorded in the commit that
added these assets.

---

## Read this before drawing anything

Four constraints come from how the code uses the artwork, not from taste.
Getting them wrong means assets that have to be redrawn.

**1. The nav mark was tinted by CSS, so it cannot be multi-colour.**
`brand-mark.tsx` stroked with `stroke="currentColor"` and the nav and footer
set the colour. A gradient cannot inherit `currentColor`, so that component is
now an `<Image>` and the tinting is gone. Supplying a **flat single-colour**
cut (one colour, no gradient, no inner detail) puts it back.

**2. The mark has to survive 20 px.** It renders at **20 px** in the landing
footer, **26 px** in the nav and both sidebars, and **16 px** in the favicon.
A multi-strand gradient knot turns to mud at that size. The small sizes need a
**simplified mark** — fewer strands, heavier strokes, no gradient — not a
scaled-down master. Expect to draw two: full detail for large, simplified for
≤32 px.

**3. Engine tiles are `object-cover`, so those marks need their own
background.** `engine-glyph.tsx` renders the mark filling a square tile with
`fill` + `object-cover`; the current file bakes in `#03040b`. Either supply
them with an opaque square background, or tell me and I'll change the
component to letterbox a transparent mark instead.

**4. The brand colour is a button background with near-black text on it.**
`engine-hero.tsx` sets `INK = '#0a0c0e'` as the label colour on a solid
brand-coloured button, and `.lp-btn-primary` does the same on the landing.
This is why the primary slot went to the emblem's **gold** and not its indigo
— see section E for the measured ratios. Any future change to the primary has
to clear that bar or change every such button to light text.

---

## A. Master vector — the source everything else is cut from

| #   | What                                  | Format  | Notes                                                                                     |
| --- | ------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| A1  | Mark only, full colour                | **SVG** | Square viewBox, transparent background, no text. Live vector paths — not an embedded PNG. |
| A2  | Mark only, flat single colour         | **SVG** | One `fill`/`stroke`, no gradient. Feeds the `currentColor` slots (constraint 1).          |
| A3  | Mark only, simplified for small sizes | **SVG** | The ≤32 px cut (constraint 2).                                                            |
| A4  | Lockup — mark + `CHALYB` wordmark     | **SVG** | Horizontal. Transparent.                                                                  |
| A5  | Wordmark alone                        | **SVG** | Transparent.                                                                              |

If the master exists as AI/Figma, an SVG export of each is what the repo
needs. Please outline text to paths so the wordmark does not depend on a font
being installed.

## B. Icons

| #   | Destination path              | Format                    | Size                   | Background                                                                                                                                        |
| --- | ----------------------------- | ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `src/app/favicon.ico`         | **ICO**, multi-resolution | 16, 32, 48 in one file | **Opaque** dark                                                                                                                                   |
| B2  | `src/app/icon.png`            | **SVG** (or PNG)          | Square viewBox         | Draws its own rounded dark tile. Was `icon.svg`; now a 512×512 PNG, so an SVG here would be an upgrade                                            |
| B3  | `public/apple-touch-icon.png` | **PNG**                   | **180×180**            | **Opaque — iOS composites transparency onto white.** Keep ~10% padding inside the square; iOS rounds the corners itself, so do not pre-round them |

B2 is a **512×512 PNG** today, which is what the current render supports. An
SVG is still preferable — Next accepts either at that path.

Optional, only if a PWA manifest is ever added (there is none today):
`icon-192.png` and `icon-512.png`, opaque, plus a maskable variant with 20%
safe padding.

## C. Social preview

The app had **no** `opengraph-image` or `twitter-image` at all, so links to
chalyb.com unfurled with no image. Both now exist, composed from the emblem
plus a `CHALYB` wordmark set in Bricolage Grotesque — a stand-in for the real
face (section F).

| #   | Destination path              | Format     | Size         | Limit  |
| --- | ----------------------------- | ---------- | ------------ | ------ |
| C1  | `src/app/opengraph-image.png` | PNG or JPG | **1200×630** | < 8 MB |
| C2  | `src/app/twitter-image.png`   | PNG or JPG | **1200×630** | < 5 MB |

One file serves both. Keep the wordmark and URL out of the outer ~5%: every
platform crops these differently.

Optional: `opengraph-image.alt.txt` beside it, one line of alt text.

## D. Engine marks

`public/chalybclip-mark.png` is **512×512** and is loaded by three consumers at
three sizes: the tile in `engine-glyph.tsx` (≈64 px square, `object-cover`),
the hero on the engine page (**160×160**), and the generated tab icon in
`app/engines/[slug]/icon.tsx` (**64×64**).

| #   | Engine      | Destination                    | Format                   | Size        |
| --- | ----------- | ------------------------------ | ------------------------ | ----------- |
| D1  | ChalyClip   | `public/chalybclip-mark.png`   | PNG (+ SVG if available) | **512×512** |
| D2  | ChalyOBS    | `public/chalybobs-mark.png`    | PNG                      | 512×512     |
| D3  | ChalyCrypto | `public/chalybcrypto-mark.png` | PNG                      | 512×512     |

**⚠ ChalyClip currently shows the PLATFORM emblem.** The supplied render is
the Chalyb mark, and it was put in `chalybclip-mark.png` because the
alternative was leaving NexoClip's "NC" in place. The consequence is that the
ChalyClip tile and the Chalyb favicon are the same picture, which reads as a
bug rather than a brand. Two ways out, both cheap: give ChalyClip its own mark
(D1 below), or drop it to a Lucide glyph like every other engine — a one-line
change in `engine-glyph.tsx`.

D2 and D3 are **optional**: those engines currently render Lucide glyphs
(`Video`, `CandlestickChart`) and look fine. Supply them only if each engine
gets its own mark in the new system.

The five catalogue engines — ChalyStreamManager, ChalyBot, ChalyPicks,
ChalyRealtor, ChalyTrade — also use Lucide glyphs and have no product behind
them yet. Not worth drawing now.

Filenames keep the `b`: they are wire values, like the slug and the hostname.
See `src/lib/engines/display-names.ts`.

## E. Colour tokens

`--cc-green` alone appears in **147 places** across `src/`. Values were sampled
from the emblem and are now set in two places —
`dashboard.css` (`--cc-brand*` / `--cc-accent*`) and `globals.css`
(`--brand*`, plus the Tailwind v4 `@theme` colours). The old names are kept as
aliases so those 147 call sites did not have to churn alongside the artwork.

| Slot          | Was                   | Now           | Why                               |
| ------------- | --------------------- | ------------- | --------------------------------- |
| primary       | `#9eea3a` / `#c6f24e` | **`#f7ce87`** | the emblem's gold highlight       |
| primary hover | `#7bc220` / `#8aa83a` | **`#dda670`** | its gold body                     |
| accent        | `#42d9e8` / `#3df5e0` | **`#8ea2e8`** | its indigo, lifted for legibility |

**Gold, not indigo, carries the primary slot.** Both `.lp-btn-primary` and
`engine-hero.tsx` fill with the brand colour and put near-black text _on_ it.
Measured against that ink: gold `#f7ce87` gives **13.2:1** — near-identical to
the acid green's 13.3:1, so no component changed — while the emblem's indigo
`#383f89` gives **2.1:1** and would have forced every such button to light
text. If the brand insists on an indigo primary, that is the work it implies.

Original ask, for reference:

| Token          | Today                   | Needs                                            |
| -------------- | ----------------------- | ------------------------------------------------ |
| `--cc-green`   | `#9eea3a`               | Brand primary — buttons, active nav, live badges |
| `--cc-green-d` | `#7bc220`               | Its hover/pressed shade                          |
| `--cc-green-g` | `rgba(158,234,58,0.18)` | Its glow — same hue, ~18% alpha                  |
| `--cc-cyan`    | `#42d9e8`               | Secondary accent                                 |
| `--cc-cyan-g`  | `rgba(66,217,232,0.16)` | Secondary glow                                   |

Also needed:

- **Does the background move?** Today it is near-black (`--cc-bg: #070809`
  through `--cc-bg-3: #111418`). The render reads dark navy. If it moves, I
  need all four, plus the three border greys (`--cc-line*`).
- **Button text colour**, per constraint 4 above.
- `--cc-purple`, `--cc-amber`, `--cc-red` are **status** colours (paused,
  warning, error). They stay unless the new system defines its own.
- Hardcoded hexes were updated too: the confetti palette (`confetti.tsx`), the
  email accent (`lib/email/templates.ts`), the landing hero's chart gradient
  (`landing/hero.tsx`), a message bubble border, and the inline `rgba()` glows
  in both stylesheets. `fusion-mark.tsx` and `icon.svg` no longer hold any —
  the first renders an `<Image>`, the second is deleted.

## F. Type

The app loads **Familjen Grotesk**, **Space Mono** and **Fraunces** from
Google Fonts (`src/app/[locale]/layout.tsx:61`). The dashboard CSS additionally
names Space Grotesk and JetBrains Mono as fallbacks.

If the new wordmark uses a different face, I need its **name and licence** —
and whether it is only for the wordmark (then A5 outlined to paths is enough,
nothing to load) or for UI text too (then it has to be self-hosted or on
Google Fonts, and the `<link>` changes).

---

## Checklist to hand over

Minimum to do the swap:

- [ ] A1, A2, A3 — mark as SVG: full colour, flat, simplified-small
- [ ] A4, A5 — lockup and wordmark as SVG, text outlined
- [ ] B1 — `favicon.ico` at 16/32/48, opaque
- [ ] B3 — 180×180 opaque PNG for iOS
- [ ] C1 — 1200×630 social image
- [ ] D1 — 512×512 ChalyClip mark
- [ ] E — hex values for the five brand tokens, plus a yes/no on the background
- [ ] F — wordmark typeface name, if it is not one of the three already loaded

Nice to have: D2/D3, the PWA icon sizes, `opengraph-image.alt.txt`.
