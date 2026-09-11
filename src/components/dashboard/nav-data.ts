// Verbatim port of the prototype's NAV array, extended with href for routing.
// Each module gets a real /dashboard/<slug> route in CP-extension.

export type NavItem = {
  id: string;
  href: string; // locale-agnostic; next-intl Link prefixes /es when needed
  ic: string;
  label: string;
  ct?: string;
  live?: boolean;
};

export type NavGroup = { grp: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    grp: 'Resumen',
    items: [
      { id: 'overview', href: '/dashboard/overview', ic: '◰', label: 'Overview' },
      { id: 'ops', href: '/dashboard', ic: '⬡', label: 'Operaciones', live: true },
    ],
  },
  {
    // "Plataforma" = AI infra surfaces that operate on engines. The top-level
    // "Operaciones" entry above is the live ops view of those engines.
    grp: 'Plataforma',
    items: [
      // First-class engines management (catalog status + tier_required).
      { id: 'engines', href: '/dashboard/engines', ic: '◈', label: 'Engines', ct: '6' },
      { id: 'models', href: '/dashboard/models', ic: '⌬', label: 'AI Models', ct: '9' },
      { id: 'streams', href: '/dashboard/streams', ic: '▶', label: 'Streams', live: true },
      { id: 'autos', href: '/dashboard/automations', ic: '⟳', label: 'Automations', ct: '31' },
      { id: 'queues', href: '/dashboard/queues', ic: '≡', label: 'Queues', ct: '7' },
    ],
  },
  // "Contenido" group removed — clips/publishing/uploads are ChalybClip-internal
  // features, not platform-admin concerns. Same reason "Clients" got removed
  // from Organización: Chalyb is a SaaS, not an agency with client engagements.
  {
    grp: 'Inteligencia',
    items: [
      { id: 'analytics', href: '/dashboard/analytics', ic: '◑', label: 'Analytics' },
      { id: 'revenue', href: '/dashboard/revenue', ic: '$', label: 'Revenue' },
    ],
  },
  {
    grp: 'Infra',
    items: [
      { id: 'infra', href: '/dashboard/infra', ic: '▤', label: 'Workers & GPU' },
      { id: 'api', href: '/dashboard/api', ic: '⌘', label: 'API & Keys' },
      { id: 'notifs', href: '/dashboard/notifications', ic: '🔔', label: 'Notifications', ct: '3' },
    ],
  },
  {
    grp: 'Organización',
    items: [
      { id: 'team', href: '/dashboard/team', ic: '👥', label: 'Team & Roles' },
      // Inbox: subscriber threads + landing-form partner inquiries.
      // Count is rendered live by the admin sidebar from
      // countUnreadForAdmin() + countUnreadInquiriesForAdmin().
      { id: 'messages', href: '/dashboard/messages', ic: '✉', label: 'Mensajes' },
      { id: 'billing', href: '/dashboard/billing', ic: '▦', label: 'Billing (P&L)' },
      // Royalty payouts to partner engine owners — accruals + history.
      // Lives next to billing because operationally they're the same
      // surface (money flowing through the platform).
      { id: 'royalties', href: '/dashboard/royalties', ic: '◆', label: 'Royalties' },
      { id: 'audit', href: '/dashboard/audit', ic: '◉', label: 'Audit log' },
      { id: 'settings', href: '/dashboard/settings', ic: '⚙', label: 'Settings' },
    ],
  },
];

// ============================================================
// Subscriber workspace navigation — Free / Pro / VIP tier UI.
// Mounted at /app/*. Distinct from the admin /dashboard sidebar.
// ============================================================
export const SUBSCRIBER_NAV: NavGroup[] = [
  {
    grp: 'Tu cuenta',
    items: [
      { id: 'home', href: '/app', ic: '◉', label: 'Inicio' },
      { id: 'subscription', href: '/app/subscription', ic: '◈', label: 'Suscripción' },
      { id: 'usage', href: '/app/usage', ic: '◑', label: 'Uso' },
      { id: 'billing', href: '/app/billing', ic: '▦', label: 'Facturación' },
    ],
  },
  {
    grp: 'Plataforma',
    items: [
      { id: 'myengines', href: '/app/engines', ic: '◈', label: 'Mis engines' },
      { id: 'history', href: '/app/history', ic: '≡', label: 'Historial' },
    ],
  },
  {
    grp: 'Ajustes',
    items: [
      // Messages → bidirectional thread with the admin team. Partners use this
      // for product feedback + ideas; any user can ping the admin from here.
      // Unread count is rendered server-side in the WorkspaceSidebar.
      { id: 'messages', href: '/app/messages', ic: '✉', label: 'Mensajes' },
      { id: 'profile', href: '/app/settings', ic: '⚙', label: 'Perfil & seguridad' },
      { id: 'help', href: '/app/help', ic: '?', label: 'Ayuda' },
    ],
  },
];

export const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/dashboard': {
    title: 'Operaciones',
    sub: 'Todos los sistemas, agentes y trabajos de IA — estado en vivo.',
  },
  '/dashboard/overview': {
    title: 'Overview',
    sub: 'Resumen ejecutivo de toda la plataforma.',
  },
  '/dashboard/engines': {
    title: 'Engines',
    sub: 'Catálogo de productos: status, tier requerido, visibilidad.',
  },
  '/dashboard/models': {
    title: 'AI Models',
    sub: 'Modelos, prompts, personas y generaciones.',
  },
  '/dashboard/streams': {
    title: 'Streams',
    sub: 'Streams en vivo y su estado.',
  },
  '/dashboard/automations': {
    title: 'Automations',
    sub: 'Flujos automatizados y disparadores.',
  },
  '/dashboard/queues': {
    title: 'Queues',
    sub: 'Cola de trabajos por worker y prioridad.',
  },
  '/dashboard/analytics': {
    title: 'Analytics',
    sub: 'Métricas, tendencias y comportamiento por sistema.',
  },
  '/dashboard/revenue': {
    title: 'Revenue',
    sub: 'Ingresos por sistema, MRR y tendencias.',
  },
  '/dashboard/infra': {
    title: 'Workers & GPU',
    sub: 'Nodos, GPU, regiones y costos de infraestructura.',
  },
  '/dashboard/api': {
    title: 'API & Keys',
    sub: 'Llaves de API por proveedor, costos y límites.',
  },
  '/dashboard/notifications': {
    title: 'Notifications',
    sub: 'Alertas del sistema y eventos sin leer.',
  },
  '/dashboard/team': {
    title: 'Team & Roles',
    sub: 'Usuarios, permisos y registro de actividad.',
  },
  '/dashboard/messages': {
    title: 'Mensajes',
    sub: 'Hilos con subscribers + leads de partners desde la landing.',
  },
  '/dashboard/billing': {
    title: 'Billing',
    sub: 'Plan actual, facturas y método de pago.',
  },
  '/dashboard/royalties': {
    title: 'Royalties',
    sub: 'Pagos a partners owners de engines — accruals del mes + historial.',
  },
  '/dashboard/audit': {
    title: 'Audit log',
    sub: 'Eventos de cuenta: cambios de plan, rol y pagos automáticos.',
  },
  '/dashboard/settings': {
    title: 'Settings',
    sub: 'Cuenta, organización, notificaciones y seguridad.',
  },
  '/app': {
    title: 'Tu espacio',
    sub: 'Resumen de tu suscripción, uso y bots activos.',
  },
  '/app/subscription': {
    title: 'Suscripción',
    sub: 'Tu plan actual, cambios de tier y método de pago.',
  },
  '/app/usage': {
    title: 'Uso',
    sub: 'Tu actividad en el período de facturación actual.',
  },
  '/app/billing': {
    title: 'Facturación',
    sub: 'Historial de facturas y método de pago.',
  },
  '/app/engines': {
    title: 'Mis engines',
    sub: 'ChalybClip, ChalybStreamManager y próximos productos — disponibles en tu tier actual.',
  },
  '/app/history': {
    title: 'Historial',
    sub: 'Tus ejecuciones recientes y trabajos completados.',
  },
  '/app/messages': {
    title: 'Mensajes',
    sub: 'Habla directo con el equipo. Ideas, problemas, propuestas — todo va aquí.',
  },
  '/app/settings': {
    title: 'Perfil & seguridad',
    sub: 'Tu cuenta personal, contraseña y 2FA.',
  },
  '/app/help': {
    title: 'Ayuda',
    sub: 'Docs, contacto y estado del sistema.',
  },
};
