# Brand assets — what the app needs, exactly

Everything the codebase loads as brand artwork, with the format and size each
consumer actually renders at. Hand this to whoever produces the assets.

## Status

Every slot is **filled** from a single master: `logo-master.png` in this
folder, the mark supplied already cut out on transparency. Run
`scripts/build-brand-assets.py` to regenerate the lot.

The Nexo-era artwork is gone: `public/chalybclip-mark.png` was the NexoClip
"NC" monogram with only the filename changed, and the platform mark was the
Nexo **N** (`fusion-mark.tsx` called its own geometry the "N-path", while
`icon.svg` described the identical path as a "Chalyb 'C'").

**Because the master is transparent, there is no background-keying step at
all** — every asset is a resize. An earlier revision worked from an opaque
render and needed a flood fill with a hand-tuned threshold, a second pass for
the drop shadow, and still left a grey arc along one edge that could not be
removed (the shadow and the silver ring were the same grey, so no colour rule,
connected-component pass or radial cutoff could separate them). Keep it this
way: if a new mark arrives on a background, ask for a PNG with alpha before
anyone writes code to cut it out.

**What is still owed, and why it matters:**

| Gap                       | Consequence today                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No vector master          | Every asset is a raster downscale from a 281px mark. Fine at the sizes the app uses, but it cannot be recoloured, and there is nothing more to show on a 4K display. |
| No flat single-colour cut | `BrandMark` lost its `currentColor` tinting and is now an `<Image>`.                                                                                                 |
| No simplified small cut   | The mark goes soft at 16px — strands blur together, the centre star is lost. Measured on both a light and a dark tab. 32px and 48px read fine.                       |
| No wordmark file          | The social image sets `CHALYB` in Liberation Sans, not the real face.                                                                                                |

Sections A–F below are unchanged: they are still the ask. Supplying them
replaces the derived assets in place — the paths and sizes do not move.

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
The current master clears 32 px and 48 px but **not 16 px** — its strands blur
together and the centre star is lost, measured on both a light and a dark tab.
The fix is a **simplified cut** for ≤32 px (A3): fewer strands, heavier
strokes, no gradient — drawn for the size, not scaled down to it.

**3. Engine tiles are square, so a square mark needs no background.**
`engine-glyph.tsx` renders the mark filling a square tile with `fill` +
`object-cover`. Because both the image and the box are square, `object-cover`
and `object-contain` are equivalent — a transparent mark simply lets the card
behind it show. Supply engine marks square and transparent; anything
non-square would get cropped rather than letterboxed.

**4. The brand colour is a button background with near-black text on it.**
`engine-hero.tsx` sets `INK = '#0a0c0e'` as the label colour on a solid
brand-coloured button, and `.lp-btn-primary` does the same on the landing.
This is why the primary slot went to the mark's **gold** and not its indigo
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

| #   | Destination path              | Format                    | Size                   | Background                                                                                                                                      |
| --- | ----------------------------- | ------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `src/app/favicon.ico`         | **ICO**, multi-resolution | 16, 32, 48 in one file | **Transparent** — composites onto the tab's own colour, light or dark                                                                           |
| B2  | `src/app/icon.png`            | **SVG** (or PNG)          | Square viewBox         | **Transparent**, same as B1. Was `icon.svg` drawing its own dark tile; that tile is gone                                                        |
| B3  | `public/apple-touch-icon.png` | **PNG**                   | **180×180**            | **Opaque white** — iOS composites transparency onto a colour of its own choosing, so this picks one. ~8% padding; iOS rounds the corners itself |

B2 is a **256×256 transparent PNG** — 256 rather than 512 because the master
mark is 281px, so anything larger is an upscale. Every consumer renders well
below that (160px at the largest, the engine hero). An SVG is still
preferable: it would stay sharp at any size, and Next accepts either here.

Optional, only if a PWA manifest is ever added (there is none today):
`icon-192.png` and `icon-512.png`, opaque, plus a maskable variant with 20%
safe padding.

## C. Social preview

The app had **no** `opengraph-image` or `twitter-image` at all, so links to
chalyb.com unfurled with no image. Both now exist, composed from the emblem
plus a `CHALYB` wordmark set in Liberation Sans — a stand-in for the real face
(section F).

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

**⚠ ChalyClip shows the PLATFORM mark.** There is one mark in the system and
ChalyClip's tile uses it, because the alternative was leaving NexoClip's "NC"
in place. So the tile and the browser tab are the same picture. Two ways out,
both cheap: give ChalyClip its own mark (D1 below), or drop it to a Lucide
glyph like every other engine — a one-line change in `engine-glyph.tsx`.

The tile is transparent now: it is a square image in a square box, so
`object-cover` and `object-contain` are equivalent and the card behind simply
shows through. Nothing bakes its own dark tile any more.

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
| primary       | `#9eea3a` / `#c6f24e` | **`#e8bb7f`** | the mark's warm strands, measured |
| primary hover | `#7bc220` / `#8aa83a` | **`#be8c66`** | their deeper tan                  |
| accent        | `#42d9e8` / `#3df5e0` | **`#8ea2e8`** | its indigo, lifted for legibility |

**Gold, not blue, carries the primary slot.** Both `.lp-btn-primary` and
`engine-hero.tsx` fill with the brand colour and put near-black text _on_ it.
Measured against that ink: gold `#e8bb7f` gives **11.1:1**, comfortably clear
of the 4.5:1 bar, so no component changed — while the mark's indigo `#373e7f`
gives **2.0:1** and would have forced every such button to light text. If the
brand insists on an indigo primary, that is the work it implies.

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
