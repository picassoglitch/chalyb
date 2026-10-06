import { LayoutGrid, Lightbulb } from 'lucide-react';
import { TOOL_ICONS } from '@/components/ui/tool-icon';

/** A tool's colored tile with its white glyph (mockup 10 `.tico`). */
export function ToolTile({
  slug,
  color,
  size = 48,
}: {
  slug: string;
  color: string;
  size?: number;
}) {
  const Icon = slug === 'idea' ? Lightbulb : (TOOL_ICONS[slug] ?? LayoutGrid);
  return (
    <span
      aria-hidden="true"
      className="pub-tico"
      style={{
        background: color,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.29),
      }}
    >
      <Icon strokeWidth={2.2} style={{ width: size * 0.48, height: size * 0.48 }} />
    </span>
  );
}
