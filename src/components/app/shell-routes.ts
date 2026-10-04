// Which layout and nav item each /app path gets. Pure, unit-tested.
//
//   wizard  — focus layout, no navigation (BUILD-SPEC §0.7): the Clips flow.
//   modern  — the new light screens built so far.
//   legacy  — screens later phases rebuild; they keep their dark cc- theme in
//             a contained panel inside the new shell.

export type ShellMode = 'wizard' | 'modern' | 'legacy';
export type NavKey = 'inicio' | 'resultados' | 'cuenta';

export const NAV_ITEMS: { key: NavKey; href: string }[] = [
  { key: 'inicio', href: '/app' },
  { key: 'resultados', href: '/app/history' },
  { key: 'cuenta', href: '/app/settings' },
];

/** Screens rebuilt on the new design system. Grows phase by phase. */
const MODERN = new Set([
  '/app',
  '/app/settings',
  '/app/billing',
  '/app/subscription',
  '/app/usage',
  '/app/settings/perfil',
  '/app/planes',
  '/app/_ui',
  '/app/herramientas',
  '/app/history',
  '/app/help',
  '/app/avisos',
]);

/** Step-by-step flows: focus layout, no navigation. The Clips wizard
 *  (nuevo → formato → trabajo), the first Señales activation, the trial
 *  path and the tools outside the registry. */
const WIZARD =
  /^\/app\/(clips\/nuevo|clips\/trabajo|senales\/empezar|prueba|herramientas\/[^/]+)(\/|$)/;

/** Inside a tool (TOOLS-SPEC §3 ToolShell): the sidebar stays. */
const TOOL = /^\/app\/(clips|senales|en-vivo)(\/|$)/;

/** Strip a leading /en (the default locale is unprefixed) and trailing slash. */
export function normalizeAppPath(pathname: string): string {
  const p = pathname.replace(/^\/(en|es)(?=\/|$)/, '').replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function shellModeFor(pathname: string): ShellMode {
  const p = normalizeAppPath(pathname);
  if (WIZARD.test(p)) return 'wizard';
  if (p === '/app/billing/cambiar' || p === '/app/billing/tarjeta') return 'wizard';
  if (MODERN.has(p) || TOOL.test(p)) return 'modern';
  return 'legacy';
}

/** The nav item a path belongs to. Tool pages live under Inicio; the old
 *  account screens (plan, usage, billing, messages, help) under Mi cuenta. */
export function activeNavFor(pathname: string): NavKey | null {
  const p = normalizeAppPath(pathname);
  if (p === '/app/history' || p.startsWith('/app/history/')) return 'resultados';
  if (/^\/app\/(settings|subscription|usage|billing|messages|help|planes)(\/|$)/.test(p))
    return 'cuenta';
  if (p === '/app' || /^\/app\/(engines|clips|herramientas|senales|en-vivo)(\/|$)/.test(p)) return 'inicio';
  return null;
}

export { planLabelKey, type PlanLabelKey } from '@/lib/billing/plan-label';
