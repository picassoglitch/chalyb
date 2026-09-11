'use client';

// Per-row "Re-link ChalybClip" button for /dashboard/team (B4 of the
// contemplation plan).
//
// Use case: an admin sees a user whose token chip in ChalybClip is silent
// (cache empty) or whose engine subscription got out-of-sync. One click
// forces a re-provision through the integration's idempotent POST
// /api/admin/tenants, which post-B2 claims any orphan tenant by email
// and backfills external_user_id. The next time the user logs in via
// SSO their balance starts reporting.
//
// Today we hardcode the engine slug to 'chalybclip' because it's the only
// engine with self-healing wired in. When more engines land we'll turn
// this into a small popover that lists each integrated engine and lets
// the admin re-link any of them.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { relinkUserToEngine } from '@/lib/engines/reconcile-actions';

interface Props {
  userId: string;
  /** Display name for the toast. */
  userName: string;
  /** Slug of the engine to re-link against. Defaults to 'chalybclip' — the
   *  only engine wired into the contemplation plan today. */
  engineSlug?: string;
}

export function TeamRelinkEngine({ userId, userName, engineSlug = 'chalybclip' }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function handleClick() {
    if (pending) return;
    startTransition(async () => {
      const res = await relinkUserToEngine(userId, engineSlug);
      if (!res.ok) {
        showToast(`<b>Re-link falló</b> · ${res.error ?? 'error desconocido'}`);
        return;
      }
      const tail =
        res.status === 'provisioned'
          ? 'creado o reclamado en el engine'
          : res.status === 'already_provisioned'
            ? 'ya estaba linkeado'
            : 'engine no requiere provisioning';
      showToast(`Re-link <b>${userName}</b> · ${tail}.`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={`Forzar re-provisioning de ${engineSlug} para este usuario`}
      style={{
        padding: '6px 10px',
        borderRadius: 7,
        border: '1px solid var(--cc-line-2)',
        background: pending ? 'var(--cc-bg-3)' : 'var(--cc-bg-2)',
        color: pending ? 'var(--cc-txt-4)' : 'var(--cc-txt-2)',
        fontFamily: 'inherit',
        fontSize: 11.5,
        fontWeight: 500,
        cursor: pending ? 'default' : 'pointer',
        transition: 'background 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {/* ↻ symbol — keeps it compact next to tier/role selects which are
          already wider. */}
      <span style={{ fontSize: 13, lineHeight: 1 }}>↻</span>
      <span>{pending ? 'Re-linking…' : 'Re-link'}</span>
    </button>
  );
}
