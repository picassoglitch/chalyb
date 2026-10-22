-- Close two client-write holes found in the 2026-10-08 audit.
--
-- messages: "messages_user_mark_read" (0014) let a subscriber UPDATE any column
-- of any row in their own thread — RLS limits rows, not columns — so a client
-- could rewrite history, forge a staff reply (sender_role = 'ADMIN') or set
-- read_at_admin to hide their messages from the admin badge. Every legitimate
-- write (send, reply, mark read) goes through the service-role client in
-- src/lib/messages/messages-actions.ts, so clients lose INSERT too: the
-- "messages_insert_own_thread" policy let them set read_at_admin/read_at_user
-- or created_at on their own message (hide it from the badge, backdate it).
--
-- user_notifications: "user_notifications_update_own" (0043) let a user null
-- keep_until on a billing notice and then delete it, defeating the delete
-- guard. Mark-read and delete go through the service-role client in
-- src/lib/notifications/user-actions.ts. The guarded DELETE policy stays.
--
-- Idempotent. Timestamped (pnpm db:new) so it sorts after applied versions;
-- the `hub_` prefix is what pnpm test:migrations picks up.

drop policy if exists "messages_user_mark_read" on public.messages;
drop policy if exists "messages_insert_own_thread" on public.messages;
revoke insert, update, delete on public.messages from anon, authenticated;

drop policy if exists "user_notifications_update_own" on public.user_notifications;
revoke insert, update on public.user_notifications from anon, authenticated;
