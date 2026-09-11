// REAL Chalyb brand mark — copy-verbatim from the prototype.
// N-path stroked in green + 6 node circles (4 corners green, 2 inner cyan).
// Do NOT redraw this. Do NOT add/remove circles. This IS the brand.

export function FusionMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-label="Chalyb"
      className={className}
    >
      <path
        d="M44,150 L44,50 L66,50 L122,118 L122,50 L156,50 L156,150 L134,150 L78,82 L78,150 Z"
        fill="none"
        stroke="#9eea3a"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <g fill="#9eea3a">
        <circle cx="44" cy="50" r="6" />
        <circle cx="156" cy="50" r="6" />
        <circle cx="44" cy="150" r="6" />
        <circle cx="156" cy="150" r="6" />
        <circle cx="122" cy="84" r="5" fill="#42d9e8" />
        <circle cx="78" cy="116" r="5" fill="#42d9e8" />
      </g>
    </svg>
  );
}
