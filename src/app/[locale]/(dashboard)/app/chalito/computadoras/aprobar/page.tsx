import { setRequestLocale } from 'next-intl/server';
import { ApproveComputer } from '@/components/tools/chalito/ApproveComputer';
import { LiveGate } from '@/components/tools/chalito/LiveGate';

// "Aprobar computadora" (ADR 0028 §3): the desktop app opens this with #c=<codeId>. A first-ever
// account activates this browser here and stays on the page (stayAfterActivation).
export default async function ApproveComputerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return (
    <LiveGate stayAfterActivation>
      <ApproveComputer />
    </LiveGate>
  );
}
