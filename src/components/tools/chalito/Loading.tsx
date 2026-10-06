"use client";
import { Skeleton } from "@/components/ui/primitives";

/** Placeholder rows while a screen loads, instead of a bare "Cargando…" (UX review 2026-10-06). */
export const Loading = ({ label, rows = 3, height = 72 }: { label: string; rows?: number; height?: number }) => (
  <div role="status" aria-live="polite" className="ch-chl" data-testid="chalito-loading">
    <span className="ch-sr">{label}</span>
    {Array.from({ length: rows }, (_, i) => (
      <Skeleton key={i} height={height} />
    ))}
  </div>
);
