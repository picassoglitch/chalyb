'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { submitContactForm, type ContactErrorKey } from '@/lib/contact/contact-actions';

type FieldError = 'name' | 'email' | 'subject' | 'message' | 'chargeDate' | 'chargeAmount' | null;
type Pane = 'client' | 'partner' | 'earn';

interface Props {
  /** Tag the submission origin. Defaults to 'client' for backward compat.
   *  Currently only the future landing-section wire-up will pass 'partner'
   *  / 'earn'; the /contacto page itself doesn't differentiate, but the
   *  prop is here so it can. */
  pane?: Pane;
  /** From Ayuda: a billing problem (tags the message server-side). */
  category?: 'cobro';
  defaultSubject?: string;
}

export function ContactForm({ pane = 'client', category, defaultSubject }: Props = {}) {
  const t = useTranslations('contact.form');
  const tError = useTranslations('contact.errors');
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  // The server action returns a message KEY (see ContactResult.errorKey), not a
  // rendered sentence, so the copy resolves in the reader's locale here.
  const [errorKey, setErrorKey] = useState<ContactErrorKey | null>(null);
  const [fieldError, setFieldError] = useState<FieldError>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrorKey(null);
    setFieldError(null);
    startTransition(async () => {
      const res = await submitContactForm(fd);
      if (!res.ok) {
        setErrorKey(res.errorKey ?? null);
        setFieldError(res.fieldError ?? null);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="pub-form-done" role="status">
        <div className="pub-form-done__title">{t('successTitle')}</div>
        {t('successBody')}
      </div>
    );
  }

  // The .auth-* field classes are styled for the public pages in
  // chalyb-legal.css (sign-in/up still style them from globals.css).
  const fieldClass = (key: FieldError) => `auth-field${fieldError === key ? ' err' : ''}`;
  // Problema con un cobro (Términos de Suscripción §7.5): only email, date
  // and amount are required.
  const cobro = category === 'cobro';

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
        <label htmlFor="contact-name">{cobro ? t('nameOptional') : t('name')}</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required={!cobro}
          maxLength={120}
          placeholder={t('namePlaceholder')}
        />
      </div>

      <div className={fieldClass('email')}>
        <label htmlFor="contact-email">{t('email')}</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={200}
          placeholder={t('emailPlaceholder')}
        />
      </div>

      {cobro ? (
        <>
          <input type="hidden" name="category" value="cobro" />
          <div className={fieldClass('chargeDate')}>
            <label htmlFor="contact-charge-date">{t('chargeDate')}</label>
            <input id="contact-charge-date" name="chargeDate" type="date" required />
          </div>
          <div className={fieldClass('chargeAmount')}>
            <label htmlFor="contact-charge-amount">{t('chargeAmount')}</label>
            <input
              id="contact-charge-amount"
              name="chargeAmount"
              type="text"
              inputMode="decimal"
              required
              maxLength={12}
              placeholder="997"
            />
          </div>
        </>
      ) : (
        <div className={fieldClass('subject')}>
          <label htmlFor="contact-subject">{t('subject')}</label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            required
            maxLength={200}
            placeholder={t('subjectPlaceholder')}
            defaultValue={defaultSubject}
          />
        </div>
      )}

      <div className={fieldClass('message')}>
        <label htmlFor="contact-message">{cobro ? t('messageOptional') : t('message')}</label>
        <textarea
          id="contact-message"
          name="message"
          required={!cobro}
          minLength={cobro ? undefined : 10}
          maxLength={5000}
          rows={6}
          placeholder={t('messagePlaceholder')}
        />
      </div>

      {errorKey && (
        <div role="alert" className="auth-error">
          {tError(errorKey)}
        </div>
      )}

      <button type="submit" disabled={pending} className="auth-submit">
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
