// 28×28 checkbox, always unchecked by default (BUILD-SPEC §1.5).

import type { ReactNode } from 'react';

export function Checkbox({
  name,
  children,
  required,
}: {
  name: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="ch-check">
      <input type="checkbox" name={name} required={required} defaultChecked={false} />
      <span>{children}</span>
    </label>
  );
}
