// Renders the two inline tags billing copy uses — <b>…</b> and
// <terms>…</terms> — and nothing else: every other character is text, so a
// value can never inject markup. The same strings, stripped, are what the
// consent evidence stores.

import type { ReactNode } from 'react';

export function Markup({ text, termsHref = '/suscripcion' }: { text: string; termsHref?: string }) {
  const out: ReactNode[] = [];
  const re = /<(b|terms)>(.*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] === 'b' ? (
        <b key={i++}>{m[2]}</b>
      ) : (
        <a key={i++} href={termsHref} className="ch-lnk" target="_blank" rel="noopener">
          {m[2]}
        </a>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
