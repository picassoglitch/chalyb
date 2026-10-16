// What a tool screen shows the moment it's clicked (the route's loading.tsx),
// while the server checks the plan and reads the engine: the same tool
// header and tabs as the screen (the clicked tab already selected), and a
// shimmer shaped like the screen's content. Nothing here reads data.

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import type { ToolTabKey } from '@/config/tools';
import { Skeleton } from '@/components/ui/primitives';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ToolShell } from './tool-shell';

export type ToolLoadingShape =
  /** A hero card beside a side card, then a grid (Clips' Inicio). */
  | 'home'
  /** A row of filter pills, then a grid of cards (Mis clips). */
  | 'grid'
  /** A row of pills, then stacked rows (history lists, Publicar). */
  | 'list'
  /** Two columns of setting panels (Ajustes). */
  | 'settings'
  /** Signal cards beside a side column (Señales). */
  | 'signals'
  /** One big panel beside a side column (En vivo, a market chart). */
  | 'panel';

export async function ToolLoading({
  slug,
  tab,
  shape,
  after,
}: {
  slug: string;
  tab: ToolTabKey;
  shape: ToolLoadingShape;
  /** Static content the screen always shows under the body (Señales' legal
   *  strip). */
  after?: ReactNode;
}) {
  const t = await getTranslations('toolShell');
  return (
    <ToolShell slug={slug} tab={tab}>
      <div className="ch-loading" role="status" aria-live="polite" aria-busy="true">
        <span className="ch-sr">{t('loading')}</span>
        <LoadingBody shape={shape} />
      </div>
      {after}
    </ToolShell>
  );
}

function Pills({ n }: { n: number }) {
  return (
    <div className="ch-loading__pills" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} height={38} style={{ width: 96 + (i % 2) * 24, borderRadius: 999 }} />
      ))}
    </div>
  );
}

function Cards({ n, height }: { n: number; height: number }) {
  return (
    <div className="ch-loading__grid" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

function Rows({ n, height = 76 }: { n: number; height?: number }) {
  return (
    <div className="ch-loading__rows" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

function LoadingBody({ shape }: { shape: ToolLoadingShape }) {
  switch (shape) {
    case 'home':
      return (
        <>
          <div className="ch-loading__split" aria-hidden="true">
            <Skeleton height={240} />
            <Skeleton height={240} />
          </div>
          <Cards n={3} height={84} />
          <Cards n={6} height={220} />
        </>
      );
    case 'grid':
      return (
        <>
          <Pills n={4} />
          <Cards n={8} height={240} />
        </>
      );
    case 'list':
      return (
        <>
          <Pills n={3} />
          <Rows n={5} />
        </>
      );
    case 'settings':
      return (
        <div className="ch-loading__cols" aria-hidden="true">
          <Rows n={3} height={150} />
          <Rows n={2} height={150} />
        </div>
      );
    case 'signals':
      return (
        <>
          <Pills n={4} />
          <div className="ch-loading__split" aria-hidden="true">
            <Rows n={3} height={150} />
            <Rows n={3} height={120} />
          </div>
        </>
      );
    case 'panel':
      return (
        <div className="ch-loading__split" aria-hidden="true">
          <Skeleton height={420} />
          <Rows n={3} height={128} />
        </div>
      );
  }
}

/** The same for a focus-layout wizard screen (no tool header): its top bar
 *  paints on the click, the column shimmers. `top` goes above the shimmer
 *  (the "Hacer clips" source picker). */
export async function WizardLoading({
  chrome,
  top,
}: {
  chrome: Omit<Parameters<typeof WizardShell>[0], 'children'>;
  top?: ReactNode;
}) {
  const t = await getTranslations('toolShell');
  return (
    <WizardShell {...chrome}>
      {top}
      <div className="ch-loading ch-loading--col" role="status" aria-live="polite" aria-busy="true">
        <span className="ch-sr">{t('loading')}</span>
        <Skeleton height={44} style={{ width: '60%', margin: '0 auto' }} />
        <Skeleton height={24} style={{ width: '80%', margin: '0 auto' }} />
        <Skeleton height={180} />
        <Skeleton height={56} style={{ width: 260, margin: '0 auto', borderRadius: 999 }} />
      </div>
    </WizardShell>
  );
}
