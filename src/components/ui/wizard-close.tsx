'use client';

// The wizard's ✕ (P3-1): straight to Inicio, unless something was typed on
// this screen — then "¿Salir? Lo que escribiste no se guardará."

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { Sheet } from './sheet';

export function WizardClose({ label, href = '/app' }: { label: string; href?: string }) {
  const t = useTranslations('wizard');
  const [confirmTitle, leaveLabel, stayLabel] = [t('unsaved'), t('leave'), t('stay')];
  const dirty = useRef(false);
  const [asking, setAsking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const mark = (e: Event) => {
      const el = e.target as HTMLElement;
      // Free-text input counts; radio/checkbox choices are easy to redo.
      if (el.matches('input[type="text"], input[type="url"], input[type="number"], input:not([type]), textarea'))
        dirty.current = true;
    };
    const clean = () => {
      dirty.current = false;
    };
    main.addEventListener('input', mark);
    main.addEventListener('submit', clean);
    return () => {
      main.removeEventListener('input', mark);
      main.removeEventListener('submit', clean);
    };
  }, []);

  return (
    <>
      <Link
        href={href as Route}
        className="ch-close"
        aria-label={label}
        onClick={(e) => {
          if (!dirty.current) return;
          e.preventDefault();
          setAsking(true);
        }}
      >
        <X aria-hidden="true" />
      </Link>
      <Sheet open={asking} onClose={() => setAsking(false)} title={confirmTitle} closeLabel={stayLabel}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <button type="button" className="ch-btn ch-btn--danger" onClick={() => router.push(href as Route)}>
            {leaveLabel}
          </button>
          <button type="button" className="ch-btn ch-btn--primary" onClick={() => setAsking(false)}>
            {stayLabel}
          </button>
        </div>
      </Sheet>
    </>
  );
}
