import type { Metadata } from 'next';
import type { Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BellOff, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { canDeleteNotice, groupNotices, type UserNotice } from '@/lib/notifications/core';
import { deleteNotice, markAllNoticesRead } from '@/lib/notifications/user-actions';
import { StateBlock } from '@/components/ui/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notif');
  return { title: t('metaTitle') };
}

// Avisos (SCR-26, P3-16). Real notices only, written by their producers (clips
// ready, trial and renewal reminders, failed charge, stream ended).

export default async function AvisosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('notif');
  const session = await getSessionUser();
  if (!session) return null;
  const { data } = await createAdminClient()
    .from('user_notifications')
    .select('id, kind, title, body, href, keep_until, read_at, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const items = (data ?? []) as UserNotice[];
  const now = new Date().getTime();
  const groups = groupNotices(items, now);
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 820 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="ch-h1">{t('title')}</h1>
        {items.some((n) => !n.read_at) && (
          <form action={markAllNoticesRead}>
            <button type="submit" className="ch-btn ch-btn--secondary ch-btn--compact">{t('markRead')}</button>
          </form>
        )}
      </header>
      {groups.length === 0 ? (
        <StateBlock icon={<BellOff />} title={t('empty')} role="status" />
      ) : (
        groups.map(({ group, items: list }) => (
          <section key={group} aria-labelledby={`g-${group}`} style={{ display: 'grid', gap: 10 }}>
            <h2 id={`g-${group}`} className="ch-ghead">{t(group)}</h2>
            <ul className="ch-notices">
              {list.map((n) => (
                <li key={n.id} className="ch-card ch-notice" data-unread={!n.read_at}>
                  <div className="ch-notice__tx">
                    {n.href ? (
                      <Link href={n.href as Route} className="ch-lnk"><b>{n.title}</b></Link>
                    ) : (
                      <b>{n.title}</b>
                    )}
                    {n.body && <p>{n.body}</p>}
                    <small className="ch-muted">{time(n.created_at)}</small>
                  </div>
                  {canDeleteNotice(n, now) && (
                    <form action={deleteNotice}>
                      <input type="hidden" name="id" value={n.id} />
                      <button type="submit" className="ch-iconbtn" aria-label={`${t('delete')}: ${n.title}`}>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
