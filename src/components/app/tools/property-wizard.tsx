'use client';

// Inmuebles (P3-12): title → details and photos → the shareable card.

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createProperty } from '@/lib/tools/extra-actions';
import type { PropertyCard } from '@/lib/tools/adapters/tools';
import { StepBar } from '@/components/ui/primitives';
import { useWizardStep } from '@/components/ui/use-wizard-step';

export function PropertyWizard() {
  const t = useTranslations('homes');
  const tw = useTranslations('wizard');
  const te = useTranslations('errors.tool');
  const [step, setStep] = useWizardStep([1, 2, 3] as const, 1, (s) => s === 1);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState('');
  const [card, setCard] = useState<PropertyCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      setError(null);
      const r = await createProperty({ title, details, photos });
      if (r.ok) {
        setCard(r.card);
        setStep(3);
      } else setError(r.code === 'INVALID' ? tw('fixFields') : te('UNKNOWN'));
    });

  async function share() {
    if (!card) return;
    if (navigator.share) {
      await navigator.share({ title: card.title, url: card.shareUrl }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(card.shareUrl).catch(() => {});
    setCopied(true);
  }

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {step < 3 && <StepBar step={step} label={tw('step', { n: step })} />}
      {step === 1 && (
        <form style={{ display: 'grid', gap: 18 }} onSubmit={(e) => { e.preventDefault(); if (title.trim()) setStep(2); }}>
          <h1 className="ch-h1">{t('s1.title')}</h1>
          <div className="ch-field">
            <label htmlFor="ttl">{t('s1.name')}</label>
            <input id="ttl" className="ch-input" required maxLength={120} placeholder={t('s1.namePh')} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">{tw('continue')}</button>
        </form>
      )}
      {step === 2 && (
        <form style={{ display: 'grid', gap: 18 }} onSubmit={(e) => { e.preventDefault(); create(); }}>
          <h1 className="ch-h1">{t('s2.title')}</h1>
          <p className="ch-sub">{t('s2.sub')}</p>
          <div className="ch-field">
            <label htmlFor="det">{t('s2.label')}</label>
            <textarea id="det" className="ch-input ch-textarea" required rows={6} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="ch-field">
            <label htmlFor="ph">{t('s2.photos')}</label>
            <textarea id="ph" className="ch-input ch-textarea" rows={3} inputMode="url" value={photos} onChange={(e) => setPhotos(e.target.value)} />
          </div>
          {error && <p role="alert" className="ch-err">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="ch-btn ch-btn--secondary" onClick={() => setStep(1)}>{tw('back')}</button>
            <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl" style={{ flex: 1 }} disabled={pending}>{tw('continue')}</button>
          </div>
        </form>
      )}
      {step === 3 && card && (
        <div style={{ display: 'grid', gap: 18 }}>
          <h1 className="ch-h1">{t('s3.title')}</h1>
          <article className="ch-card" style={{ padding: 20, display: 'grid', gap: 10 }}>
            {card.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.photos[0]} alt="" style={{ width: '100%', borderRadius: 14, aspectRatio: '16/9', objectFit: 'cover' }} />
            )}
            <h2 className="ch-h2">{card.title}</h2>
            <p style={{ whiteSpace: 'pre-line' }}>{card.description}</p>
          </article>
          <button type="button" className="ch-btn ch-btn--primary ch-btn--xl" onClick={share}>{t('s3.share')}</button>
          {copied && <p role="status" className="ch-muted">{t('s3.copied')}</p>}
          <button type="button" className="ch-btn ch-btn--secondary" onClick={() => { setTitle(''); setDetails(''); setPhotos(''); setCard(null); setCopied(false); setStep(1); }}>
            {t('s3.another')}
          </button>
        </div>
      )}
      <p className="ch-muted" style={{ fontSize: 15 }}>{t('note')}</p>
    </div>
  );
}
