'use client';

// Subscriber-side wrapper around ProfileSubscriber that shows a toast when
// an admin (or anyone) modifies the current user's tier or role.
//
// Fires only on actual change — comparing payload.new vs payload.old. The
// REPLICA IDENTITY FULL set in migration 0007 ensures the old row arrives
// in the payload; without it Realtime only sends changed columns + PK and
// the diff can't be computed.
//
// If both tier and role change in the same UPDATE (rare — admins typically
// do one at a time), we combine into a single toast so the second doesn't
// overwrite the first 0.1s later.

import { useCallback } from 'react';
import { useWorkspace } from '@/lib/workspace/store';
import { ProfileSubscriber, type ProfileChangePayload } from './profile-subscriber';

const TIER_LABEL: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  VIP: 'VIP',
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
  CLIENT: 'Client',
};

function prettyTier(t?: string): string {
  if (!t) return '—';
  return TIER_LABEL[t] ?? t;
}

function prettyRole(r?: string): string {
  if (!r) return '—';
  return ROLE_LABEL[r] ?? r;
}

export function WorkspaceProfileSubscriber({ userId }: { userId: string }) {
  const showToast = useWorkspace((s) => s.showToast);

  const handleChange = useCallback(
    (next: ProfileChangePayload, prev: ProfileChangePayload | null) => {
      // First-load case: no `prev` (shouldn't happen on UPDATE events but
      // guard anyway). Without a baseline we can't tell what changed.
      if (!prev) return;

      const tierChanged = next.tier !== undefined && next.tier !== prev.tier;
      const roleChanged = next.role !== undefined && next.role !== prev.role;

      if (tierChanged && roleChanged) {
        showToast(
          `Tu cuenta fue actualizada · plan <b>${prettyTier(next.tier)}</b> · rol <b>${prettyRole(next.role)}</b>`,
        );
      } else if (tierChanged) {
        // Differentiate upgrade vs downgrade visually with the verb.
        const isDowngrade =
          (prev.tier === 'VIP' && next.tier !== 'VIP') ||
          (prev.tier === 'PRO' && next.tier === 'FREE');
        const verb = isDowngrade ? 'cambió a' : 'activado:';
        showToast(`Tu plan ${verb} <b>${prettyTier(next.tier)}</b>`);
      } else if (roleChanged) {
        showToast(`Tu rol cambió a <b>${prettyRole(next.role)}</b>`);
      }
      // Other column changes (selected_bot_id, etc.) — no toast, just the
      // silent router.refresh() that ProfileSubscriber triggers.
    },
    [showToast],
  );

  return <ProfileSubscriber userId={userId} onChange={handleChange} />;
}
