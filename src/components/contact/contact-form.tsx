'use client';

import { useState, useTransition } from 'react';
import { submitContactForm } from '@/lib/contact/contact-actions';

type FieldError = 'name' | 'email' | 'subject' | 'message' | null;
type Pane = 'client' | 'partner' | 'earn';

interface Props {
  /** Tag the submission origin. Defaults to 'client' for backward compat.
   *  Currently only the future landing-section wire-up will pass 'partner'
   *  / 'earn'; the /contacto page itself doesn't differentiate, but the
   *  prop is here so it can. */
  pane?: Pane;
}

export function ContactForm({ pane = 'client' }: Props = {}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<FieldError>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setFieldError(null);
    startTransition(async () => {
      const res = await submitContactForm(fd);
      if (!res.ok) {
        setError(res.error ?? 'No se pudo enviar el mensaje.');
        setFieldError(res.fieldError ?? null);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div
        style={{
          padding: '28px 22px',
          border: '1px solid var(--path)',
          background: 'rgba(198,242,78,0.06)',
          borderRadius: 12,
          color: 'var(--ink)',
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--path)',
            marginBottom: 8,
          }}
        >
          ● Mensaje recibido
        </div>
        Gracias por escribirnos. Te respondemos al correo que dejaste en menos de 24 horas
        hábiles. Revisa tu bandeja de entrada (y la carpeta de spam, por si acaso) para la confirmación.
      </div>
    );
  }

  // We use the .auth-* classes from globals.css so this form is styled
  // consistently with sign-in/sign-up (the only other place these inputs
  // appear). dashboard.css's cc-mod-* classes aren't loaded outside the
  // /dashboard and /app route groups, so we can't use them here.
  const fieldClass = (key: FieldError) =>
    `auth-field${fieldError === key ? ' err' : ''}`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Honeypot — visually hidden, bots fill it, humans never see it.
          Server action returns ok=true silently if this has any value. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Pane tag — picked up by submitContactForm and persisted on the
          partner_inquiries row so the admin inbox can filter / colorize. */}
      <input type="hidden" name="pane" value={pane} />

      <div className={fieldClass('name')}>
        <label htmlFor="contact-name">Nombre</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder="Tu nombre completo"
        />
      </div>

      <div className={fieldClass('email')}>
        <label htmlFor="contact-email">Correo</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={200}
          placeholder="tu@correo.com"
        />
      </div>

      <div className={fieldClass('subject')}>
        <label htmlFor="contact-subject">Asunto</label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          maxLength={200}
          placeholder="¿De qué se trata?"
        />
      </div>

      <div className={fieldClass('message')}>
        <label htmlFor="contact-message">Mensaje</label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="Cuéntanos qué buscas resolver con Chalyb."
        />
      </div>

      {error && (
        <div role="alert" className="auth-error">
          {error}
        </div>
      )}

      <button type="submit" disabled={pending} className="auth-submit">
        {pending ? 'Enviando…' : 'Enviar mensaje →'}
      </button>
    </form>
  );
}
