#!/usr/bin/env python3
"""Derive every brand asset from the master logo render.

    python3 scripts/build-brand-assets.py [path/to/render.jpg]

Defaults to docs/brand/logo-master.jpg, which is committed so this is
reproducible without hunting for the original file.

The render is a 2000x2000 opaque JPEG: the emblem sits on a near-uniform light
grey backdrop with a soft drop shadow. Getting it onto transparency is the
whole job, and it is fiddlier than it looks:

  - A brightness key does not work. The backdrop is LIGHT (lum ~224) and the
    emblem contains the brightest pixels in the frame (the white star, at 255)
    as well as large desaturated silver areas that sit right in the backdrop's
    range. No single cutoff separates them.
  - A saturation key does not work either, for the same reason: the silver
    ring and the star are as desaturated as the backdrop.

So it floods from the four corners instead, which keys on CONNECTEDNESS rather
than colour: the backdrop is one connected region, and the emblem's interior
silver is enclosed by its own outline and never reached. Threshold 48 is
load-bearing — measured, at 60 the flood breaks through the outline and eats
the gold strand; at 30 it stops short and leaves a grey shadow halo. A second
wave then seeds inside the leftover shadow, which JPEG noise had cut off from
the main region.

KNOWN ARTIFACT: a faint speckled grey arc survives along the mark's lower-left
edge — the inner rim of the drop shadow. It cannot be removed automatically,
and that is not for want of trying: the shadow there measures lum~203/sat~20
against a silver ring of lum~210/sat~15, so no colour rule separates them;
it is connected to the mark, so component filtering leaves it; and it sits at
radius 843-896 where the mark's own body reaches 854, so no radial cutoff
divides them either (a tight one visibly shaves the shield's points). The fix
is a source export WITH AN ALPHA CHANNEL, which makes this whole file a
two-line resize. Worth asking for before anyone spends more time here.

These assets are DERIVED, not authored. This script exists so that is
reproducible and so the next person can tell how. It becomes obsolete the
moment a real vector master arrives — see docs/brand/asset-manifest.md.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('CHALYB_LOGO_SRC', os.path.join(REPO, 'docs/brand/logo-master.jpg'))
# The browser tab uses a DIFFERENT mark, by request: the softer indigo/cream
# knot, supplied already cut out on transparency. Nothing to key, so it skips
# keyed_master() entirely — see favicon_master().
FAVICON_SRC = os.environ.get('CHALYB_FAVICON_SRC', os.path.join(REPO, 'docs/brand/logo-favicon.png'))
# Stand-in for the real wordmark face; see docs/brand/asset-manifest.md F.
FONT = os.environ.get(
    'CHALYB_WORDMARK_FONT', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
)

BRAND_BG = (7, 8, 9)  # --cc-bg
TILE_BG = (3, 4, 11)  # the engine tile's baked background

FLOOD_THRESHOLD = 48  # see module docstring — do not raise without re-checking
KEY = (255, 0, 255)


def keyed_master():
    """The emblem on transparency, trimmed square and centred."""
    src = Image.open(SRC).convert('RGB')
    w, h = src.size
    im = src.copy()

    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(im, seed, KEY, thresh=FLOOD_THRESHOLD)

    # Second wave: the drop shadow is backdrop too, but JPEG noise pinches it
    # off from the main region in places. Seed inside whatever desaturated,
    # mid-light pixels are still sitting next to keyed ones and flood those.
    px = im.load()
    seeds = []
    for y in range(0, h, 7):
        for x in range(0, w, 7):
            if px[x, y] == KEY:
                continue
            r, g, b = px[x, y]
            if max(r, g, b) - min(r, g, b) < 14 and 150 < 0.299 * r + 0.587 * g + 0.114 * b < 226:
                if any(
                    0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy] == KEY
                    for dx, dy in ((-7, 0), (7, 0), (0, -7), (0, 7))
                ):
                    seeds.append((x, y))
    for sx, sy in seeds[:400]:
        if px[sx, sy] != KEY:
            ImageDraw.floodfill(im, (sx, sy), KEY, thresh=26)

    matte = Image.new('L', (w, h), 255)
    mp = matte.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == KEY:
                mp[x, y] = 0
    matte = matte.filter(ImageFilter.GaussianBlur(1.0))

    em = src.convert('RGBA')
    em.putalpha(matte)
    # MinFilter first: a handful of stray JPEG specks at the frame edge survive
    # the flood, and without this they inflate the box and shrink the emblem
    # inside every asset below.
    solid = matte.point(lambda a: 255 if a > 140 else 0).filter(ImageFilter.MinFilter(5))
    em = em.crop(solid.getbbox())
    s = max(em.size)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(em, ((s - em.width) // 2, (s - em.height) // 2), em)
    return out


def favicon_master():
    """The tab mark: already transparent, so just trim it square.

    A separate file from SRC on purpose. This is the softer knot, and it is
    finer than the shield: it reads at 32px and 48px but goes soft at 16px,
    where the strands blur together and the star is lost. That was measured on
    both a light and a dark tab, and accepted — it is the chosen artwork. A
    simplified 16px cut is what would fix it.
    """
    src = Image.open(FAVICON_SRC).convert('RGBA')
    bb = src.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    em = src.crop(bb)
    s = max(em.size)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(em, ((s - em.width) // 2, (s - em.height) // 2), em)
    return out


def tab_icon(master, n):
    """Transparent tab icon at n px, sharpened — no invented backdrop.

    Deliberately NOT composited onto the brand dark. An earlier pass did that
    and the result did not look like the artwork it came from: a black tile
    the designer never drew, cropped edge to edge. Transparent lets the tab's
    own colour show through, light or dark, which is what the supplied cut-out
    is for.
    """
    r = master.resize((n, n), Image.LANCZOS)
    return ImageEnhance.Sharpness(r).enhance(1.7)


def on_bg(master, size, bg, pad=0.0, radius=0.0, sharpen=False):
    """Composite the master onto an opaque square."""
    inner = int(size * (1 - 2 * pad))
    m = master.resize((inner, inner), Image.LANCZOS)
    if sharpen:
        m = ImageEnhance.Sharpness(m).enhance(1.8)
    out = Image.new('RGBA', (size, size), bg + (255,))
    off = (size - inner) // 2
    out.paste(m, (off, off), m)
    if radius:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * radius), fill=255
        )
        out.putalpha(mask)
    return out


def social(master, w=1200, h=630):
    """Emblem + wordmark on the brand dark, with a soft blue/gold wash."""
    out = Image.new('RGB', (w, h), BRAND_BG)
    glow = Image.new('RGB', (w, h), BRAND_BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-120, 120, 620, 860], fill=(16, 34, 74))  # blue, behind the mark
    gd.ellipse([w - 560, -180, w + 160, 540], fill=(56, 42, 18))  # gold, right
    out = Image.blend(out, glow.filter(ImageFilter.GaussianBlur(190)), 0.85)

    em_h = 300
    em = master.resize((em_h, em_h), Image.LANCZOS)
    out.paste(em, (118, (h - em_h) // 2), em)

    d = ImageDraw.Draw(out)
    title = ImageFont.truetype(FONT, 104)
    sub = ImageFont.truetype(FONT, 34)
    x = 118 + em_h + 74
    # Wide tracking, drawn glyph by glyph — matches the lockup's spacing.
    cx = x
    for ch in 'CHALYB':
        d.text((cx, 232), ch, font=title, fill=(244, 246, 248))
        cx += d.textlength(ch, font=title) + 11
    d.text((x + 3, 360), 'IA unificada para tu operación', font=sub, fill=(150, 158, 172))
    d.text((x + 3, 408), 'chalyb.com', font=sub, fill=(240, 180, 78))
    return out


def main():
    if len(sys.argv) > 1:
        globals()['SRC'] = sys.argv[1]
    if not os.path.exists(SRC):
        sys.exit(f'source render not found: {SRC}\nPass it as an argument or set CHALYB_LOGO_SRC.')

    master = keyed_master()
    print(f'keyed master: {master.size[0]}x{master.size[1]} transparent')

    # Platform mark for components, on transparency.
    master.resize((512, 512), Image.LANCZOS).save(f'{REPO}/public/chalyb-mark.png')

    # Tab icons come from the OTHER mark, on transparency.
    fav = favicon_master()
    print(f'favicon master: {fav.size[0]}x{fav.size[1]} transparent')
    # 256 rather than 512: the source mark is 281px, so 512 would be an upscale
    # and soft. 256 is a clean downscale and ample for a tab.
    tab_icon(fav, 256).save(f'{REPO}/src/app/icon.png')
    # RGBA is required, not merely preferred — Turbopack's ICO decoder rejects
    # RGB-encoded frames with "The PNG is not in RGBA format!" and fails the build.
    tab_icon(fav, 48).save(
        f'{REPO}/src/app/favicon.ico', format='ICO', sizes=[(48, 48), (32, 32), (16, 16)]
    )

    # iOS: opaque, padded, corners left square (iOS rounds them itself).
    on_bg(master, 180, BRAND_BG, pad=0.10).convert('RGB').save(
        f'{REPO}/public/apple-touch-icon.png'
    )

    # Engine tile: object-cover fills the square, so it carries its own bg.
    on_bg(master, 512, TILE_BG, pad=0.08).convert('RGB').save(
        f'{REPO}/public/chalybclip-mark.png'
    )

    og = social(master)
    og.save(f'{REPO}/src/app/opengraph-image.png')
    og.save(f'{REPO}/src/app/twitter-image.png')
    print('wrote all assets')


if __name__ == '__main__':
    main()
