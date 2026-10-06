import { notFound } from 'next/navigation';
import { Coins, Globe, Scissors } from 'lucide-react';
import {
  Avatar,
  Banner,
  ButtonLink,
  Card,
  Chip,
  DisclosureBlock,
  ExampleTag,
  Group,
  Pill,
  Row,
  Skeleton,
  StateBlock,
  StepBar,
  TaskCard,
} from '@/components/ui/primitives';
import { ToolIcon } from '@/components/ui/tool-icon';
import { Segmented } from '@/components/ui/segmented';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { KitchenSinkClient } from './client';

// /app/_ui — every design-system primitive on one page (P1-1). Development
// only: production answers 404. Not customer copy, so it is exempt from
// check:copy (see scripts/check-hardcoded-copy.mjs).

export default function KitchenSink() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <h1 className="ch-h1">Kitchen sink</h1>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ButtonLink href="/app/_ui">Primary</ButtonLink>
        <ButtonLink href="/app/_ui" variant="secondary">Secondary</ButtonLink>
        <ButtonLink href="/app/_ui" variant="gray">Gray</ButtonLink>
        <ButtonLink href="/app/_ui" variant="danger">Danger</ButtonLink>
        <ButtonLink href="/app/_ui" variant="ok">Hablar con una persona</ButtonLink>
        <ButtonLink href="/app/_ui" variant="dark">Sí, cancelar</ButtonLink>
        <ButtonLink href="/app/_ui" size="xl">Extra large</ButtonLink>
      </section>

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip>Chip</Chip>
        <Chip on>Selected</Chip>
        <Pill kind="ok" check>Listos</Pill>
        <Pill kind="acc">Recomendado</Pill>
        <Pill kind="warn">Pago pendiente</Pill>
        <Pill kind="bad">Falló</Pill>
        <Pill kind="gray">Gris</Pill>
        <Pill kind="dark">Oscuro</Pill>
        <ExampleTag>Ejemplo</ExampleTag>
        <Avatar name="Ana Pérez" />
        <ToolIcon slug="chalybclip" filled />
        <ToolIcon slug="chalybcrypto" />
      </section>

      <div className="ch-tasks">
        <TaskCard href="/app/_ui" slug="chalybclip" label="Clips" title="Task card (first)" body="Accent ring." first />
        <TaskCard href="/app/_ui" slug="chalybobs" label="En vivo" title="Task card" body="Plain." />
      </div>

      <Group title="Group">
        <Row icon={<Coins />} iconColor="#FF9F0A" title="Row with value" value="Valor" href="/app/_ui" />
        <Row icon={<Globe />} iconColor="#0A84FF" title="Row with detail" detail="Detalle" />
      </Group>

      <Card style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field id="ks-field" label="Field" placeholder="https://youtube.com/..." hint="Hint text." />
        <Checkbox name="ks-check">Checkbox, unchecked by default.</Checkbox>
        <Segmented name="ks-seg" legend="Segmented" defaultValue={6} options={[3, 6, 10].map((n) => ({ value: n, label: String(n) }))} />
        <StepBar step={2} label="Paso 2 de 3" />
        <KitchenSinkClient />
      </Card>

      <DisclosureBlock>
        <p>Disclosure block: <b>bold dates and amounts</b>, never under 14px, never gray.</p>
      </DisclosureBlock>

      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden' }}>
        <Banner kind="trial" action={{ href: '/app/_ui', label: 'Acción' }}>Banner trial</Banner>
        <Banner kind="warn" action={{ href: '/app/_ui', label: 'Acción' }}>Banner warn</Banner>
        <Banner kind="gray">Banner gray</Banner>
        <Banner kind="bad" action={{ href: '/app/_ui', label: 'Acción' }}>Banner bad</Banner>
      </div>

      <StateBlock icon={<Scissors />} title="Empty state" body="One primary action." action={{ href: '/app/_ui', label: 'Primary' }} />
      <Skeleton height={140} />
    </div>
  );
}
