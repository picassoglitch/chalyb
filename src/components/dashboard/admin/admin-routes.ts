// The owner panel's nav (rebuild P5, BUILD-SPEC §9). Pure, unit-tested.
//
// Exactly six items. The rebuilt routes live in dashboard/(admin) and render
// in the light design system; main's other screens live in
// dashboard/(legacy), keep their dark shell, and are reachable from "Más"
// (Q30).

export type AdminNavKey = 'command' | 'people' | 'money' | 'tools' | 'activity' | 'settings';

export const ADMIN_NAV: { key: AdminNavKey; href: string }[] = [
  { key: 'command', href: '/dashboard' },
  { key: 'people', href: '/dashboard/personas' },
  { key: 'money', href: '/dashboard/dinero' },
  { key: 'tools', href: '/dashboard/herramientas' },
  { key: 'activity', href: '/dashboard/actividad' },
  { key: 'settings', href: '/dashboard/ajustes' },
];

/** Main's other admin screens, unchanged, under "Más". */
export const ADMIN_MORE: { key: string; href: string }[] = [
  // Old P6-8: ARCO requests and copyright notices (light design, (admin)).
  { key: 'legal', href: '/dashboard/legal' },
  { key: 'overview', href: '/dashboard/overview' },
  { key: 'team', href: '/dashboard/team' },
  { key: 'engines', href: '/dashboard/engines' },
  { key: 'revenue', href: '/dashboard/revenue' },
  { key: 'royalties', href: '/dashboard/royalties' },
  { key: 'audit', href: '/dashboard/audit' },
  { key: 'messages', href: '/dashboard/messages' },
  { key: 'models', href: '/dashboard/models' },
  { key: 'analytics', href: '/dashboard/analytics' },
  { key: 'api', href: '/dashboard/api' },
];

export function normalizeAdminPath(pathname: string): string {
  const p = pathname.split('?')[0]!.replace(/^\/(en|es)(?=\/|$)/, '').replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function activeAdminNav(pathname: string): AdminNavKey | null {
  const p = normalizeAdminPath(pathname);
  return ADMIN_NAV.find((n) => n.href === p)?.key ?? null;
}
