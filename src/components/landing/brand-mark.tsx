// Static Chalyb mark. Same geometry as src/app/icon.svg so the nav, the
// footer and the favicon read as one brand. Pure SVG — no animation loop.
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="lp-mark"
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M44,150 L44,50 L66,50 L122,118 L122,50 L156,50 L156,150 L134,150 L78,82 L78,150 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <g fill="currentColor">
        <circle cx="44" cy="50" r="9" />
        <circle cx="156" cy="50" r="9" />
        <circle cx="44" cy="150" r="9" />
        <circle cx="156" cy="150" r="9" />
      </g>
    </svg>
  );
}
