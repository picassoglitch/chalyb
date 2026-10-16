// Señales first activation loading: the wizard bar paints on the click.

import { getTranslations } from 'next-intl/server';
import { WizardLoading } from '@/components/tools/tool-loading';

export default async function Loading() {
  const tw = await getTranslations('wizard');
  return (
    <WizardLoading
      chrome={{
        slug: 'chalybcrypto',
        toolName: 'Señales',
        backHref: '/app/senales',
        backLabel: tw('back'),
        closeLabel: tw('close'),
      }}
    />
  );
}
