'use client';

// "Proponer una idea" (rebuild P4-6). Name, email, idea, and a clickwrap
// line linking the Aviso de Privacidad. No marketing opt-in.

import { useId, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { submitIdea, type IdeaResult } from '@/lib/contact/idea-actions';

export function IdeaForm() {
  const t = useTranslations('landing.idea');
  const [result, setResult] = useState<IdeaResult | null>(null);
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const id = useId();

  if (result?.ok) {
    return (
      <p role="status" className="pub-idea__done">
        {t('done', { correo: email })}
      </p>
    );
  }

  const invalid = (f: 'name' | 'email' | 'idea') => result?.fieldError === f;

  return (
    <form
      className="pub-idea"
      noValidate
      action={(fd) => {
        setEmail(String(fd.get('email') ?? ''));
        start(async () => {
          const r = await submitIdea(fd);
          setResult(r);
          window.dispatchEvent(
            new CustomEvent('chalyb:landing', {
              detail: { event: 'landing_partner_submit', props: { result: r.ok ? 'ok' : 'error' } },
            }),
          );
        });
      }}
    >
      <div className="ch-field">
        <label htmlFor={`${id}-name`}>{t('name')}</label>
        <input
          id={`${id}-name`}
          name="name"
          className="ch-input"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          aria-invalid={invalid('name')}
          aria-describedby={invalid('name') ? `${id}-err` : undefined}
        />
      </div>
      <div className="ch-field">
        <label htmlFor={`${id}-email`}>{t('email')}</label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          className="ch-input"
          autoComplete="email"
          required
          maxLength={200}
          aria-invalid={invalid('email')}
          aria-describedby={invalid('email') ? `${id}-err` : undefined}
        />
      </div>
      <div className="ch-field">
        <label htmlFor={`${id}-idea`}>{t('idea')}</label>
        <textarea
          id={`${id}-idea`}
          name="idea"
          className="ch-input pub-idea__text"
          required
          minLength={10}
          maxLength={3000}
          rows={4}
          aria-invalid={invalid('idea')}
          aria-describedby={invalid('idea') ? `${id}-err` : undefined}
        />
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="pub-hp" />

      {result?.errorKey && (
        <p id={`${id}-err`} role="alert" className="pub-idea__err">
          {t(`errors.${result.errorKey}`)}
        </p>
      )}

      <p className="pub-idea__legal">
        {t.rich('clickwrap', {
          aviso: (chunks) => (
            <Link href="/legal/privacy" className="ch-lnk">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <button type="submit" className="ch-btn ch-btn--primary" disabled={pending}>
        {pending ? t('sending') : t('submit')}
      </button>
    </form>
  );
}
