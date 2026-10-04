import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatFechaLarga } from '@/lib/billing/format';
import { ArcoForm } from '@/components/app/legal/arco-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('arco');
  return { title: t('title') };
}

// Mi cuenta → Privacidad → "Mis datos (derechos ARCO)" (Aviso de privacidad
// §5; old P6-8): the form and the person's own requests with the date we
// answer by.

interface Row {
  id: string;
  right_kind: string;
  received_at: string;
  respond_by: string;
  responded_at: string | null;
  outcome: string | null;
  effective_by: string | null;
}

export default async function ArcoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('arco');
  const session = await getSessionUser();
  if (!session) return null;
  const { data } = await createAdminClient()
    .from('arco_requests')
    .select('id, right_kind, received_at, respond_by, responded_at, outcome, effective_by')
    .eq('user_id', session.user.id)
    .order('received_at', { ascending: false })
    .limit(20);
  const rows = (data ?? []) as Row[];
  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 760 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      {rows.length > 0 && (
        <section aria-labelledby="arco-mine" style={{ display: 'grid', gap: 10 }}>
          <h2 id="arco-mine" className="ch-h2">
            {t('mine')}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {rows.map((r) => (
              <li key={r.id} className="ch-card" style={{ display: 'grid', gap: 4 }}>
                <b>{t(`form.rights.${r.right_kind}.title`)}</b>
                <span className="ch-muted">
                  {r.responded_at
                    ? t('answeredWith', {
                        fecha: formatFechaLarga(r.responded_at, locale),
                        resultado: t(`outcome.${r.outcome ?? 'incomplete'}`),
                      })
                    : t('pending', { fecha: formatFechaLarga(r.respond_by, locale) })}
                </span>
                {r.effective_by && (
                  <span className="ch-muted">
                    {t('effectiveBy', { fecha: formatFechaLarga(r.effective_by, locale) })}
                  </span>
                )}
                <span className="ch-muted" style={{ fontSize: 13 }}>
                  {t('folio', { folio: r.id.slice(0, 8) })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ArcoForm email={session.user.email ?? ''} />
      <p className="ch-muted" style={{ fontSize: 14 }}>
        {t('limits')}
      </p>
    </div>
  );
}
