'use server';

// "Proponer una idea" server action (rebuild P4-6). Stores the lead in
// partner_inquiries with pane 'idea' (migration 0044), where P5's "Ideas
// nuevas" reads it. Same anti-spam as the contact form: a honeypot field and
// the shared per-IP limit (check_contact_rate_limit, migration 0034).

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { ideaRow, readIdeaForm, validateIdea, type IdeaErrorKey } from './idea';

export interface IdeaResult {
  ok: boolean;
  fieldError?: 'name' | 'email' | 'idea';
  errorKey?: IdeaErrorKey;
}

export async function submitIdea(form: FormData): Promise<IdeaResult> {
  if (String(form.get('company') ?? '').trim() !== '') return { ok: true };

  const input = readIdeaForm(form);
  const invalid = validateIdea(input);
  if (invalid) return { ok: false, fieldError: invalid, errorKey: invalid };

  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc('check_contact_rate_limit', {
      p_ip: forwarded ?? 'local',
      p_window_seconds: 600,
      p_max_attempts: 5,
    });
    if (error) throw new Error(error.message);
    if (((data ?? {}) as { allowed?: boolean }).allowed === false)
      return { ok: false, errorKey: 'rateLimited' };
  } catch (err) {
    // A counter outage must not lose the lead; the honeypot still applies.
    console.warn('[idea] rate limit unavailable:', err instanceof Error ? err.message : err);
  }

  const { error } = await admin
    .from('partner_inquiries')
    .insert(ideaRow(input, { ip: forwarded, userAgent: h.get('user-agent') }));
  if (error) {
    console.error('[idea] partner_inquiries insert failed:', error.message);
    return { ok: false, errorKey: 'sendFailed' };
  }
  return { ok: true };
}
