'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { EmailAuthForm } from '@/components/auth/email-auth-form';
import { usePath, type Path } from './use-path';

type Pane = 'client' | 'partner' | 'earn';

export function ContactSection() {
  const tContact = useTranslations('contact');
  const tForm = useTranslations('form');
  const tBudget = useTranslations('budget');
  const tPath = useTranslations('path');
  const tNeutral = useTranslations('neutral');
  const { path } = usePath();
  const [pane, setPane] = useState<Pane>('client');

  // Active door click syncs the contact tab to that path. Deliberate state sync
  // — pane can also be changed by direct tab click, so we don't fully derive it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (path) setPane(path);
  }, [path]);

  const heading = (
    path ? tPath.raw(`${path}.contactH3`) : tNeutral.raw('contactH3')
  ) as string;
  const lead = path ? tPath(`${path}.contactP`) : tNeutral('contactP');

  return (
    <section id="contact" className="section-pad">
      <div className="contact-wrap">
        <div className="contact-copy">
          <div className="section-num">
            04 — <span>{tContact('num')}</span>
          </div>
          <h3 dangerouslySetInnerHTML={{ __html: heading }} />
          <p>{lead}</p>
        </div>

        <div className="contact-card">
          <div className="cc-tabs">
            {(['client', 'partner', 'earn'] as Pane[]).map((p) => (
              <button
                type="button"
                key={p}
                className={`cc-tab${pane === p ? ' active' : ''}`}
                onClick={() => setPane(p as Path)}
              >
                {tContact(`tab.${p}`)}
              </button>
            ))}
          </div>

          {pane === 'client' && (
            <div className="cc-pane active">
              <div className="cc-row">
                <div className="cc-field">
                  <label>{tForm('name.label')}</label>
                  <input type="text" placeholder={tForm('name.ph')} />
                </div>
                <div className="cc-field">
                  <label>{tForm('company.label')}</label>
                  <input type="text" placeholder={tForm('company.ph')} />
                </div>
              </div>
              <div className="cc-field">
                <label>{tForm('email')}</label>
                <input type="email" placeholder="you@company.com" />
              </div>
              <div className="cc-field">
                <label>{tForm('need.label')}</label>
                <textarea placeholder={tForm('need.ph')} />
              </div>
              <div className="cc-field">
                <label>{tForm('budget')}</label>
                <select>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <option key={i}>{tBudget(`${i}`)}</option>
                  ))}
                </select>
              </div>
              <PrototypeSubmit label={tForm('client.submit')} />
              <p className="cc-fine">{tForm('client.fine')}</p>
            </div>
          )}

          {pane === 'partner' && (
            <div className="cc-pane active">
              <div className="cc-field">
                <label>{tForm('name.label')}</label>
                <input type="text" placeholder={tForm('name.ph')} />
              </div>
              <div className="cc-field">
                <label>{tForm('email')}</label>
                <input type="email" placeholder="you@email.com" />
              </div>
              <div className="cc-field">
                <label>{tForm('idea.label')}</label>
                <textarea placeholder={tForm('idea.ph')} />
              </div>
              <div className="cc-field">
                <label>{tForm('bring.label')}</label>
                <textarea placeholder={tForm('bring.ph')} />
              </div>
              <PrototypeSubmit label={tForm('partner.submit')} />
              <p className="cc-fine">{tForm('partner.fine')}</p>
            </div>
          )}

          {pane === 'earn' && (
            <EarnPane />
          )}
        </div>
      </div>
    </section>
  );
}

function EarnPane() {
  const t = useTranslations('auth.signIn');
  return (
    <div className="cc-pane active">
      <div className="auth-status auth-status-compact">
        <span className="auth-status-dot" />
        {t('liveStatus')}
      </div>
      <p className="cc-earn-headline">{t('newSubtitle')}</p>

      <EmailAuthForm initialMode="signup" showModeTabs={false} />

      <div className="auth-divider auth-divider-compact">
        <span>{t('orDivider')}</span>
      </div>

      <GoogleSignInButton variant="compact" />

      <ul className="auth-benefits auth-benefits-compact">
        <li>
          <span className="ab-tick">✓</span>
          {t('benefits.1')}
        </li>
        <li>
          <span className="ab-tick">✓</span>
          {t('benefits.2')}
        </li>
        <li>
          <span className="ab-tick">✓</span>
          {t('benefits.3')}
        </li>
      </ul>
      <p className="cc-fine">{t('socialProof')}</p>
    </div>
  );
}

// TODO step 07-CONTACT: wire submits to Resend.
function PrototypeSubmit({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="cc-submit"
      onClick={(e) => {
        const btn = e.currentTarget;
        const orig = btn.textContent;
        btn.textContent =
          document.documentElement.lang === 'es'
            ? 'Prototipo — se conecta en desarrollo'
            : 'Prototype — wires up in build phase';
        setTimeout(() => {
          btn.textContent = orig;
        }, 1500);
      }}
    >
      {label}
    </button>
  );
}
