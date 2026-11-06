// The public site's view of the tools (rebuild P4-4, Q20). Everything the
// landing lists, counts or shows as an example result derives from the
// ACTIVE tools, so a tool that isn't finished never appears as working.
//
// Pure: no imports beyond the display-name map, so tests and client code can
// use it. The server read lives in public-tools-server.ts.

import {
  ENGINE_DISPLAY_NAMES,
  HIDDEN_FROM_CUSTOMERS,
  TOOL_COLORS,
} from '@/lib/engines/display-names';

/** The seven tools in display order (§4). */
export const TOOL_ORDER = [
  'chalybclip',
  'chalybcrypto',
  'chalybobs',
  'chalybbot',
  'chalybpicks',
  'chalybrealtor',
  'chalybtrade',
] as const;

export type ToolSlug = (typeof TOOL_ORDER)[number];

/** Marketing scope and examples for design fixtures. This list is not
 *  evidence that either tool is active; public pages must read the catalog. */
export const FALLBACK_ACTIVE: readonly ToolSlug[] = ['chalybclip', 'chalybobs'];

export interface PublicTool {
  slug: ToolSlug;
  name: string;
  color: string;
}

const isToolSlug = (s: string): s is ToolSlug => (TOOL_ORDER as readonly string[]).includes(s);

// Owner request 2026-11-03: the public site sells only Clips and En vivo. Marketing only;
// in-app access still follows engines.status (hide tools in Admin → Herramientas).
export const PUBLIC_TOOLS: ReadonlySet<ToolSlug> = new Set(FALLBACK_ACTIVE);

/** Active, customer-visible tools from catalog rows, in display order. */
export function activeTools(rows: ReadonlyArray<{ slug: string; status: string }>): PublicTool[] {
  const active = new Set(
    rows
      .filter((r) => r.status === 'active' && !HIDDEN_FROM_CUSTOMERS.has(r.slug))
      .map((r) => r.slug),
  );
  return TOOL_ORDER.filter((s) => active.has(s) && PUBLIC_TOOLS.has(s)).map(toPublicTool);
}

/** An empty or failed catalog read advertises nothing. The reader is injected
 *  so tests can simulate outages without a database. */
export async function readActiveTools(
  readCatalog: () => Promise<ReadonlyArray<{ slug: string; status: string }> | null>,
  onUnavailable: (err: unknown) => void,
): Promise<PublicTool[]> {
  let rows: Awaited<ReturnType<typeof readCatalog>>;
  try {
    rows = await readCatalog();
  } catch (err) {
    onUnavailable(err);
    return [];
  }
  if (!rows) {
    onUnavailable(new Error('catalog read returned no data'));
    return [];
  }
  return activeTools(rows);
}

export function toPublicTool(slug: ToolSlug): PublicTool {
  return { slug, name: ENGINE_DISPLAY_NAMES[slug]!, color: TOOL_COLORS[slug]! };
}

/** Example tools for design fixtures; never use as a catalog outage fallback. */
export function fallbackTools(): PublicTool[] {
  return FALLBACK_ACTIVE.map(toPublicTool);
}

/** The "Mientras dormías" panel: one example row per active tool, at most 4.
 *  Each row is a `landing.hero.rows.<slug>` message (label, detail, pill). */
export function heroRows(tools: readonly PublicTool[]): PublicTool[] {
  return tools.filter((t) => isToolSlug(t.slug)).slice(0, 4);
}

export type AudienceKey = 'streamers' | 'creators' | 'business' | 'investors';

/** "Para quién" cards. Negocios needs Asistente; "Quien invierte" needs
 *  Señales or Inversiones (BUILD-SPEC §8.1). */
export function audienceCards(tools: readonly PublicTool[]): AudienceKey[] {
  const has = (s: ToolSlug) => tools.some((t) => t.slug === s);
  const cards: AudienceKey[] = ['streamers', 'creators'];
  if (has('chalybbot')) cards.push('business');
  if (has('chalybcrypto') || has('chalybtrade')) cards.push('investors');
  return cards;
}

/** "Clips, Señales y En vivo" / "Clips, Señales, and En vivo". */
export function toolList(tools: readonly PublicTool[], locale: string): string {
  return new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'conjunction' }).format(
    tools.map((t) => t.name),
  );
}
