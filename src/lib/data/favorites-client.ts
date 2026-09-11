'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Client-only favorite toggle. Lives in its own file so client components can
 * import it without pulling in next/headers via the server supabase client.
 */
export async function toggleFavoriteClient(
  engineId: string,
  currentlyFavorite: boolean,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (currentlyFavorite) {
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('engine_id', engineId);
  } else {
    await supabase.from('favorites').insert({ user_id: user.id, engine_id: engineId });
  }
}
