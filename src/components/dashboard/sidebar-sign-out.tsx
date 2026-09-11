'use client';

// Compact sign-out icon for the sidebar foot row — sits next to the ⚙
// settings link in both DashboardSidebar (admin) and WorkspaceSidebar
// (subscriber). Single icon button, no label, matches the size + style
// of `.cc-cog` so the foot row stays compact.
//
// Style reused: same border-bg-color treatment as the cog. CSS lives in
// dashboard.css under `.cc-cog`; we add `.cc-cog--danger` inline via the
// `aria-label` + a hover red tint so it reads as a destructive action
// without needing a separate global class.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/client';

interface Props {
  /** Click handler can also close the mobile sidebar drawer, so callers
   *  pass their setMobileSidebarOpen. Optional — desktop sidebar doesn't
   *  need it. */
  onBeforeNav?: () => void;
}

export function SidebarSignOut({ onBeforeNav }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    onBeforeNav?.();
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Even if signOut throws (network, missing session), continue to
      // bounce the user to the landing — they expect to land logged-out.
    }
    // Push to the landing then refresh so server components re-evaluate
    // session = null and the nav renders the "Log in / Registrar" button.
    // The cast is needed because Next typedRoutes wants a known route
    // literal — '/' resolves to the localized landing through next-intl.
    router.push('/' as Route);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="cc-cog"
      title={loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
      aria-label="Cerrar sesión"
      style={{
        // Inline override of .cc-cog so the logout icon reads as a
        // destructive (red-ish) action without needing a new global class.
        // On hover we go fuller red. On disabled (during the round-trip
        // to Supabase) we dim so the user knows the click registered.
        color: loading ? 'var(--cc-txt-4)' : 'var(--cc-red, #f87171)',
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {/* ⏻ is the standard power/exit glyph. Reads cleanly at the same
          ~14px size that .cc-cog uses for the gear. */}
      ⏻
    </button>
  );
}
