import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { PUBLIC_TOOLS } from '@/lib/tools/public-tools';
import {
  probePublicEngine,
  readinessEngineTarget,
  readinessResponse,
} from '@/lib/health/readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// For an external monitor with a protected Authorization header. Never call
// payment providers or start media jobs from a health endpoint.
export async function GET(request: Request) {
  return readinessResponse(request, {
    secret: process.env.CRON_SECRET,
    publicSlugs: PUBLIC_TOOLS,
    readCatalog: async (signal) => {
      const { data, error } = await createAdminClient()
        .from('engines')
        .select('slug, status, external_url')
        .abortSignal(signal);
      if (error || !data) throw new Error('catalog_unavailable');
      return data;
    },
    probe: (engine, signal) =>
      probePublicEngine(readinessEngineTarget(engine, process.env), signal),
  });
}
