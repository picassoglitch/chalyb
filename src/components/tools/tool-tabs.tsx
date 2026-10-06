'use client';
// The tool tabs when one layout wraps every screen of a tool (Chalito): the
// selected tab comes from the path, since the layout can't know it.

import type { Route } from 'next';
import { Link, usePathname } from '@/i18n/routing';
import { activeTabFor, toolBySlug, type ToolTabKey } from '@/config/tools';
import { normalizeAppPath } from '@/components/app/shell-routes';

export function ToolTabsAuto({
  slug,
  labels,
  ariaLabel,
}: {
  slug: string;
  labels: Record<ToolTabKey, string>;
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
