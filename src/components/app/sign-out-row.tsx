'use client';

// "Cerrar sesión" as a Mi cuenta row.

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function SignOutRow() {
  const t = useTranslations('auth.account');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Land logged-out regardless; the next request re-reads the session.
    }
    // next-intl's router keeps the reader's language (/en, not the Spanish /).
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      className="ch-row"
      onClick={signOut}
      disabled={pending}
      aria-busy={pending}
    >
      <span className="ch-row__ic" style={{ background: 'var(--bad)' }} aria-hidden="true">
        <LogOut />
      </span>
      <span className="ch-row__tx">
        <b style={{ color: 'var(--bad)' }}>{pending ? t('signingOut') : t('signOut')}</b>
      </span>
    </button>
  );
}
