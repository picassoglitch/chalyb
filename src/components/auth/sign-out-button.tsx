'use client';

import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Route } from 'next';

export function SignOutButton() {
  const t = useTranslations('auth.account');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/' as Route);
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="border border-white/15 hover:border-white/40 rounded-full px-6 py-3 font-medium text-sm transition disabled:opacity-50"
    >
      {loading ? '...' : t('signOut')}
    </button>
  );
}
