// Tiny static SVG primitives shared by the product mockups on the landing.
// Pure markup, no client JS — they exist so the hero preview and the pillar
// visuals read as one product without shipping screenshots.

const WAVE_BARS = [
  18, 30, 22, 44, 36, 58, 40, 26, 62, 48, 70, 54, 34, 28, 46, 66, 52, 38, 24, 42, 60, 74, 56, 32,
  20, 40, 50, 64, 44, 30, 26, 48, 58, 36, 22,
];

/** Audio-style timeline with highlighted "clip" ranges (as % start / % width). */
export function Waveform({
  highlights = [
    [26, 8],
    [62, 9],
  ],
}: {
  highlights?: Array<[number, number]>;
}) {
  return (
    <svg viewBox="0 0 350 60" preserveAspectRatio="none" aria-hidden="true">
      {WAVE_BARS.map((h, i) => (
        <rect
          key={i}
          x={i * 10 + 2}
          y={(60 - h) / 2}
          width={6}
          height={h}
          rx={2}
          fill="currentColor"
          opacity={0.35}
        />
      ))}
      {highlights.map(([start, width]) => (
        <rect
          key={start}
          x={start * 3.5}
          y={2}
          width={width * 3.5}
          height={56}
          rx={6}
          fill="var(--acid)"
          fillOpacity={0.16}
          stroke="var(--acid)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

const SPARK_LINE =
  'M0,82 L40,75 L80,80 L120,58 L160,64 L200,44 L240,49 L280,29 L320,36 L360,18 L400,24';

/** Upward-trending line chart with a soft area fill. */
export function Sparkline() {
  return (
    <svg viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="lp-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--acid)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--acid)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${SPARK_LINE} L400,110 L0,110 Z`} fill="url(#lp-spark-fill)" />
      <path d={SPARK_LINE} fill="none" stroke="var(--acid)" strokeWidth="2" />
    </svg>
  );
}

/** Check mark used for feature bullets. Inherits `color` from the list item. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeOpacity="0.35" />
      <path
        d="M6 10.5l2.6 2.5L14 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
