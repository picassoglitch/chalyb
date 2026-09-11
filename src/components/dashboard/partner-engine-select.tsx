'use client';

// Renders on each PARTNER row in /dashboard/team. Lets the admin pick which
// engine (from the catalog) this partner owns. The owned engine is the
// partner's always-live slot — distinct from the PRO selected_engine_id
// mechanic.
//
// Only one engine can have a given owner_user_id at a time (partial UNIQUE
// on engines.owner_user_id), so the server action clears any prior pointer
// before setting the new one. The dropdown excludes engines already owned
// by OTHER partners — we render those as disabled with the owner's email
// shown so the admin understands why they can't pick it.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { setPartnerOwnedEngine } from '@/lib/engines/partner-ownership-actions';

export interface EngineOption {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string | null;
  ownerEmail: string | null;
}

interface Props {
  userId: string;
  /** Engine the partner currently owns (or null = none assigned yet). */
  currentEngineId: string | null;
  engines: EngineOption[];
}

export function PartnerEngineSelect({ userId, currentEngineId, engines }: Props) {
  const [value, setValue] = useState<string>(currentEngineId ?? '');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null;
    const prev = value;
    setValue(next ?? '');
    startTransition(async () => {
      const res = await setPartnerOwnedEngine(userId, next);
      if (!res.ok) {
        setValue(prev);
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo asignar'}`);
        return;
      }
      showToast(next ? 'Engine asignado al partner' : 'Engine desasignado');
      router.refresh();
    });
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={pending}
      title="Engine que este partner controla (siempre en vivo, además de su slot Pro)"
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
        maxWidth: 200,
      }}
    >
      <option value="">— sin engine propio —</option>
      {engines.map((e) => {
        // Disable engines owned by a different partner. The current partner's
        // own row stays selectable (so the dropdown reflects truth).
        const ownedByOther = e.ownerUserId !== null && e.ownerUserId !== userId;
        return (
          <option key={e.id} value={e.id} disabled={ownedByOther}>
            {e.name}
            {ownedByOther
              ? ` · de ${e.ownerEmail?.split('@')[0] ?? 'otro partner'}`
              : ''}
          </option>
        );
      })}
    </select>
  );
}
