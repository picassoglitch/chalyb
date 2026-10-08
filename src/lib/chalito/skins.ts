import type { SkinEffect } from "@/lib/chalito/web/store";

/**
 * A CSS stand-in for each skin (the tile swatch, and the preview while WebGL loads or is missing):
 * the real look is the card renderer's shader, drawn live in the preview.
 */
export const SKIN_SWATCH: Record<SkinEffect, string> = {
  gold: "linear-gradient(135deg, #6b3d04, #e9a12a 42%, #fff0c0 50%, #e9a12a 58%, #6b3d04)",
  galaxy:
    "radial-gradient(circle at 30% 30%, #d14fa0 0, transparent 38%), radial-gradient(circle at 70% 68%, #2c6bd6 0, transparent 42%), #180a3a",
  neon: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
  crystal: "linear-gradient(160deg, #e6f7ff, #6fa6d8 50%, #eaf8ff)",
  holo: "linear-gradient(120deg, #ff9ad5, #ffe48a, #9affc8, #8ad1ff, #d29aff)",
  shadow: "radial-gradient(circle, #2a1940 55%, #8b3dff)",
  pixel: "repeating-conic-gradient(#f59e5b 0 25%, #fde3c4 0 50%) 0 0 / 12px 12px",
};
