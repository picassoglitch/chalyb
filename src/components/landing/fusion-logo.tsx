'use client';

import { useEffect, useRef } from 'react';

const ACID = '#c6f24e';
const CYAN = '#3df5e0';
const MAGENTA = '#ff3df0';
const SVGNS = 'http://www.w3.org/2000/svg';
const N_PATH = 'M44,150 L44,50 L66,50 L122,118 L122,50 L156,50 L156,150 L134,150 L78,82 L78,150 Z';
const N_NODES: Array<[number, number]> = [
  [44, 50],
  [156, 50],
  [44, 150],
  [156, 150],
  [122, 84],
  [78, 116],
];

function mk(tag: string, attrs: Record<string, string | number>) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

export function FusionLogo({ id, triggerHover }: { id: string; triggerHover?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stateRef = useRef({ glitch: 0.6, boot: 1, t: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let rafId = 0;
    const idle = true;

    const render = () => {
      const s = stateRef.current;
      svg.innerHTML = '';
      let g = s.glitch;
      if (idle) {
        const ip = Math.max(0, Math.sin(s.t * 1.3 + id.length) * 0.5 - 0.37);
        g = Math.max(g, ip * 0.5);
      }
      if (g < 0.15) {
        svg.appendChild(
          mk('path', {
            d: N_PATH,
            fill: 'none',
            stroke: CYAN,
            'stroke-width': 8,
            opacity: 0.13,
            'stroke-linejoin': 'round',
          }),
        );
        if (s.boot > 0.02) {
          const reveal = 50 + (1 - s.boot) * 100;
          svg.appendChild(
            mk('path', {
              d: N_PATH,
              fill: 'none',
              stroke: CYAN,
              'stroke-width': 2.4,
              opacity: 0.3,
              'stroke-linejoin': 'round',
            }),
          );
          const cp = mk('clipPath', { id: `${id}bc` });
          cp.appendChild(mk('rect', { x: 0, y: 0, width: 200, height: reveal }));
          svg.appendChild(cp);
          svg.appendChild(mk('path', { d: N_PATH, fill: ACID, 'clip-path': `url(#${id}bc)` }));
        } else {
          svg.appendChild(mk('path', { d: N_PATH, fill: ACID }));
        }
      } else {
        const amp = g;
        svg.appendChild(
          mk('path', { d: N_PATH, fill: '#15171f', stroke: '#23263a', 'stroke-width': 1 }),
        );
        for (let i = 0; i < 7; i++) {
          const y0 = 50 + (i / 7) * 100;
          const h = 100 / 7 + 1;
          const flick = Math.sin(s.t * 11 + i * 2.3);
          const off = (flick > 0.4 ? (Math.random() - 0.5) * 16 : flick * 4) * amp;
          const cid = `${id}g${i}`;
          const cp = mk('clipPath', { id: cid });
          cp.appendChild(mk('rect', { x: 0, y: y0, width: 200, height: h }));
          svg.appendChild(cp);
          svg.appendChild(
            mk('path', {
              d: N_PATH,
              fill: 'none',
              stroke: CYAN,
              'stroke-width': 2.2,
              'clip-path': `url(#${cid})`,
              transform: `translate(${off - 2.5 * amp},0)`,
              opacity: 0.85,
            }),
          );
          svg.appendChild(
            mk('path', {
              d: N_PATH,
              fill: 'none',
              stroke: MAGENTA,
              'stroke-width': 2.2,
              'clip-path': `url(#${cid})`,
              transform: `translate(${-off + 2.5 * amp},0)`,
              opacity: 0.85,
            }),
          );
          svg.appendChild(
            mk('path', {
              d: N_PATH,
              fill: ACID,
              'clip-path': `url(#${cid})`,
              transform: `translate(${off * 0.35},0)`,
              opacity: (0.72 + 0.28 * Math.sin(s.t * 8 + i)).toFixed(2),
            }),
          );
        }
      }
      N_NODES.forEach(([x, y], i) => {
        const jit = g > 0.15 ? (Math.random() - 0.5) * 4 * g : 0;
        svg.appendChild(
          mk('circle', {
            cx: x + jit,
            cy: y,
            r: i === 0 ? 3.4 : 2.6,
            fill: i === 0 ? ACID : CYAN,
            opacity: (0.9 - g * 0.3).toFixed(2),
          }),
        );
      });
      const sy = 50 + ((s.t * 55) % 100);
      svg.appendChild(
        mk('rect', { x: 40, y: sy, width: 120, height: 1.4, fill: '#ffffff', opacity: 0.16 }),
      );
    };

    const loop = () => {
      const s = stateRef.current;
      s.t += 0.016;
      if (s.glitch > 0) s.glitch = Math.max(0, s.glitch - 0.03);
      if (s.boot > 0) s.boot = Math.max(0, s.boot - 0.012);
      render();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    let hoverEl: HTMLElement | null = null;
    if (triggerHover) {
      hoverEl = svg.closest('nav');
      if (hoverEl) {
        hoverEl.addEventListener('mouseenter', () => {
          stateRef.current.glitch = 1;
        });
      }
    }

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [id, triggerHover]);

  return <svg ref={svgRef} className="logo-mark" viewBox="0 0 200 200" />;
}
