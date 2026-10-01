// Where each tool lives in the hub, and where its card leads. Pure.

export const TOOL_ROUTES: Record<string, string> = {
  chalybclip: '/app/clips',
  chalybcrypto: '/app/senales',
  chalybobs: '/app/en-vivo',
  chalybbot: '/app/herramientas/asistente',
  chalybpicks: '/app/herramientas/pronosticos',
  chalybrealtor: '/app/herramientas/inmuebles',
  chalybtrade: '/app/herramientas/inversiones',
};

/** The tool's own screens when the hub runs it; the launch page otherwise. */
export function toolHref(slug: string, hubRunsIt: boolean): string {
  return hubRunsIt && TOOL_ROUTES[slug] ? TOOL_ROUTES[slug]! : `/app/engines/${slug}`;
}

/** Tools that need the risk notice before first use (aceptacion-ux §6). */
export const RISK_TOOLS = new Set(['chalybcrypto', 'chalybpicks', 'chalybtrade']);
