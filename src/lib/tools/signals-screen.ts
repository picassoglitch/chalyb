// Engine text through the §8 filter before any screen shows it. A flagged
// text is dropped (the card then shows only "Ver detalle") and the case is
// logged without the text itself.

import { screenSignalText } from '@/lib/guardrails/signals';
import type { Signal } from './adapters/tools';

export function screenSignal(s: Signal): Signal {
  const short = screenSignalText(s.why?.short);
  const bullets = (s.why?.bullets ?? [])
    .map(screenSignalText)
    .filter((b): b is string => !!b)
    .slice(0, 3);
  const explanation = screenSignalText(s.explanation) ?? '';
  const flagged =
    (s.why?.short && !short) ||
    bullets.length < Math.min(3, s.why?.bullets.length ?? 0) ||
    (s.explanation && !explanation);
  if (flagged) console.warn('[signals] engine text held back by the §8 filter', s.id);
  return {
    ...s,
    explanation,
    why: s.why ? { short: short ?? '', bullets } : undefined,
  };
}
