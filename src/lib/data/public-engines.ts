// Engine readiness for surfaces with no session: the landing, /partners,
// /api/health. Reads the catalog with the service-role client (the engines
// table is org-scoped behind RLS, and an anonymous visitor has no org) and
// reduces it to counts + per-slug readiness — never rows, never credentials.
//
// Every failure degrades to "nothing is ready", which is the honest default
// for a marketing claim: we would rather under-promise than show a live
// engine because a query timed out.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { engineIsRunnable } from '@/lib/billing/readiness';
import type { EngineIntegrationMode, EngineStatus } from './types';

export interface PublicEngineStatus {
  slug: string;
  name: string;
  /** active + a real surface to open — the same test the app applies. */
  ready: boolean;
}

export interface PublicFleet {
  engines: PublicEngineStatus[];
  ready: number;
  upcoming: number;
  /** False when the catalog could not be read at all. */
  fromCatalog: boolean;
}

const EMPTY: PublicFleet = { engines: [], ready: 0, upcoming: 0, fromCatalog: false };

export async function getPublicFleet(): Promise<PublicFleet> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('engines')
      .select('slug, name, status, integration_mode, external_url')
      .neq('status', 'deprecated')
      .order('name');
    if (error || !data) return EMPTY;
    const engines = (data as Array<Record<string, unknown>>).map((row) => ({
      slug: row.slug as string,
      name: row.name as string,
      ready: engineIsRunnable({
        status: row.status as EngineStatus,
        integrationMode: row.integration_mode as EngineIntegrationMode,
        externalUrl: (row.external_url as string | null) ?? null,
      }),
    }));
    const ready = engines.filter((e) => e.ready).length;
    return { engines, ready, upcoming: engines.length - ready, fromCatalog: true };
  } catch {
    return EMPTY;
  }
}
