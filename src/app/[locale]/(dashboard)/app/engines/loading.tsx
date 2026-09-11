// Suspense fallback for the engines hub while the server fetches the catalog +
// token balance. Mirrors the real layout (hero + card grid) so the page doesn't
// jump on load. Pure skeleton — no data, no client JS.

export default function EnginesLoading() {
  return (
    <div className="cc-scroll">
      <div className="flex flex-col gap-6 pt-2">
        {/* hero skeleton */}
        <div className="h-40 animate-pulse rounded-[16px] border border-[var(--cc-line)] bg-[var(--cc-panel)]" />

        {/* filter tabs skeleton */}
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 animate-pulse rounded-full border border-[var(--cc-line)] bg-[var(--cc-panel)]"
            />
          ))}
        </div>

        {/* card grid skeleton */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-[13px] border border-[var(--cc-line)] bg-[var(--cc-panel)]"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
