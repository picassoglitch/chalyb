'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from 'next';
import { useRouter } from '@/i18n/routing';
import { useDashboard } from '@/lib/dashboard/store';
import { ENV_LABEL } from '@/lib/data/types';

interface Cmd {
  g: string;
  ic: string;
  n: string;
  s: string;
  k?: string;
  engineId?: string;
  href?: string;
}

// The palette navigates. It does not pretend to act.
//
// It used to offer "Iniciar stream", "Crear clip", "Publicar a TikTok" and
// "Reiniciar worker" — none of which were wired to anything. Picking one
// popped a toast reading "<b>Reiniciar worker</b> — listo", which is a
// success message for something that did not happen. Those are gone; what is
// left goes where it says it goes.
const STATIC_CMDS: Cmd[] = [
  {
    g: 'Ir a',
    ic: '⬡',
    n: 'Centro de mando',
    s: 'Salud, incidentes y engines',
    href: '/dashboard',
  },
  {
    g: 'Ir a',
    ic: '👥',
    n: 'Personas',
    s: 'Equipo, roles, planes e invitaciones',
    href: '/dashboard/team',
  },
  { g: 'Ir a', ic: '$', n: 'Dinero', s: 'Pagos, P&L y royalties', href: '/dashboard/billing' },
  { g: 'Ir a', ic: '◈', n: 'Engines', s: 'Catálogo de productos', href: '/dashboard/engines' },
  {
    g: 'Ir a',
    ic: '◉',
    n: 'Actividad',
    s: 'Notificaciones y auditoría',
    href: '/dashboard/activity',
  },
  { g: 'Ir a', ic: '⚙', n: 'Ajustes', s: 'Organización y seguridad', href: '/dashboard/settings' },
  {
    g: 'Sub-vistas',
    ic: '◆',
    n: 'Royalties',
    s: 'Accruals del mes y pagos a socios',
    href: '/dashboard/royalties',
  },
  {
    g: 'Sub-vistas',
    ic: '⌬',
    n: 'Ingresos por engine',
    s: 'Consumo de IA por engine',
    href: '/dashboard/revenue',
  },
  {
    g: 'Sub-vistas',
    ic: '≡',
    n: 'Registro de auditoría',
    s: 'Cambios campo por campo',
    href: '/dashboard/audit',
  },
  {
    g: 'Sub-vistas',
    ic: '✉',
    n: 'Mensajes',
    s: 'Hilos con subscribers y leads',
    href: '/dashboard/messages',
  },
];

export function CommandPalette() {
  const open = useDashboard((s) => s.paletteOpen);
  const toggle = useDashboard((s) => s.togglePalette);
  const close = useDashboard((s) => s.closePalette);
  const engines = useDashboard((s) => s.engines);
  const openDrawer = useDashboard((s) => s.openDrawer);
  const router = useRouter();

  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allCmds = useMemo<Cmd[]>(() => {
    const engineCmds: Cmd[] = engines.map((e) => ({
      g: 'Engines',
      ic: e.icon,
      n: `Abrir ${e.name}`,
      s: `${e.type} · ${ENV_LABEL[e.env]}`,
      engineId: e.id,
    }));
    return [...STATIC_CMDS, ...engineCmds];
  }, [engines]);

  const items = useMemo(() => {
    if (!q) return allCmds.slice(0, 40);
    const lc = q.toLowerCase();
    return allCmds.filter((c) => (c.n + ' ' + c.s).toLowerCase().includes(lc)).slice(0, 40);
  }, [allCmds, q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const c = items[sel];
        if (c) runCmd(c);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items, sel, toggle, close]);

  useEffect(() => {
    if (!open) return;
    // Deliberate: reset palette state when it opens. setState-in-effect is the
    // right pattern here — we're syncing to a remote toggle (open prop).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ('');
    setSel(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('.cc-cmdi.sel');
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel, open]);

  function runCmd(c: Cmd) {
    close();
    if (c.engineId) {
      openDrawer(c.engineId);
      return;
    }
    if (c.href) router.push(c.href as Route);
  }

  if (!open) return null;

  let lastG: string | null = null;

  return (
    <div className="cc-cmdov" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="cc-cmdp">
        <div className="cc-ci">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder="Escribe un comando o busca tu engine…"
            autoComplete="off"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="cc-cmdl" ref={listRef}>
          {items.map((c, i) => {
            const showGroup = c.g !== lastG;
            lastG = c.g;
            return (
              <div key={`${c.g}-${i}`}>
                {showGroup && <div className="cc-cmdg">{c.g}</div>}
                <button
                  type="button"
                  className={`cc-cmdi${i === sel ? ' sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => runCmd(c)}
                >
                  <span className="cc-cic">{c.ic}</span>
                  <span className="cc-ct">
                    <span className="cc-cn">{c.n}</span>
                    <span className="cc-cs">{c.s}</span>
                  </span>
                  {c.k && <span className="cc-ck">⌘{c.k}</span>}
                </button>
              </div>
            );
          })}
          {!items.length && <div className="cc-empty-feed">No encontramos nada.</div>}
        </div>
        <div className="cc-cf">
          <span>
            <kbd>↑↓</kbd> navegar
          </span>
          <span>
            <kbd>↵</kbd> ejecutar
          </span>
          <span>
            <kbd>esc</kbd> cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
