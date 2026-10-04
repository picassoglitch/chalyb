'use client';

// Before connecting a platform: aceptacion-ux §7, word for word, then one
// button (TOOLS-SPEC §3 ConnectAccountSheet). TODO(Law/OPS): the
// `social_connect` consent event TOOLS-SPEC §6.3 names isn't a
// consent_events type yet (consent-core), so nothing is recorded here.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sheet } from '@/components/ui/sheet';
import { Markup } from '@/components/ui/markup';

export function ConnectAccountSheet({
  open,
  platformName,
  onClose,
  onConnect,
}: {
  open: boolean;
  platformName: string;
  onClose: () => void;
  onConnect: () => Promise<boolean>;
}) {
  const tc = useTranslations('consents.connect');
  const t = useTranslations('liveTool.settings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('connectTitle', { plataforma: platformName })}
      closeLabel={t('close')}
    >
      <p style={{ marginBottom: 20 }}>
        <Markup text={tc.markup('body', { plataforma: platformName, b: (c) => `<b>${c}</b>` })} />
      </p>
      {error && (
        <p role="alert" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {t('saveError')}
        </p>
      )}
      <button
        type="button"
        className="ch-btn ch-btn--primary ch-btn--xl"
        style={{ width: '100%' }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          const ok = await onConnect();
          setBusy(false);
          if (ok) onClose();
          else setError(true);
        }}
      >
        {tc('cta', { plataforma: platformName })}
      </button>
    </Sheet>
  );
}
