'use client';

// Closing a banner lasts for the browser session (SCR-17).

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

export function ClosableBanner({ id, children }: { id: string; children: ReactNode }) {
  const t = useTranslations('cancel');
  const key = `chalyb.banner.${id}`;
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount
      setClosed(window.sessionStorage.getItem(key) === '1');
    } catch {
      // storage blocked: the banner just stays
    }
  }, [key]);
  if (closed) return null;
  return (
    <div className="ch-closable" style={{ position: 'relative' }}>
      {children}
      <button
        type="button"
        aria-label={t('close')}
        onClick={() => {
          setClosed(true);
          try {
            window.sessionStorage.setItem(key, '1');
          } catch {}
        }}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 44,
          height: 44,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <X aria-hidden="true" width={18} height={18} />
      </button>
    </div>
  );
}
