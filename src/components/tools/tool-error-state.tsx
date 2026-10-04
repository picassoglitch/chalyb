// "{Herramienta} no abrió esta vez" (TOOLS-SPEC §7.1, mockup 60). Inside
// ToolShell: the header and tabs stay. The "ya nos avisaron" pill shows only
// while tool_status.incident_active (someone really was alerted), and "lo que
// ya hiciste está guardado" only when the caller knows there is saved work.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { PlugZap } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { toolBySlug } from '@/config/tools';
import { getToolStatus } from '@/lib/tools/status';
import type { ToolError } from '@/lib/tools/bff-core';
import { Markup } from '@/components/ui/markup';
import { ToolRetry } from './tool-retry';

const MEANWHILE: Record<string, { href: string | null }> = {
  chalybclip: { href: '/app/history' },
  chalybcrypto: { href: '/app/senales/historial' },
  chalybobs: { href: null },
};

export async function ToolErrorState({
  slug,
  error,
  savedWork = false,
}: {
  slug: string;
  error: ToolError;
  savedWork?: boolean;
}) {
  const tool = toolBySlug(slug)!;
  const t = await getTranslations('toolShell.error');
  const status = await getToolStatus(slug);
  const meanwhile = MEANWHILE[slug];
  const help = `/app/help?codigo=${encodeURIComponent(error.supportCode)}`;
  return (
    <div className="ch-toolerr">
      <section
        className="ch-card ch-state ch-toolerr__card"
        aria-labelledby="toolerr-title"
        data-reason={error.reason}
        data-support-code={error.supportCode}
      >
        <span className="ch-state__ic ch-toolerr__ic" aria-hidden="true">
          <PlugZap />
        </span>
        <h2 id="toolerr-title" className="ch-h2">
          {t('title', { herramienta: tool.name })}
        </h2>
        <p className="ch-muted">
          {t('body')}
          {savedWork && <> {t('saved')}</>}
        </p>
        <ToolRetry
          slug={slug}
          helpHref={help}
          labels={{ retry: t('retry'), retrying: t('retrying'), human: t('human') }}
        />
        {status.incidentActive && <span className="ch-pill ch-pill--warn">{t('known')}</span>}
        <p className="ch-muted ch-toolerr__code">
          <Markup text={t.markup('code', { codigo: error.supportCode, b: (c) => `<b>${c}</b>` })} />
        </p>
      </section>
      <p className="ch-muted ch-toolerr__meanwhile">
        {meanwhile?.href ? (
          <>
            {t(`meanwhile.${slug}`)}{' '}
            <Link href={meanwhile.href as Route} className="ch-lnk">
              {t(`meanwhileLink.${slug}`)}
            </Link>
            .
          </>
        ) : (
          t(`meanwhile.${slug}`)
        )}
      </p>
    </div>
  );
}
