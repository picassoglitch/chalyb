'use client';
// The "Hacer clips" source picker for the page's loading state: it reads the
// pick from the URL (?fuente=…), so switching sources keeps the picker on
// screen, already showing the new pick, while the source's panel loads.

import { useSearchParams } from 'next/navigation';
import { clipSourceHref, parseClipSource } from '@/lib/tools/clips-sources';
import { ClipsSubnav } from './subnav';

export function SourcePickerLive({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const current = clipSourceHref(parseClipSource(useSearchParams().get('fuente')));
  return (
    <div className="ch-ce-picker">
      <ClipsSubnav label={label} current={current} items={items} />
    </div>
  );
}
