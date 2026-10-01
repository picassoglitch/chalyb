'use server';

// Evidence for a new account (aceptacion-ux §2): `signup_terms_accepted`
// with the document versions shown, and `marketing_opt_in` only if the box
// was ticked. Called right after Supabase creates the account — before the
// email is confirmed, so there may be no session yet. To keep this from being
// a way to write events for someone else, it only acts on an account created
// in the last 15 minutes that has no signup event yet.

import { createAdminClient } from '@/lib/supabase/admin';
import { legalDocuments } from '@/lib/legal/documents';
import { track } from '@/lib/analytics/track';
import { recordConsent, requestContext, UI_VERSION } from './consent';

const WINDOW_MS = 15 * 60 * 1000;

export async function recordSignupConsent(input: {
  userId: string;
  marketing: boolean;
  locale: string;
  timezone: string | null;
  surface: 'web_signup_email' | 'web_signup_google';
}): Promise<{ ok: boolean }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(input.userId);
    const user = data?.user;
    if (!user || Date.now() - Date.parse(user.created_at) > WINDOW_MS) return { ok: false };
    const { data: existing } = await admin
      .from('consent_events')
      .select('consent_id')
      .eq('user_id', input.userId)
      .eq('event_type', 'signup_terms_accepted')
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true };

    const published = (process.env.LEGAL_PUBLISH ?? '').toLowerCase() === 'true';
    const ctx = await requestContext();
    const base = {
      user_id: input.userId,
      account_email: user.email ?? null,
      // What the line cited: the new documents once P6 publishes them.
      documents: published ? legalDocuments('terminos', 'uso_aceptable', 'privacidad') : [],
      client_timezone: input.timezone,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      locale: input.locale === 'es' ? 'es-MX' : 'en',
      surface: input.surface,
      ui_version: UI_VERSION,
      checkbox_checked: null,
      plan_id: null,
      amount_mxn: null,
      currency: null,
      tax_included: null,
      billing_interval: null,
      trial_end_utc: null,
      charge_date_utc: null,
      reminder_date_utc: null,
      payment_method: null,
    };
    await recordConsent({
      ...base,
      event_type: 'signup_terms_accepted',
      disclosure_text: null,
      checkbox_text: null,
      button_label: input.surface === 'web_signup_google' ? 'Continuar con Google' : 'Crear cuenta',
      marketing_opt_in: input.marketing,
      details: published ? null : { documents_cited: ['legal/terms', 'legal/privacy'] },
    });
    if (input.marketing) {
      await recordConsent({
        ...base,
        event_type: 'marketing_opt_in',
        disclosure_text: null,
        checkbox_text:
          'Quiero recibir novedades, consejos y promociones de Chalyb por correo. Puedo darme de baja cuando quiera.',
        checkbox_checked: true,
        button_label: 'Crear cuenta',
        marketing_opt_in: true,
      });
    }
    void track('signup', { source: 'app' });
    return { ok: true };
  } catch (err) {
    console.error('[signup-consent] not recorded', err);
    return { ok: false };
  }
}
