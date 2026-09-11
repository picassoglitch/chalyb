'use client';

import { useState } from 'react';
import { useDashboard } from '@/lib/dashboard/store';
import type { UserRole } from '@/lib/auth/session';

interface PendingInvite {
  id: string;
  email: string;
  role: UserRole;
  sentAt: string;
}

export function TeamInviteForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('VIEWER');
  const [notify, setNotify] = useState(true);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const showToast = useDashboard((s) => s.showToast);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      showToast('<b>Error</b> · correo inválido');
      return;
    }
    const invite: PendingInvite = {
      id: `inv-${Date.now()}`,
      email,
      role,
      sentAt: new Date().toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    };
    setPending((prev) => [invite, ...prev]);
    showToast(`Invitación enviada a <b>${email}</b>`);
    setEmail('');
    setRole('VIEWER');
    // TODO step 07-CONTACT: wire to Resend for real invitation email.
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
          />
        </div>
        <div className="cc-mod-field">
          <label htmlFor="inv-role">Rol</label>
          <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="VIEWER">Viewer</option>
            <option value="EDITOR">Editor</option>
            <option value="OPERATOR">Operator</option>
            <option value="ADMIN">Admin</option>
            <option value="CLIENT">Client</option>
          </select>
        </div>
        <div className="cc-mod-toggle">
          <div className="cc-mod-toggle-text">
            <span className="t">Notificar por correo</span>
            <span className="s">Le mandamos un enlace de invitación a esa persona.</span>
          </div>
          <button
            type="button"
            aria-label="Toggle notify"
            className={`cc-mod-switch${notify ? ' on' : ''}`}
            onClick={() => setNotify((v) => !v)}
          />
        </div>
        <button
          type="submit"
          style={{
            alignSelf: 'flex-start',
            background: 'var(--cc-green)',
            color: '#070809',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Enviar invitación
        </button>
        <p
          style={{
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 11,
            color: 'var(--cc-txt-4)',
          }}
        >
          ▸ Las invitaciones se conectan con Resend en el step 07. Por ahora solo se guardan aquí.
        </p>
      </form>

      {pending.length > 0 && (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Invitaciones de esta sesión</div>
          <div className="cc-mod-list">
            {pending.map((p) => (
              <div key={p.id} className="cc-mod-row">
                <div className="cc-mod-ic">✉</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">
                    {p.email} <span className="cc-mod-badge">{p.role.replace('_', ' ')}</span>
                  </div>
                  <div className="cc-mod-sub">Enviada {p.sentAt}</div>
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
