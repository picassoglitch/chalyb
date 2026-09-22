import Image from 'next/image';

// The Chalyb mark, as it appears in the command-center and workspace sidebars.
// Same emblem as the landing nav (BrandMark) and the browser tab
// (src/app/icon.png) — one asset, public/chalyb-mark.png.
//
// WAS the pre-rebrand Nexo "N": a stroked N-path in acid green with six node
// circles, carried over verbatim from the prototype. It was never a Chalyb
// mark. Replaced with the 2026 emblem.
//
// Raster, so it softens below ~32px; both callers render it at 26px. See
// docs/brand/asset-manifest.md for what a vector master would fix.
export function FusionMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/chalyb-mark.png"
      alt="Chalyb"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
