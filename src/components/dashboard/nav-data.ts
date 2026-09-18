// Admin command-center navigation.
//
// SIX primary destinations, because a Super Admin has four questions —
// ¿quién está en el equipo?, ¿nos pagaron?, ¿qué engines están vivos?, ¿qué
// se rompió? — and every one of them should be at most two clicks away.
//
// It used to be eighteen items across five groups: Overview AND Operaciones
// (two views of the same engines), Revenue AND Billing AND Royalties (three
// views of the same money), plus Streams, Automations, Queues and Workers &
// GPU — surfaces with no backend behind them, several wearing hardcoded
// badges ("31", "7") and a live dot. An operator cannot tell a real surface
// from a mock when they look the same in the nav, so the mocks are demoted
// into Labs and labelled as what they are.
//
// COUNTS: real or absent. A number in this sidebar means something was
// counted just now. `ct` is gone from the static data on purpose — the
// engines badge and the two unread badges are passed in from the server.

export type NavItem = {
  id: string;
  href: string; // locale-agnostic; next-intl Link prefixes /es when needed
  ic: string;
  label: string;
  /** A green dot: this surface updates by itself. Only where that is true. */
  live?: boolean;
  /**
   * No backend behind it yet. Rendered muted with a "sin conectar" chip so
   * nobody reads a demo as production data.
   */
  disconnected?: boolean;
};

export type NavGroup = { grp: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    grp: 'Operación',
    items: [
      // Health, incidents, action now. Absorbed the old Overview.
      { id: 'command', href: '/dashboard', ic: '⬡', label: 'Centro de mando', live: true },
      // Team, roles, plans, invites.
      { id: 'team', href: '/dashboard/team', ic: '👥', label: 'Personas' },
      // The one money hub: payments + P&L + royalties.
      { id: 'money', href: '/dashboard/billing', ic: '$', label: 'Dinero' },
      // Catalogue lifecycle. Models and integrations are sub-views, later.
      { id: 'engines', href: '/dashboard/engines', ic: '◈', label: 'Engines' },
      // Notifications + audit, nothing else.
      { id: 'activity', href: '/dashboard/activity', ic: '◉', label: 'Actividad' },
      { id: 'settings', href: '/dashboard/settings', ic: '⚙', label: 'Ajustes' },
    ],
  },
  {
    // Everything that is not part of running the business today. Real
    // surfaces that are simply secondary sit at the top; the ones with no
    // backend carry `disconnected` and say so in the sidebar.
    grp: 'Labs · fuera del flujo principal',
    items: [
      { id: 'messages', href: '/dashboard/messages', ic: '✉', label: 'Mensajes' },
      { id: 'models', href: '/dashboard/models', ic: '⌬', label: 'AI Models' },
      { id: 'analytics', href: '/dashboard/analytics', ic: '◑', label: 'Analytics' },
      { id: 'api', href: '/dashboard/api', ic: '⌘', label: 'API & Keys' },
      { id: 'streams', href: '/dashboard/streams', ic: '▶', label: 'Streams', disconnected: true },
      {
        id: 'autos',
        href: '/dashboard/automations',
        ic: '⟳',
        label: 'Automations',
        disconnected: true,
      },
      { id: 'queues', href: '/dashboard/queues', ic: '≡', label: 'Queues', disconnected: true },
      {
        id: 'infra',
        href: '/dashboard/infra',
        ic: '▤',
        label: 'Workers & GPU',
        disconnected: true,
      },
    ],
  },
];

// ============================================================
// Subscriber workspace navigation — Free / Pro / VIP tier UI.
// Mounted at /app/*. Distinct from the admin /dashboard sidebar.
//
// STRUCTURE ONLY: no copy lives here. The subscriber shell is served in two
// languages and the labels used to be hardcoded Spanish, so /en/app/settings
// answered in English in the body and Spanish in the chrome around it. `id`
// is the message key — see `workspace.nav` in messages/*.json.
// ============================================================

export type SubscriberNavItem = {
  /** Also the `workspace.nav.<id>` message key. */
  id: string;
  href: string;
  ic: string;
};

export type SubscriberNavGroup = {
  /** `workspace.nav.<groupKey>` message key. */
  groupKey: 'groupAccount' | 'groupPlatform' | 'groupSettings';
  items: SubscriberNavItem[];
};

export const SUBSCRIBER_NAV: SubscriberNavGroup[] = [
  {
    groupKey: 'groupAccount',
    items: [
      { id: 'home', href: '/app', ic: '◉' },
      { id: 'subscription', href: '/app/subscription', ic: '◈' },
      { id: 'usage', href: '/app/usage', ic: '◑' },
      { id: 'billing', href: '/app/billing', ic: '▦' },
    ],
  },
  {
    groupKey: 'groupPlatform',
    items: [
      { id: 'myengines', href: '/app/engines', ic: '◈' },
      { id: 'history', href: '/app/history', ic: '≡' },
    ],
  },
  {
    groupKey: 'groupSettings',
    items: [
      // Messages → bidirectional thread with the admin team. Partners use this
      // for product feedback + ideas; any user can ping the admin from here.
      // Unread count is rendered server-side in the WorkspaceSidebar.
      { id: 'messages', href: '/app/messages', ic: '✉' },
      { id: 'profile', href: '/app/settings', ic: '⚙' },
      { id: 'help', href: '/app/help', ic: '?' },
    ],
  },
];

/**
 * /app pathname → `workspace.pages.<key>` message key.
 *
 * The workspace header used to read PAGE_META, a Spanish-only literal map;
 * these titles now come from the message catalogue like every other piece of
 * user-facing copy.
 */
export function workspacePageKey(pathname: string): string {
  if (pathname === '/app') return 'home';
  const rest = pathname.startsWith('/app/') ? pathname.slice('/app/'.length) : '';
  const head = rest.split('/')[0] ?? '';
  switch (head) {
    case 'subscription':
    case 'usage':
    case 'billing':
    case 'engines':
    case 'history':
    case 'messages':
    case 'help':
      return head;
    case 'settings':
      return 'settings';
    default:
      return 'fallback';
  }
}

/** Admin command-center page headers, keyed by exact pathname.
 *  The /app/* entries moved to the message catalogue — see
 *  workspacePageKey() above and `workspace.pages` in messages/*.json. */
/** Admin command-center page headers, keyed by exact pathname. The /app/*
 *  entries moved to the message catalogue — see workspacePageKey() above
 *  and `workspace.pages` in messages/*.json. */
export const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/dashboard': {
    title: 'Centro de mando',
    sub: 'Salud, incidentes y lo que hay que atender ahora.',
  },
  '/dashboard/team': {
    title: 'Personas',
    sub: 'Equipo, roles, planes e invitaciones.',
  },
  '/dashboard/billing': {
    title: 'Dinero',
    sub: 'Lo que entró, lo que cuesta operar, y lo que se les debe a los socios.',
  },
  '/dashboard/engines': {
    title: 'Engines',
    sub: 'Catálogo de productos: status, tier requerido, visibilidad.',
  },
  '/dashboard/activity': {
    title: 'Actividad',
    sub: 'Notificaciones y registro de auditoría.',
  },
  '/dashboard/settings': {
    title: 'Ajustes',
    sub: 'Organización, idioma, zona horaria y seguridad.',
  },

  // Sub-views: reachable from the six above, not from the primary nav.
  '/dashboard/revenue': {
    title: 'Ingresos por engine',
    sub: 'Sub-vista de Dinero: consumo de IA por engine.',
  },
  '/dashboard/royalties': {
    title: 'Royalties',
    sub: 'Sub-vista de Dinero: accruals del mes e historial de pagos a socios.',
  },
  '/dashboard/notifications': {
    title: 'Notificaciones',
    sub: 'Sub-vista de Actividad: alertas del sistema.',
  },
  '/dashboard/audit': {
    title: 'Registro de auditoría',
    sub: 'Sub-vista de Actividad: cambios de plan, rol y pagos automáticos.',
  },

  // Labs.
  '/dashboard/messages': {
    title: 'Mensajes',
    sub: 'Hilos con subscribers + leads de partners desde la landing.',
  },
  '/dashboard/models': {
    title: 'AI Models',
    sub: 'Modelos, prompts, personas y generaciones.',
  },
  '/dashboard/analytics': {
    title: 'Analytics',
    sub: 'Métricas, tendencias y comportamiento por sistema.',
  },
  '/dashboard/api': {
    title: 'API & Keys',
    sub: 'Llaves de API por proveedor, costos y límites.',
  },
  '/dashboard/streams': {
    title: 'Streams',
    sub: 'Labs · sin conectar. No hay backend de streams todavía.',
  },
  '/dashboard/automations': {
    title: 'Automations',
    sub: 'Labs · sin conectar. No hay motor de automatizaciones todavía.',
  },
  '/dashboard/queues': {
    title: 'Queues',
    sub: 'Labs · sin conectar. No hay cola de trabajos todavía.',
  },
  '/dashboard/infra': {
    title: 'Workers & GPU',
    sub: 'Labs · sin conectar. No hay infraestructura de workers todavía.',
  },
};
