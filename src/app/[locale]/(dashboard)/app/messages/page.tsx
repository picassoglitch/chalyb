import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listThreadMessages, markThreadReadForUser } from '@/lib/messages/messages-data';
import { sendMessageFromUser } from '@/lib/messages/messages-actions';
import { MessageThread } from '@/components/messages/message-thread';
import { MessageComposer } from '@/components/messages/message-composer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app.messages' });
  return { title: t('metaTitle') };
}

// Subscriber-side conversation with the Chalyb admin team.
//
// One thread per user. We auto-mark the thread as read on page load so the
// unread badge in the sidebar drops to 0 as soon as the page renders — there
// is no separate "open conversation" gesture; visiting /app/messages IS the
// open gesture. The mark happens before the read so it doesn't race against
// realtime updates.
//
// The composer is a client component that calls sendMessageFromUser via
// server action. After a successful send, the action calls revalidatePath
// on /app/messages, which re-runs this RSC and renders the new bubble.

export default async function SubscriberMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('app.messages');
  const session = await getSessionUser();
  if (!session) {
    return redirect({ href: { pathname: '/sign-in', query: { next: '/app/messages' } }, locale });
  }

  // Best-effort: clear the unread badge. Pure write (no revalidatePath) so it's
  // safe to call during render — calling a revalidating server action here is
  // what crashed this page ("revalidatePath cannot be called during render").
  // The sidebar badge refreshes on the next navigation.
  await markThreadReadForUser(session.user.id);
  const messages = await listThreadMessages(session.user.id);

  return (
    <div className="cc-scroll">
      <div
        style={{
          marginBottom: 18,
          padding: '14px 18px',
          border: '1px solid var(--cc-line)',
          background: 'var(--cc-panel-2)',
          borderRadius: 'var(--cc-r-l)',
        }}
      >
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>{t('title')}</h3>
        <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', lineHeight: 1.5 }}>
          {t('body')}
        </p>
      </div>

      <MessageThread
        messages={messages}
        viewer="USER"
        emptyMessage={t('empty')}
      />

      <div style={{ marginTop: 18 }}>
        <MessageComposer
          send={sendMessageFromUser}
          placeholder={t('placeholder')}
          buttonLabel={t('send')}
        />
      </div>
    </div>
  );
}
