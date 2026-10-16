'use client';
// The tool tabs. ToolTabsAuto: one layout wraps every screen of a tool
// (Chalito), so the selected tab comes from the path. ToolTabsLinks: each
// screen names its tab.

import type { Route } from 'next';
import { Link, usePathname } from '@/i18n/routing';
import { activeTabFor, toolBySlug, type ToolTabKey } from '@/config/tools';
import { normalizeAppPath } from '@/components/app/shell-routes';
import { useOptimisticPick } from '@/components/ui/optimistic-nav';

export function ToolTabsAuto({
  slug,
  labels,
  ariaLabel,
}: {
  slug: string;
  labels: Partial<Record<ToolTabKey, string>>;
  ariaLabel: string;
}) {
  const tool = toolBySlug(slug)!;
  const tab = activeTabFor(tool, normalizeAppPath(usePathname()));
  return (
    <nav className="ch-tooltabs" role="tablist" aria-label={ariaLabel}>
      {tool.tabs.map((x) => (
        <Link
          key={x.key}
          href={x.href as Route}
          role="tab"
          aria-selected={tab === x.key}
          aria-current={tab === x.key ? 'page' : undefined}
        >
          {labels[x.key]}
        </Link>
      ))}
    </nav>
  );
}

/** The tool tabs when each screen names its tab: a clicked tab shows as
 *  selected on the click itself, while its screen loads. */
export function ToolTabsLinks({
  tabs,
  selected,
  ariaLabel,
}: {
  tabs: { key: ToolTabKey; href: string; label: string }[];
  selected: ToolTabKey | null;
  ariaLabel: string;
}) {
  const { shown, pick } = useOptimisticPick(selected);
  return (
    <nav className="ch-tooltabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((x) => (
        <Link
          key={x.key}
          href={x.href as Route}
          role="tab"
          aria-selected={shown === x.key}
          aria-current={shown === x.key ? 'page' : undefined}
          onClick={pick(x.key)}
        >
          {x.label}
        </Link>
      ))}
    </nav>
  );
}
