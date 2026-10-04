// Server wrapper: renders the risk sheet with its copy (TOOLS-SPEC §5.1).
// The 3 points and the full notice both show (Q3 default); the legal text
// comes from consents.risk.body, aceptacion-ux §6 verbatim.

import { getTranslations } from 'next-intl/server';
import { toolBySlug } from '@/config/tools';
import { RiskAckSheet } from './risk-ack-sheet';

export async function RiskAck({ slug, locale }: { slug: string; locale: string }) {
  const name = toolBySlug(slug)?.name ?? slug;
  const t = await getTranslations('toolShell.risk');
  const tc = await getTranslations('consents.risk');
  return (
    <RiskAckSheet
      slug={slug}
      locale={locale}
      copy={{
        title: tc('title'),
        sub: t('sub'),
        points: [1, 2, 3].map((n) => ({ title: t(`b${n}.title`), body: t(`b${n}.body`) })),
        legalK: t('legalK'),
        legal: tc.markup('body', { herramienta: name, b: (c) => `<b>${c}</b>` }),
        read: tc('read'),
        check: tc('check'),
        cta: tc('cta'),
        hint: t('hint'),
        error: tc('error'),
        close: tc('close'),
      }}
    />
  );
}
