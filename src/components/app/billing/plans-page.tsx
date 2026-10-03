// Planes with its data (loadPlansProps): the signed-in user's state, where
// each CTA goes, what is offered. Shared by /planes (public) and /app/planes.

import { getLocale } from 'next-intl/server';
import { loadPlansProps } from '@/lib/billing/plans-props';
import { PlansView } from './plans-view';

export async function PlansSection() {
  return <PlansView {...await loadPlansProps(await getLocale())} />;
}
