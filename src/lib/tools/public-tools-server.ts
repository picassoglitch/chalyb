// Server read of the active tools for public pages. Anonymous visitors can't
// read `engines` through RLS, so this uses the service-role client and selects
// only slug and status — nothing else about the catalog leaves the server.

import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { activeTools, fallbackTools, type PublicTool } from './public-tools';

export const listActiveTools = cache(async (): Promise<PublicTool[]> => {
  try {
    const { data, error } = await createAdminClient().from('engines').select('slug, status');
    if (error) throw new Error(error.message);
    const tools = activeTools((data ?? []) as Array<{ slug: string; status: string }>);
    return tools.length ? tools : fallbackTools();
  } catch (err) {
    console.warn(
      '[public-tools] catalog unavailable, using the live set:',
      err instanceof Error ? err.message : err,
    );
    return fallbackTools();
  }
});
