// Insert a row into public.notifications (service-role — RLS has no
// INSERT policy on purpose, see migration 0027).
//
// Best-effort BY DESIGN: a notification must never fail the business flow
// that emits it (a payment webhook that 500s because the feed insert
// failed would make MP retry a payment that already processed fine).
// Errors are logged and swallowed.

import { createAdminClient } from '@/lib/supabase/admin';
import type { NotificationSeverity } from '@/lib/data/ops';

export async function notify(input: {
  severity: NotificationSeverity;
  title: string;
  body?: string;
  href?: string;
  source: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('notifications').insert({
      severity: input.severity,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      source: input.source,
    });
    if (error) console.error('[notify]', error.message);
  } catch (err) {
    console.error('[notify]', err);
  }
}
