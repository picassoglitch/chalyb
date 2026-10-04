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

/** The tool's own screens: every tool opens inside the app (TOOLS-SPEC
 *  §0.1). A tool with no screen of its own lands on Tus herramientas. */
export function toolHref(slug: string): string {
  return TOOL_ROUTES[slug] ?? '/app/herramientas';
}

/** Tools that need the risk notice before first use (aceptacion-ux §6). */
export const RISK_TOOLS = new Set(['chalybcrypto', 'chalybpicks', 'chalybtrade']);
