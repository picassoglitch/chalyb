// Tool glyphs for the new design system: one lucide icon per tool slug
// (rebuild prompt §5 "Icons"), tinted by the parent.

import {
  Bot,
  ChartColumn,
  House,
  LayoutGrid,
  Radio,
  Scissors,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export const TOOL_ICONS: Record<string, LucideIcon> = {
  chalybclip: Scissors,
  chalybcrypto: TrendingUp,
  chalybobs: Radio,
  chalybbot: Bot,
  chalybpicks: Target,
  chalybrealtor: House,
  chalybtrade: ChartColumn,
  more: LayoutGrid,
};

export function ToolIcon({
  slug,
  filled = false,
  size = 'lg',
}: {
  slug: string;
  filled?: boolean;
  size?: 'lg' | 'sm';
}) {
  const Icon = TOOL_ICONS[slug] ?? LayoutGrid;
  return (
    <span
      aria-hidden="true"
      className={`ch-tool-ic${filled ? ' ch-tool-ic--fill' : ''}`}
      style={size === 'sm' ? { width: 38, height: 38, borderRadius: 10 } : undefined}
    >
      <Icon strokeWidth={2} style={size === 'sm' ? { width: 21, height: 21 } : undefined} />
    </span>
  );
}
