import Image from 'next/image';

// Static Chalyb mark — the same emblem as the favicon (src/app/icon.png) and
// the dashboard's FusionMark, so the nav, the footer and the browser tab read
// as one brand.
//
// WAS an inline SVG stroked in `currentColor`, which let .lp-mark tint it from
// CSS. The 2026 emblem is a multi-colour 3D render and cannot inherit
// `currentColor`, so this is an <Image> and the tinting is gone. If a flat
// single-colour cut of the mark ever lands, this goes back to inline SVG and
// the tinting with it — see docs/brand/asset-manifest.md (constraint 1).
//
// The source art is a raster render, so it softens below ~32px. The nav uses
// 26px and the footer 20px; that is a known limitation of the current asset,
// not of this component.
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <Image
      className="lp-mark"
      src="/chalyb-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
    />
  );
}
