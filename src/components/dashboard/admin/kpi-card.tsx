// One number on the owner panel (P5). A value is real or it isn't shown:
// `value === null` renders "—" plus why; `example` adds the "Ejemplo" tag
// (P5-7) and is the only way a non-measured number can appear.

import type { ReactNode } from 'react';
import { ExampleTag } from '@/components/ui/primitives';

export function KpiCard({
  label,
  value,
  sub,
  trend,
  example,
  exampleLabel,
}: {
  label: string;
  value: string | null;
  sub?: ReactNode;
  trend?: 'up' | 'down' | null;
  example?: boolean;
  exampleLabel?: string;
}) {
  return (
    <section className="ch-card ch-kpi" aria-label={label}>
      <h2 className="ch-kpi__k">
        {label} {example && <ExampleTag>{exampleLabel}</ExampleTag>}
      </h2>
      <p className="ch-kpi__v">{value ?? '—'}</p>
      {sub && <p className={`ch-kpi__s${trend ? ` ch-kpi__s--${trend}` : ''}`}>{sub}</p>}
    </section>
  );
}
