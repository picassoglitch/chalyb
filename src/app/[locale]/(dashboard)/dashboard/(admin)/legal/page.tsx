import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAdminPage } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatFechaLarga } from '@/lib/billing/format';
import { ArcoActions, TakedownActions } from '@/components/dashboard/admin/legal-actions';
import { LiftBlockButton } from '@/components/dashboard/admin/lift-block-button';
import { REACCEPT_DOCS } from '@/lib/legal/reaccept';
import { currentVersion, noticeRequired, versionMeta } from '@/lib/legal/registry';
import { inForceFrom, termsChangePeriodKey } from '@/lib/legal/terms-change';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.legal');
  return { title: t('title') };
}

// Dueño → Legal (old P6-8): open ARCO requests with their legal deadline
// (Aviso de privacidad §5.3) and copyright notices through removal,
// counter-notice and restore (Uso aceptable §5). Reached from "Necesita tu
// atención" and "Más".

interface Arco {
  id: string;
  right_kind: string;
  description: string;
  correct_value: string | null;
  contact_email: string;
  received_at: string;
  respond_by: string;
  extended_at: string | null;
}
interface Notice {
  id: string;
  claimant_name: string;
  claimant_contact: string;
  content_identification: string;
  right_statement: string;
  content_location: string;
  status: string;
  received_at: string;
  claimant_deadline: string | null;
  counter_notice: string | null;
}

export default async function LegalAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage();
  const t = await getTranslations('admin.legal');
  const db = createAdminClient();
  const [arco, notices] = await Promise.all([
    db
      .from('arco_requests')
      .select(
        'id, right_kind, description, correct_value, contact_email, received_at, respond_by, extended_at',
      )
      .is('responded_at', null)
      .order('respond_by', { ascending: true })
      .limit(200),
    db
      .from('takedown_notices')
      .select(
        'id, claimant_name, claimant_contact, content_identification, right_statement, content_location, status, received_at, claimant_deadline, counter_notice',
      )
      .in('status', ['received', 'removed', 'counter_noticed'])
      .order('received_at', { ascending: true })
      .limit(200),
  ]);
  const date = (iso: string) => formatFechaLarga(iso, locale);
  // aceptacion-ux §8 · change notices: one row per relevant change that
  // needs them, with how many went out and when the version really applies.
  const changes = await Promise.all(
    REACCEPT_DOCS.map((doc) => ({ doc, version: currentVersion(doc), meta: versionMeta(doc) }))
      .filter(
        (d) =>
          d.meta?.published && d.meta.relevance === 'relevant' && noticeRequired(d.doc, d.version),
      )
      .map(async ({ doc, version, meta }) => {
        const key = termsChangePeriodKey(version, doc);
        const [state, ...counts] = await Promise.all([
          db
            .from('legal_change_notices')
            .select('first_send_at, complete_at')
            .eq('doc', doc)
            .eq('version', version)
            .maybeSingle(),
          ...(['sent', 'delivered', 'pending', 'failed', 'bounced', 'undeliverable'] as const).map(
            (st) =>
              db
                .from('email_dispatches')
                .select('id', { count: 'exact', head: true })
                .eq('kind', 'terms_change')
                .eq('period_key', key)
                .eq('delivery_status', st),
          ),
        ]);
        const completeAt = (state.data?.complete_at as string | null) ?? null;
        // Never noticed (bounced, or given up after 5 tries / 72 h): they
        // stay on the terms they have and are never asked to accept.
        const { data: lost } = await db
          .from('email_dispatches')
          .select('user_id, delivery_status')
          .eq('kind', 'terms_change')
          .eq('period_key', key)
          .in('delivery_status', ['bounced', 'undeliverable'])
          .limit(50);
        const lostIds = ((lost ?? []) as { user_id: string }[]).map((r) => r.user_id);
        const { data: lostPeople } = lostIds.length
          ? await db.from('profiles').select('id, email').in('id', lostIds)
          : { data: [] };
        return {
          doc,
          version,
          registryDate: meta?.effective ?? null,
          firstSendAt: (state.data?.first_send_at as string | null) ?? null,
          completeAt,
          inForceAt: inForceFrom(meta, { noticeRequired: true, completeAt }),
          sent: (counts[0]!.count ?? 0) + (counts[1]!.count ?? 0),
          pending: counts[2]!.count ?? 0,
          failed: counts[3]!.count ?? 0,
          bounced: counts[4]!.count ?? 0,
          undeliverable: counts[5]!.count ?? 0,
          lost: ((lostPeople ?? []) as { email: string | null }[]).map((p) => p.email ?? '—'),
        };
      }),
  );
  const { data: blocks } = await db
    .from('blocked_content')
    .select('fingerprint, source, created_at')
    .is('lifted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  const blockRows = (blocks ?? []) as {
    fingerprint: string;
    source: string | null;
    created_at: string;
  }[];
  const arcoRows = (arco.data ?? []) as Arco[];
  const noticeRows = (notices.data ?? []) as Notice[];

  return (
    <div style={{ display: 'grid', gap: 26, maxWidth: 960 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>

      {changes.length > 0 && (
        <section aria-labelledby="l-notices" style={{ display: 'grid', gap: 12 }}>
          <h2 id="l-notices" className="ch-h2">
            {t('notices.title')}
          </h2>
          {changes.map((c) => (
            <article key={c.doc} className="ch-card" style={{ display: 'grid', gap: 6 }}>
              <b>{t('notices.doc', { doc: t(`notices.docs.${c.doc}`), version: c.version })}</b>
              <span className="ch-muted">
                {t('notices.counts', {
                  sent: c.sent,
                  pending: c.pending,
                  failed: c.failed,
                  bounced: c.bounced,
                  undeliverable: c.undeliverable,
                })}
              </span>
              <span>
                {c.completeAt
                  ? t('notices.complete', { fecha: date(c.completeAt) })
                  : c.firstSendAt
                    ? t('notices.sending', { fecha: date(c.firstSendAt) })
                    : t('notices.notStarted')}
              </span>
              {c.lost.length > 0 && (
                <details>
                  <summary>{t('notices.lost', { n: c.lost.length })}</summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {c.lost.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              <span>
                {c.inForceAt
                  ? t('notices.inForce', { fecha: date(c.inForceAt) })
                  : t('notices.notInForce', { fecha: c.registryDate ? date(c.registryDate) : '—' })}
              </span>
            </article>
          ))}
        </section>
      )}

      <section aria-labelledby="l-arco" style={{ display: 'grid', gap: 12 }}>
        <h2 id="l-arco" className="ch-h2">
          {t('arco.title', { n: arcoRows.length })}
        </h2>
        {arcoRows.length === 0 && <p className="ch-muted">{t('arco.none')}</p>}
        {arcoRows.map((r) => (
          <article key={r.id} className="ch-card" style={{ display: 'grid', gap: 8 }}>
            <b>
              {t(`arco.rights.${r.right_kind}`)} · {r.contact_email}
            </b>
            <p style={{ whiteSpace: 'pre-wrap' }}>{r.description}</p>
            {r.correct_value && <p>{t('arco.correct', { valor: r.correct_value })}</p>}
            <p className="ch-muted">
              {t('arco.due', { recibida: date(r.received_at), fecha: date(r.respond_by) })}
              {r.extended_at ? ` · ${t('arco.extended')}` : ''}
            </p>
            <ArcoActions id={r.id} extended={!!r.extended_at} />
          </article>
        ))}
      </section>

      <section aria-labelledby="l-td" style={{ display: 'grid', gap: 12 }}>
        <h2 id="l-td" className="ch-h2">
          {t('takedown.title', { n: noticeRows.length })}
        </h2>
        {noticeRows.length === 0 && <p className="ch-muted">{t('takedown.none')}</p>}
        {noticeRows.map((n) => (
          <article key={n.id} className="ch-card" style={{ display: 'grid', gap: 8 }}>
            <b>
              {t(`takedown.status.${n.status}`)} · {n.claimant_name} ({n.claimant_contact})
            </b>
            <p>{n.content_identification}</p>
            <p style={{ overflowWrap: 'anywhere' }}>{n.content_location}</p>
            <p className="ch-muted">{n.right_statement}</p>
            {n.counter_notice && <p>{t('takedown.counterShown', { texto: n.counter_notice })}</p>}
            <p className="ch-muted">
              {t('takedown.received', { fecha: date(n.received_at) })}
              {n.claimant_deadline
                ? ` · ${t('takedown.deadline', { fecha: date(n.claimant_deadline) })}`
                : ''}
            </p>
            <TakedownActions id={n.id} status={n.status} />
          </article>
        ))}
      </section>
      <section aria-labelledby="l-blocks" style={{ display: 'grid', gap: 12 }}>
        <h2 id="l-blocks" className="ch-h2">
          {t('blocks.title', { n: blockRows.length })}
        </h2>
        {blockRows.length === 0 && <p className="ch-muted">{t('blocks.none')}</p>}
        {blockRows.map((b) => (
          <article
            key={b.fingerprint}
            className="ch-card"
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <span style={{ flex: 1, minWidth: 200, overflowWrap: 'anywhere' }}>
              {b.source ?? b.fingerprint.slice(0, 16)}
              <br />
              <small className="ch-muted">{t('blocks.since', { fecha: date(b.created_at) })}</small>
            </span>
            <LiftBlockButton fingerprint={b.fingerprint} />
          </article>
        ))}
      </section>
    </div>
  );
}
