'use client';

// Dependency-free canvas confetti burst. Mounts a fixed, click-through
// full-screen canvas, rains ~140 particles under gravity for ~2.4s, then the
// parent unmounts it. No external lib (gsap is available if a richer effect is
// ever wanted) — this keeps the bundle untouched.

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
}

// Brand-ish palette: green / cyan / purple / amber accents used across the app.
const COLORS = ['#9eea3a', '#52e5d0', '#9d7bff', '#f5b13d', '#ffffff'];

export function Confetti({ durationMs = 2400 }: { durationMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Two launch points (left + right) firing up and inward, like a popper.
    const COUNT = 140;
    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const originX = fromLeft ? width * 0.15 : width * 0.85;
      const dir = fromLeft ? 1 : -1;
      return {
        x: originX,
        y: height * 0.35,
        vx: dir * (2 + Math.random() * 6),
        vy: -(6 + Math.random() * 8),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        size: 5 + Math.random() * 7,
        color: COLORS[i % COLORS.length]!,
      };
    });

    const GRAVITY = 0.22;
    const DRAG = 0.992;
    const start = performance.now();
    let raf = 0;

    function frame(now: number) {
      const elapsed = now - start;
      const fade = Math.max(0, 1 - elapsed / durationMs);
      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.globalAlpha = fade;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      }
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx!.clearRect(0, 0, width, height);
      }
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
