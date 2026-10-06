'use client';
// Chalito's own sections, under the hub's tool header (the hub's sidebar and language switch
// already cover the rest of Chalito's old top bar).
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/chalito/navigation';

const ITEMS = [
  ['/', 'home'],
  ['/bandeja', 'inbox'],
  ['/sesiones', 'sessions'],
  ['/dispositivos', 'devices'],
  ['/salas', 'rooms'],
  ['/m', 'mesas'],
  ['/tienda', 'store'],
  ['/ajustes', 'settings'],
] as const;

export const ChalitoNav = () => {
  const t = useTranslations('chalito.nav');
  const path = usePathname();
  return (
    <nav
      aria-label="Chalito"
      className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm"
      data-testid="chalito-nav"
    >
      {ITEMS.map(([href, key]) => {
        const active = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={active ? 'font-semibold' : undefined}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
};
