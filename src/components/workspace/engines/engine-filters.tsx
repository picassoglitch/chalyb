'use client';

import { useTranslations } from 'next-intl';
import { ENGINE_FILTER_KEYS, type EngineFilterKey } from './engine-config';

// Filter tabs above the grid. Controlled by the explorer; shows a live count
// per bucket so empty filters are obvious before you click. Scrolls sideways
// on narrow screens instead of wrapping into a tall block. These are a quick
// power-user filter — the default grouped layout is the primary way in.

export function EngineFilters({
  active,
  counts,
  onChange,
}: {
  active: EngineFilterKey;
  counts: Record<EngineFilterKey, number>;
  onChange: (key: EngineFilterKey) => void;
}) {
  const t = useTranslations('engines.filters');
  return (
    <div
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label={t('aria')}
    >
      {ENGINE_FILTER_KEYS.map((key) => {
        const isActive = key === active;
        const count = counts[key] ?? 0;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={[
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors',
              isActive
                ? 'border-[var(--cc-green)]/50 bg-[var(--cc-green-g)] text-[var(--cc-green)]'
                : 'border-[var(--cc-line)] bg-[var(--cc-panel)] text-[var(--cc-txt-3)] hover:border-[var(--cc-line-2)] hover:text-[var(--cc-txt)]',
            ].join(' ')}
          >
            {t(key)}
            <span
              className={`rounded-full px-1.5 text-[10.5px] [font-family:var(--cc-mono),monospace] ${
                isActive ? 'bg-[var(--cc-green)]/15 text-[var(--cc-green)]' : 'bg-white/[0.04] text-[var(--cc-txt-4)]'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
