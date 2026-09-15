'use client';

import { useState, useTransition } from 'react';
import { useDashboard } from '@/lib/dashboard/store';
import { inviteTeamMember } from '@/lib/auth/invite-actions';
import { INVITABLE_ROLES, type PendingInvite } from '@/lib/auth/invites';
import type { UserRole } from '@/lib/auth/session';

const ROLE_LABEL: Record<string, string> = {
  VIEWER: 'Viewer',
  EDITOR: 'Editor',
  OPERATOR: 'Operator',
  ADMIN: 'Admin',
  CLIENT: 'Client',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Sends a real invitation through Supabase Auth (see inviteTeamMember). The
 * "pending" list below is the server's view — invited users who have not
 * signed in yet — so it survives reloads and never shows a send that did not
 * happen.
 */
export function TeamInviteForm({ pending }: { pending: PendingInvite[] }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('VIEWER');
  const [sending, startSending] = useTransition();
  const showToast = useDashboard((s) => s.showToast);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const target = email.trim();
    if (!target.includes('@')) {
      showToast('<b>Error</b> · correo inválido');
      return;
    }
    startSending(async () => {
      const res = await inviteTeamMember({ email: target, role });
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'No se pudo enviar la invitación.'}`);
        return;
      }
      showToast(`Invitación enviada a <b>${target}</b> como ${ROLE_LABEL[role] ?? role}`);
      setEmail('');
      setRole('VIEWER');
    });
  }

  return (
    <>
      <form className="cc-mod-form" onSubmit={submit}>
        <div className="cc-mod-field">
          <label htmlFor="inv-email">Correo</label>
          <input
            id="inv-email"
            type="email"
            placeholder="nombre@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={sending}
          />
        </div>
        <div className="cc-mod-field">
          <label htmlFor="inv-role">Rol</label>
          <select
            id="inv-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={sending}
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={sending}
          style={{
            alignSelf: 'flex-start',
            background: sending ? 'var(--cc-bg-3)' : 'var(--cc-green)',
            color: sending ? 'var(--cc-txt-3)' : '#070809',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: sending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {sending ? 'Enviando…' : 'Enviar invitación'}
        </button>
        <p
          style={{
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 11,
            color: 'var(--cc-txt-4)',
          }}
        >
          ▸ Le llega un correo de Chalyb con un enlace para entrar. Al abrirlo queda dentro con el
          rol elegido; para volver a entrar usa Google con ese mismo correo o «Olvidé mi contraseña»
          para crear una.
        </p>
      </form>

      {pending.length > 0 && (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Invitaciones pendientes</div>
          <div className="cc-mod-list">
            {pending.map((p) => (
              <div key={p.id} className="cc-mod-row">
                <div className="cc-mod-ic">✉</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">
                    {p.email}{' '}
                    {p.role && <span className="cc-mod-badge">{ROLE_LABEL[p.role] ?? p.role}</span>}
                  </div>
                  <div className="cc-mod-sub">Enviada {formatWhen(p.invitedAt)} · aún no entra</div>
                </div>
                <div className="cc-mod-right">
                  <b>Pendiente</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
