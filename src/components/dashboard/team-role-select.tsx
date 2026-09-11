'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { changeUserRole } from '@/lib/auth/role-actions';
import type { UserRole } from '@/lib/auth/session';

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'OPERATOR', label: 'Operator' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'CLIENT', label: 'Client' },
];

interface Props {
  userId: string;
  current: UserRole;
  envLocked?: boolean;
}

export function TeamRoleSelect({ userId, current, envLocked }: Props) {
  const [role, setRole] = useState<UserRole>(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as UserRole;
    const prev = role;
    setRole(next); // optimistic
    startTransition(async () => {
      const res = await changeUserRole(userId, next);
      if (!res.ok) {
        setRole(prev); // revert
        showToast(`<b>Error</b> · ${res.error}`);
        return;
      }
      showToast(`Rol cambiado a <b>${next.replace('_', ' ')}</b>`);
      // Pull authoritative server state — also refreshes the role count
      // tile + any other admins viewing the page in this browser tab.
      router.refresh();
    });
  }

  return (
    <select
      value={role}
      onChange={handleChange}
      disabled={pending || envLocked}
      title={envLocked ? 'Rol bloqueado por SUPER_ADMIN_EMAILS — se restaura desde .env.local' : undefined}
      style={{
        background: 'var(--cc-bg-2)',
        border: '1px solid var(--cc-line-2)',
        borderRadius: 7,
        padding: '6px 10px',
        color: 'var(--cc-txt)',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: pending || envLocked ? 'not-allowed' : 'pointer',
        opacity: pending || envLocked ? 0.7 : 1,
      }}
    >
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
