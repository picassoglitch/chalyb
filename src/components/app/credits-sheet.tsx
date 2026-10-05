'use client';

// Mis créditos · "Conseguir más créditos" (FIX-3 §B, mockup 72b). Three
// options as radios (the middle one preselected), the button carries the
// chosen amount, and it goes to the existing pack checkout. Esc, ✕ and
// "Ahora no" close and give focus back to the trigger. Amounts come from
// the owner's pack prices (pack-prices.ts), formatted on the server; nothing
// written by hand. No packs (prices unreadable) → the sheet says so.

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { ButtonLink } from '@/components/ui/primitives';
import { Markup } from '@/components/ui/markup';

export interface PackOption {
  id: string;
  tokens: number;
  amount: string;
}

const PHRASE = ['small', 'mid', 'big'] as const;

export function CreditsSheet({
  packs,
  defaultOpen = false,
  triggerLabel,
}: {
  packs: PackOption[];
  defaultOpen?: boolean;
  triggerLabel: string;
}) {
  const t = useTranslations('credits');
  const locale = useLocale();
  const [open, setOpen] = useState(defaultOpen);
  const [pick, setPick] = useState(packs[Math.min(1, packs.length - 1)]?.id ?? '');
  const trigger = useRef<HTMLButtonElement>(null);
  const chosen = packs.find((p) => p.id === pick) ?? packs[0];
  const n = (v: number) => v.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US');
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="ch-btn ch-btn--primary"
        style={{ width: '100%' }}
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" /> {triggerLabel}
      </button>
      <Sheet open={open} onClose={close} title={t('sheet.title')} closeLabel={t('sheet.later')}>
        <div style={{ display: 'grid', gap: 14 }}>
          <p className="ch-muted">{t('sheet.sub')}</p>
          <div role="radiogroup" aria-label={t('sheet.title')} className="ch-packs">
            {packs.map((p, i) => (
              <label key={p.id} className={`ch-pack${pick === p.id ? ' ch-pack--on' : ''}`}>
                <input
                  type="radio"
                  name="pack"
                  value={p.id}
                  checked={pick === p.id}
                  onChange={() => setPick(p.id)}
                  className="ch-sr"
                />
                <span className="ch-pack__l">
                  <b>{t('pack.name', { n: n(p.tokens) })}</b>
                  <span className="ch-muted">{t(`pack.${PHRASE[i] ?? 'mid'}`)}</span>
                </span>
                <span className="ch-pack__r">
                  <b>{p.amount} MXN</b>
                  <span className="ch-muted">{t('pack.once')}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="ch-muted">
            <Markup
              text={t.markup('sheet.terms', {
                vigencia: t('sheet.noExpiry'),
                b: (c: string) => `<b>${c}</b>`,
              })}
            />
          </p>
          {packs.length === 0 && (
            <p role="status">{t('sheet.unavailable')}</p>
          )}
          <p className="ch-muted">{t('sheet.card')}</p>
          {chosen && (
            <ButtonLink href={`/app/usage/checkout?pack=${chosen.id}`} variant="primary" size="xl">
              {t('sheet.cta', { monto: chosen.amount })}
            </ButtonLink>
          )}
          <button type="button" className="ch-btn ch-btn--gray" onClick={close}>
            {t('sheet.later')}
          </button>
        </div>
      </Sheet>
    </>
  );
}

/** After a pack payment: refresh until the credits land (≤ 2 min). */
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      router.refresh();
      if (k >= 24) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
