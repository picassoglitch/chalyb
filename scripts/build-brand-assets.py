#!/usr/bin/env python3
"""Derive every brand asset from the 3D logo render.

    python3 scripts/build-brand-assets.py path/to/logo-render.png

The render is a fully-opaque PNG: the emblem sits on a baked grey gradient with
a drop shadow, so every asset starts by keying that backdrop out — modelled
from the four corners and subtracted, because the gradient's bright corner is
brighter than parts of the emblem and no single luminance cutoff separates
them. Then it composites onto whatever each destination needs.

This exists because the assets are DERIVED, not authored: without it, nobody
can tell how public/chalyb-mark.png was made or reproduce it after a tweak.
It becomes obsolete the moment a vector master arrives — at which point every
path it writes to gets a hand-made file instead. See
docs/brand/asset-manifest.md.
"""

import os
import sys

from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageEnhance

# The 3D logo render this was built from. Not committed — it is a source
# artwork file, not a repo asset. Point SRC at it (or pass a path as argv[1]).
SRC = os.environ.get('CHALYB_LOGO_SRC', 'logo-render.png')
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Stand-in for the real wordmark face; see docs/brand/asset-manifest.md F.
FONT = os.environ.get('CHALYB_WORDMARK_FONT', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf')

BRAND_BG = (7, 8, 9)      # --cc-bg
TILE_BG = (3, 4, 11)      # the engine tile's baked background

# The backdrop is a smooth gradient; these are its four true corners, sampled
# from the source. Modelling it and subtracting is what a plain luminance
# threshold cannot do — the backdrop's bright corner (lum 97) is brighter than
# parts of the emblem, so any single cutoff either keeps a grey square or eats
# the mark.
BG_CORNERS = {'tl': (40, 45, 52), 'tr': (92, 101, 112),
              'bl': (30, 33, 39), 'br': (46, 50, 58)}


def keyed_master():
    """The emblem on transparency, trimmed square and centred."""
    im = Image.open(SRC).convert('RGB')
    w, h = im.size
    px = im.load()
    tl, tr, bl, br = (BG_CORNERS[k] for k in ('tl', 'tr', 'bl', 'br'))

    matte = Image.new('L', (w, h), 0)
    mp = matte.load()
    for y in range(h):
        v = y / (h - 1)
        for x in range(w):
            u = x / (w - 1)
            r, g, b = px[x, y]
            bgc = [(1 - v) * ((1 - u) * tl[i] + u * tr[i])
                   + v * ((1 - u) * bl[i] + u * br[i]) for i in range(3)]
            # Brighter than the backdrop, or departing from it in hue. The drop
            # shadow is DARKER than the backdrop, so it falls out on its own.
            dl = ((0.299 * r + 0.587 * g + 0.114 * b)
                  - (0.299 * bgc[0] + 0.587 * bgc[1] + 0.114 * bgc[2]))
            dc = max(abs(r - bgc[0]), abs(g - bgc[1]), abs(b - bgc[2]))
            a = max(dl / 26.0, (dc - 10) / 30.0)
            mp[x, y] = max(0, min(255, int(a * 255)))
    matte = matte.filter(ImageFilter.GaussianBlur(0.5))

    em = im.convert('RGBA')
    em.putalpha(matte)
    # Trim on the SOLID mark, not the outer glow, or the glow's bounding box
    # shrinks the emblem inside every downstream square.
    solid = matte.point(lambda a: 255 if a > 90 else 0)
    em = em.crop(solid.getbbox())
    s = max(em.size)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(em, ((s - em.width) // 2, (s - em.height) // 2), em)
    return out


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
    """Emblem + wordmark on the brand dark, with a soft indigo/gold wash."""
    out = Image.new('RGB', (w, h), BRAND_BG)
    glow = Image.new('RGB', (w, h), BRAND_BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-120, 120, 620, 860], fill=(24, 26, 58))      # indigo, left
    gd.ellipse([w - 560, -180, w + 160, 540], fill=(52, 40, 26))  # gold, right
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
    d.text((x + 3, 408), 'chalyb.com', font=sub, fill=(221, 166, 112))
    return out


def main():
    if len(sys.argv) > 1:
        globals()['SRC'] = sys.argv[1]
    if not os.path.exists(SRC):
        sys.exit(f'source render not found: {SRC}\n'
                 'Pass it as an argument or set CHALYB_LOGO_SRC.')
    master = keyed_master()
    print(f'keyed master: {master.size[0]}x{master.size[1]} transparent')

    # Platform mark for components, on transparency.
    master.resize((512, 512), Image.LANCZOS).save(f'{REPO}/public/chalyb-mark.png')

    # Tab icon. Replaces icon.svg; keeps the rounded dark tile it drew.
    on_bg(master, 512, BRAND_BG, pad=0.06, radius=0.20).save(f'{REPO}/src/app/icon.png')

    # Favicon: minimal padding and a sharpen pass, because 16px needs every pixel.
    # Stays RGBA (opaque) — Turbopack's ICO decoder rejects RGB-encoded frames
    # with "The PNG is not in RGBA format!" and fails the build.
    on_bg(master, 48, BRAND_BG, pad=0.02, sharpen=True).save(
        f'{REPO}/src/app/favicon.ico', format='ICO',
        sizes=[(48, 48), (32, 32), (16, 16)])

    # iOS: opaque, padded, corners left square (iOS rounds them itself).
    on_bg(master, 180, BRAND_BG, pad=0.10).convert('RGB').save(
        f'{REPO}/public/apple-touch-icon.png')

    # Engine tile: object-cover fills the square, so it carries its own bg.
    on_bg(master, 512, TILE_BG, pad=0.08).convert('RGB').save(
        f'{REPO}/public/chalybclip-mark.png')

    og = social(master)
    og.save(f'{REPO}/src/app/opengraph-image.png')
    og.save(f'{REPO}/src/app/twitter-image.png')
    print('wrote all assets')


if __name__ == '__main__':
    main()
