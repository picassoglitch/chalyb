import { setRequestLocale } from 'next-intl/server';
import { Onboarding } from '@/components/tools/chalito/Onboarding';
import { agentOptions } from '@/lib/chalito/web/providers';

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Onboarding agents={agentOptions()} />;
}
