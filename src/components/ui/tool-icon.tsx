// Tool glyphs for the new design system: one lucide icon per tool slug
// (rebuild prompt §5 "Icons"), in the tool's own color when it has one
// (config/tools.ts, TOOLS-SPEC F9); the accent otherwise.

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
import type { CSSProperties } from 'react';
import { TOOL_COLORS } from '@/config/tools';

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
  const color = TOOL_COLORS[slug];
  const style: CSSProperties = {
    ...(color ? ({ '--tool': color } as CSSProperties) : {}),
    ...(size === 'sm' ? { width: 38, height: 38, borderRadius: 10 } : {}),
  };
  return (
    <span
      aria-hidden="true"
      className={`ch-tool-ic${filled ? ' ch-tool-ic--fill' : ''}${color ? ' ch-tool-ic--own' : ''}`}
      style={style}
    >
      <Icon strokeWidth={2} style={size === 'sm' ? { width: 21, height: 21 } : undefined} />
    </span>
  );
}
