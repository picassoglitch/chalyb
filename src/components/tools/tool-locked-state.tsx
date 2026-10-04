// A tool the plan doesn't include (trial_offer; TOOLS-SPEC §5.2, §6.2,
// mockup 24 panel 3 layout). The 7-day trial button only while the trial can
// be honoured (K-7, C4); otherwise the plans. Never a lock icon.

import { getTranslations } from 'next-intl/server';
import { Sparkles } from 'lucide-react';
import { toolBySlug } from '@/config/tools';
import { ButtonLink } from '@/components/ui/primitives';
import { toolCardAction } from '@/lib/tools/matrix';
import { paidCheckoutEnabled, proIncludesAllTools, trialFlowEnabled } from '@/lib/config/flags';
import type { Entitlements } from '@/lib/billing/entitlement';

/** What the locked state offers, the same decision as the tool cards. */
export function lockedOffer(entitlements: Entitlements) {
  const action = toolCardAction('trial_offer', {
    plan: entitlements.plan,
    trialUsed: entitlements.trialUsed,
    trialFlow: trialFlowEnabled(),
    proIncludesAllTools: proIncludesAllTools(),
  });
  const trial = action.pill === 'inPro' && action.button === 'try';
  const href = trial
    ? '/app/prueba'
    : action.pill === 'inPro' && action.button === 'return'
      ? '/app/planes'
      : paidCheckoutEnabled()
        ? '/app/planes'
        : '/app/subscription';
  return { trial, href };
}

export async function ToolLockedState({
  slug,
  entitlements,
}: {
  slug: string;
  entitlements: Entitlements;
}) {
  const tool = toolBySlug(slug)!;
  const t = await getTranslations('toolShell.locked');
  const { trial, href } = lockedOffer(entitlements);
  return (
    <section className="ch-card ch-state" aria-labelledby="locked-title">
      <span className="ch-state__ic" aria-hidden="true">
        <Sparkles />
      </span>
      <h2 id="locked-title" className="ch-h2">
        {t('title', { herramienta: tool.name })}
      </h2>
      <p className="ch-muted" style={{ maxWidth: 520 }}>
        {trial ? t('bodyTrial') : t('bodyPlans')}
      </p>
      <ButtonLink href={href} size="xl">
        {trial ? t('ctaTrial') : t('ctaPlans')}
      </ButtonLink>
    </section>
  );
}
