// The tools the app runs in its own screens (TOOLS-SPEC §1.2). Pure.
//
// The internal slug (engines.slug, flags, env vars) never changes; only the
// visible route and name do. Only `live: true` tools show in Inicio, Tus
// herramientas (61) and "También incluido" (§7.2, Q9: none beyond the 3).

export type ToolTabKey = 'main' | 'history' | 'settings';

export interface ToolDef {
  slug: string;
  /** Visible route under /app. */
  route: string;
  /** Display name (a product name, the same in both languages). */
  name: string;
  /** Icon box color (BUILD-SPEC §1.1, F9). */
  color: string;
  live: boolean;
  /** Prefix of the support code shown when the tool fails (§1.2). */
  supportPrefix: string;
  /** At most 3 tabs, each with its own route (§3 ToolTabs). */
  tabs: { key: ToolTabKey; href: string }[];
  /** Asks for the risk notice (aceptacion-ux §6) before first use. */
  needsRiskAck?: boolean;
}

export const TOOLS: readonly ToolDef[] = [
  {
    slug: 'chalybclip',
    route: '/app/clips',
    name: 'Clips',
    color: '#5B4BFF',
    live: true,
    supportPrefix: 'CLP',
    tabs: [
      { key: 'main', href: '/app/clips' },
      { key: 'history', href: '/app/clips/mis-clips' },
      { key: 'settings', href: '/app/clips/ajustes' },
    ],
  },
  {
    slug: 'chalybcrypto',
    route: '/app/senales',
    name: 'Señales',
    color: '#FF9F0A',
    live: true,
    supportPrefix: 'SEN',
    needsRiskAck: true,
    tabs: [
      { key: 'main', href: '/app/senales' },
      { key: 'history', href: '/app/senales/historial' },
      { key: 'settings', href: '/app/senales/ajustes' },
    ],
  },
  {
    slug: 'chalybobs',
    route: '/app/en-vivo',
    name: 'En vivo',
    color: '#FF375F',
    live: true,
    supportPrefix: 'VIV',
    tabs: [
      { key: 'main', href: '/app/en-vivo' },
      { key: 'history', href: '/app/en-vivo/transmisiones' },
      { key: 'settings', href: '/app/en-vivo/ajustes' },
    ],
  },
  {
    slug: 'chalito',
    route: '/app/chalito',
    name: 'Chalito',
    color: '#30D158',
    live: true,
    supportPrefix: 'CHL',
    tabs: [
      { key: 'main', href: '/app/chalito' },
      { key: 'history', href: '/app/chalito/sesiones' },
      { key: 'settings', href: '/app/chalito/ajustes' },
    ],
  },
] as const;

export const MAIN_TOOL_SLUGS = TOOLS.map((t) => t.slug);

export function toolBySlug(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/** The tool a visible /app path belongs to (locale already stripped). */
export function toolForPath(path: string): ToolDef | undefined {
  return TOOLS.find((t) => path === t.route || path.startsWith(`${t.route}/`));
}

/** The tab a path selects: an exact tab route wins, then the longest prefix,
 *  and anything else inside the tool (detail screens) falls back to main or
 *  the tab whose route it extends. */
export function activeTabFor(tool: ToolDef, path: string): ToolTabKey {
  const hit = [...tool.tabs]
    .filter((t) => t.key !== 'main')
    .find((t) => path === t.href || path.startsWith(`${t.href}/`));
  return hit?.key ?? 'main';
}

/** Tool icon color by slug, for the tools outside the registry too. */
export const TOOL_COLORS: Record<string, string> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t.color]),
);
