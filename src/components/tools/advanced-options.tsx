'use client';

// "Opciones avanzadas · Para creadores profesionales · {resumen}" (TOOLS-SPEC
// §3, mockup 06): closed by default, and the open/closed state is
// remembered per tool on this device.

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

export function AdvancedOptions({
  storageKey,
  title,
  sub,
  summary,
  children,
}: {
  /** e.g. "clips.settings" — one remembered state per tool screen. */
  storageKey: string;
  title: string;
  sub: string;
  summary: string;
  children: ReactNode;
}) {
  const id = useId();
  const key = `chalyb.adv.${storageKey}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount
      setOpen(localStorage.getItem(key) === '1');
    } catch {}
  }, [key]);
  function toggle() {
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? '0' : '1');
      } catch {}
      return !o;
    });
  }
  return (
    <section className={`ch-adv${open ? ' ch-adv--open' : ''}`}>
      <button
        type="button"
        className="ch-adv__bar"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
      >
        <SlidersHorizontal aria-hidden="true" />
        <span className="ch-adv__t">{title}</span>
        <span className="ch-pill ch-pill--acc ch-adv__sub">{sub}</span>
        <span className="ch-adv__sum">{summary}</span>
        <ChevronDown aria-hidden="true" className="ch-adv__chev" />
      </button>
      <div id={id} className="ch-adv__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
