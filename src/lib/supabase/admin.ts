// Service-role Supabase client — bypasses RLS entirely.
//
// WHY THIS EXISTS:
// - Our `getSessionUser()` promotes SUPER_ADMIN_EMAILS to SUPER_ADMIN at the
//   request level (env-locked override). But Postgres RLS doesn't see that
//   override — it calls `public.is_admin()` which queries the stored role
//   in `profiles`. If the env-locked user's stored role is anything other
//   than SUPER_ADMIN/ADMIN, RLS silently rejects UPDATEs (Supabase returns
//   `error: null, data: []` — no row, no error, no clue).
// - Server actions that have already verified admin permission at the
//   Next.js layer should use this client to perform the actual write, so
//   the env-override path actually has teeth.
//
// SAFETY:
// - NEVER import this from a Client Component or anything in src/components/
//   that renders client-side. Service key = god-mode; leaking it = total
//   data compromise. Server actions and route handlers only.
// - The `import 'server-only'` line below makes the build fail loudly if
//   you accidentally pull this into a client bundle.

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// We don't generate typed Supabase schemas in this codebase (no `supabase gen
// types`), so we use `any` for the Database generic to match what the existing
// `@supabase/ssr` server client does implicitly. Tradeoff: no compile-time
// column type-safety on writes, but matches the rest of the data layer.
type Db = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let cached: SupabaseClient<Db> | null = null;

export function createAdminClient(): SupabaseClient<Db> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'createAdminClient: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from env',
    );
  }
  cached = createClient<Db>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
