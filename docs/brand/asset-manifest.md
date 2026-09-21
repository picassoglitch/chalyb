# Brand assets — what the app needs, exactly

Everything the codebase loads as brand artwork, with the format and size each
consumer actually renders at. Hand this to whoever produces the assets.

Written against the identity replacing the Nexo-era artwork. **Both marks in
the repo today are pre-rebrand**: `public/chalybclip-mark.png` is the NexoClip
"NC" monogram with only the filename changed, and the platform mark in
`icon.svg` / `brand-mark.tsx` / `fusion-mark.tsx` is the Nexo **N** — the
comment in `fusion-mark.tsx` says "N-path" outright, while `icon.svg` calls
the same geometry a "Chalyb 'C'". Neither is a Chalyb asset.

---

## Read this before drawing anything

Four constraints come from how the code uses the artwork, not from taste.
Getting them wrong means assets that have to be redrawn.

**1. The nav mark is tinted by CSS, so it cannot be multi-colour.**
`brand-mark.tsx` strokes with `stroke="currentColor"` and the nav and footer
set the colour. A gradient cannot inherit `currentColor`. Supply a **flat
single-colour** version of the mark (one colour, no gradient, no inner detail)
for that slot — or say explicitly that the nav should carry the full-colour
mark instead, and the tinting gets removed.

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
`--cc-green` button. Acid green carries dark text at ~11:1 contrast. A mid
indigo will not — it needs light text, which is a component change, not a
token swap. Flag which way the new primary goes.

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
| B2  | `src/app/icon.svg`            | **SVG**                   | Square viewBox         | Draws its own rounded dark tile (currently `rx=40` on a 200×200 box)                                                                              |
| B3  | `public/apple-touch-icon.png` | **PNG**                   | **180×180**            | **Opaque — iOS composites transparency onto white.** Keep ~10% padding inside the square; iOS rounds the corners itself, so do not pre-round them |

B2 can be a **512×512 PNG** instead if the mark is too complex to hand-tune as
a small SVG — Next accepts `icon.png` in the same slot.

Optional, only if a PWA manifest is ever added (there is none today):
`icon-192.png` and `icon-512.png`, opaque, plus a maskable variant with 20%
safe padding.

## C. Social preview — currently missing entirely

The app has **no** `opengraph-image` or `twitter-image`, so links to
chalyb.com unfurl with no image at all. This is the one slot the mockup render
fits as-is.

| #   | Destination path              | Format     | Size         | Limit  |
| --- | ----------------------------- | ---------- | ------------ | ------ |
| C1  | `src/app/opengraph-image.png` | PNG or JPG | **1200×630** | < 8 MB |
| C2  | `src/app/twitter-image.png`   | PNG or JPG | **1200×630** | < 5 MB |

Same file can serve both. The render supplied is **1024×559** — re-export at
1200×630 rather than upscaling. Keep the wordmark and URL out of the outer
~5%: every platform crops these differently.

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

D2 and D3 are **optional**: those engines currently render Lucide glyphs
(`Video`, `CandlestickChart`) and look fine. Supply them only if each engine
gets its own mark in the new system.

The five catalogue engines — ChalyStreamManager, ChalyBot, ChalyPicks,
ChalyRealtor, ChalyTrade — also use Lucide glyphs and have no product behind
them yet. Not worth drawing now.

Filenames keep the `b`: they are wire values, like the slug and the hostname.
See `src/lib/engines/display-names.ts`.

## E. Colour tokens

`--cc-green` alone appears in **147 places** across `src/`. The tokens live in
`src/app/[locale]/(dashboard)/dashboard/dashboard.css:27-53`. I need hex
values for these — the rest of the palette is semantic and stays put:

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
- Three hardcoded hexes also need updating: `fusion-mark.tsx:17,21,26-27`,
  `icon.svg:8,13,19`, and the confetti palette in `confetti.tsx:22`.

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
