// Señales first activation loading: the wizard bar paints on the click.

import { getLocale, getTranslations } from 'next-intl/server';
import { WizardLoading } from '@/components/tools/tool-loading';
import { localizedToolName } from '@/lib/engines/display-names';

export default async function Loading() {
  const tw = await getTranslations('wizard');
  return (
    <WizardLoading
      chrome={{
        slug: 'chalybcrypto',
        toolName: localizedToolName('Señales', await getLocale()),
        backHref: '/app/senales',
        backLabel: tw('back'),
        closeLabel: tw('close'),
      }}
    />
  );
}
