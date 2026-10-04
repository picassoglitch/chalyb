// A tool's own home inside the app (TOOLS-SPEC §3): the AppShell sidebar
// stays (shell-routes TOOL), and on top go the tool header (icon in the
// tool's color, name, plan pill) and at most 3 tabs. Nothing opens a tab.

import type { Route } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { toolBySlug, type ToolTabKey } from '@/config/tools';
import { Pill } from '@/components/ui/primitives';
import { ToolIcon } from '@/components/ui/tool-icon';

export async function ToolShell({
  slug,
  tab,
  plan = 'included',
  children,
}: {
  slug: string;
  /** The selected tab; null on screens outside the tabs (none today). */
  tab: ToolTabKey | null;
  /** included → "Incluido en tu plan"; offer → "Incluido en Pro · Pruébalo
   *  gratis" (only while the trial can be honoured); pro → "Incluido en Pro". */
  plan?: 'included' | 'offer' | 'pro';
  children: ReactNode;
}) {
  const tool = toolBySlug(slug)!;
  const t = await getTranslations('toolShell');
  return (
    <div className="ch-toolshell" data-tool={slug}>
      <header className="ch-toolhead">
        <div className="ch-toolhead__id">
          <Link href={'/app' as Route} className="ch-crumb">
            {t('crumb')}
            <ChevronRight aria-hidden="true" />
          </Link>
          <div className="ch-toolhead__row">
            <ToolIcon slug={slug} filled />
            <div className="ch-toolhead__name">
              <h1 className="ch-h1">{tool.name}</h1>
              {plan === 'included' ? (
                <Pill kind="ok" check>
                  {t('included')}
                </Pill>
              ) : (
                <Pill kind="acc">{plan === 'offer' ? t('inProTry') : t('inPro')}</Pill>
              )}
            </div>
          </div>
        </div>
        {plan === 'included' && (
          <nav className="ch-tooltabs" role="tablist" aria-label={t('tabsAria', { herramienta: tool.name })}>
            {tool.tabs.map((x) => (
              <Link
                key={x.key}
                href={x.href as Route}
                role="tab"
                aria-selected={tab === x.key}
                aria-current={tab === x.key ? 'page' : undefined}
              >
                {t(`tab.${slug}.${x.key}`)}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <div className="ch-toolbody">{children}</div>
    </div>
  );
}
