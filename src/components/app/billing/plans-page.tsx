// Planes with its data (loadPlansProps): the signed-in user's state, where
// each CTA goes, what is offered. Shared by /planes (public) and /app/planes.

import { getLocale } from 'next-intl/server';
import { loadPlansProps } from '@/lib/billing/plans-props';
import { listActiveTools } from '@/lib/tools/public-tools-server';
import { CatalogUnavailable } from '@/components/landing/catalog-unavailable';
import { PlansView } from './plans-view';

export async function PlansSection({ clipsActive }: { clipsActive?: boolean } = {}) {
  // The public page already read the catalog for its chrome. In the account,
  // read it here so an empty catalog does not sell plans or inactive benefits.
  if (clipsActive === undefined) {
    const tools = await listActiveTools();
    if (tools.length === 0) return <CatalogUnavailable signedIn embedded />;
    clipsActive = tools.some((tool) => tool.slug === 'chalybclip');
  }
  return <PlansView {...await loadPlansProps(await getLocale(), { clipsActive })} />;
}
