// Server read of the active tools for public pages. Anonymous visitors can't
// read `engines` through RLS, so this uses the service-role client and selects
// only slug and status — nothing else about the catalog leaves the server.

import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { readActiveTools } from './public-tools';

export const listActiveTools = cache(() =>
  readActiveTools(
    async () => {
      const { data, error } = await createAdminClient().from('engines').select('slug, status');
      if (error) throw new Error(error.message);
      return data;
    },
    (err) => {
      console.error(
        '[public-tools] catalog_unavailable: no tools advertised:',
        err instanceof Error ? err.message : err,
      );
    },
  ),
);
