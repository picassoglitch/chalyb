'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { changeUserTier } from '@/lib/auth/tier-actions';
import type { SubscriptionTier } from '@/lib/auth/session';

const TIERS: Array<{ value: SubscriptionTier; label: string }> = [
  { value: 'FREE', label: 'Free' },
  { value: 'PRO', label: 'Pro' },
  // Partner sits between Pro and VIP in this dropdown — it's PRO-level
  // access plus an owned engine. Admin-grant only; tier-actions.ts blocks
  // non-admins from picking it server-side regardless of UI state.
  { value: 'PARTNER', label: 'Partner' },
  { value: 'VIP', label: 'VIP' },
];

interface Props {
  userId: string;
  current: SubscriptionTier;
}

export function TeamTierSelect({ userId, current }: Props) {
  const [tier, setTier] = useState<SubscriptionTier>(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SubscriptionTier;
    const prev = tier;
    setTier(next);
    startTransition(async () => {
      const res = await changeUserTier(userId, next);
      if (!res.ok) {
        setTier(prev);
        showToast(`<b>Error</b> · ${res.error ?? 'No pudimos cambiar el plan. Inténtalo de nuevo.'}`);
        return;
      }
      showToast(`Listo, el plan ahora es <b>${next.replace('_', '-')}</b>`);
      // Refresh the team page so the row reflects the authoritative server
      // value (also re-runs the "paid subscriptions" stat at the top). The
      // target user's other tabs get auto-synced by ProfileSubscriber.
      router.refresh();
    });
  }

  return (
    <select
      value={tier}
      onChange={handleChange}
      disabled={pending}
      style={{
        background: 'var(--cc-bg-2)',
        border: '1px solid var(--cc-line-2)',
        borderRadius: 7,
        padding: '6px 10px',
        color: 'var(--cc-txt)',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {TIERS.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
