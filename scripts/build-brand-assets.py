#!/usr/bin/env python3
"""Derive every brand asset from the master mark.

    python3 scripts/build-brand-assets.py [path/to/mark.png]

Defaults to docs/brand/logo-master.png, which is committed so this is
reproducible without hunting for the original file.

THE MASTER IS SUPPLIED ON TRANSPARENCY, which is why this script is short.
Earlier revisions took an opaque render and had to key the backdrop out — a
flood fill from the frame corners with a hand-tuned threshold, a second wave
for the drop shadow, and a residual grey arc along one edge that could not be
removed at all (the shadow and the silver ring were the same grey, so no
colour rule, connected-component pass or radial cutoff could separate them).
All of that is gone. A transparent source makes it a resize.

Keep it that way: if a new mark arrives as a JPEG on a background, ask for a
PNG with an alpha channel before writing any code to cut it out.

One slot still needs an opaque square — iOS composites transparency onto a
flat colour of its own choosing, so apple-touch-icon.png picks white rather
than letting the platform decide.

These assets are DERIVED, not authored, and this script is how. It becomes
obsolete the moment a real vector master arrives — see
docs/brand/asset-manifest.md.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('CHALYB_LOGO_SRC', os.path.join(REPO, 'docs/brand/logo-master.png'))
# Stand-in for the real wordmark face; see docs/brand/asset-manifest.md F.
FONT = os.environ.get(
    'CHALYB_WORDMARK_FONT', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
)

BRAND_BG = (7, 8, 9)  # --cc-bg, for the social image's canvas
IOS_BG = (255, 255, 255)

# The mark measures ~281px inside its frame, so 256 is the largest clean
# downscale. Every consumer renders well below that (160px at the largest —
# the engine hero), so nothing here wants more.
MARK_SIZE = 256


def master():
    """The mark, trimmed square and centred, on transparency."""
    src = Image.open(SRC).convert('RGBA')
    bb = src.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    em = src.crop(bb)
    s = max(em.size)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(em, ((s - em.width) // 2, (s - em.height) // 2), em)
    return out


def scaled(mark, n, sharpen=True):
    """The mark at n px, on transparency. Sharpened because every consumer is
    a heavy downscale and LANCZOS alone leaves it soft."""
    r = mark.resize((n, n), Image.LANCZOS)
    return ImageEnhance.Sharpness(r).enhance(1.7) if sharpen else r


def on_bg(mark, size, bg, pad=0.0):
    """Composite onto an opaque square. Only iOS needs this."""
    inner = int(size * (1 - 2 * pad))
    m = scaled(mark, inner)
    out = Image.new('RGB', (size, size), bg)
    out.paste(m, ((size - inner) // 2,) * 2, m)
    return out


def social(mark, w=1200, h=630):
    """Mark + wordmark on the brand dark, with a soft indigo/gold wash."""
    out = Image.new('RGB', (w, h), BRAND_BG)
    glow = Image.new('RGB', (w, h), BRAND_BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-120, 120, 620, 860], fill=(26, 28, 62))  # indigo, behind the mark
    gd.ellipse([w - 560, -180, w + 160, 540], fill=(54, 42, 26))  # gold, right
    out = Image.blend(out, glow.filter(ImageFilter.GaussianBlur(190)), 0.85)

    em_h = 300
    em = scaled(mark, em_h)
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
    d.text((x + 3, 408), 'chalyb.com', font=sub, fill=(232, 187, 127))
    return out


def main():
    if len(sys.argv) > 1:
        globals()['SRC'] = sys.argv[1]
    if not os.path.exists(SRC):
        sys.exit(f'master mark not found: {SRC}\nPass it as an argument or set CHALYB_LOGO_SRC.')

    mark = master()
    print(f'master: {mark.size[0]}x{mark.size[1]} transparent')

    # Nav, footer, both sidebars.
    scaled(mark, MARK_SIZE).save(f'{REPO}/public/chalyb-mark.png')

    # ChalyClip's engine tile. Square image in a square box, so `object-cover`
    # and `object-contain` are equivalent — transparency just lets the card
    # behind it show, which is why this no longer bakes its own dark tile.
    scaled(mark, MARK_SIZE).save(f'{REPO}/public/chalybclip-mark.png')

    # Browser tab. Transparent so it sits on the tab's own colour, light or
    # dark, rather than a tile nobody drew.
    scaled(mark, MARK_SIZE).save(f'{REPO}/src/app/icon.png')
    # RGBA is required, not merely preferred — Turbopack's ICO decoder rejects
    # RGB-encoded frames with "The PNG is not in RGBA format!" and fails the build.
    scaled(mark, 48).save(
        f'{REPO}/src/app/favicon.ico', format='ICO', sizes=[(48, 48), (32, 32), (16, 16)]
    )

    # iOS home screen: must be opaque, and white is what the platform would
    # composite onto anyway. Padded because iOS rounds the corners itself.
    on_bg(mark, 180, IOS_BG, pad=0.08).save(f'{REPO}/public/apple-touch-icon.png')

    og = social(mark)
    og.save(f'{REPO}/src/app/opengraph-image.png')
    og.save(f'{REPO}/src/app/twitter-image.png')
    print('wrote all assets')


if __name__ == '__main__':
    main()
