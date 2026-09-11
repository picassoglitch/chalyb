'use client';

import { create } from 'zustand';
import type { Engine, EngineCategory } from '@/lib/data/types';

type DrawerTab = 'metrics' | 'logs' | 'console' | 'ai' | 'autos' | 'api';

interface DashboardState {
  // Drawer — which engine row is expanded in the detail panel
  drawerEngineId: string | null;
  drawerTab: DrawerTab;
  openDrawer: (engineId: string) => void;
  closeDrawer: () => void;
  setDrawerTab: (tab: DrawerTab) => void;

  // Command palette
  paletteOpen: boolean;
  togglePalette: () => void;
  openPalette: () => void;
  closePalette: () => void;

  // Filters
  query: string;
  activeCats: Set<EngineCategory>;
  viewMode: 'rows' | 'fav';
  setQuery: (q: string) => void;
  toggleCat: (c: EngineCategory) => void;
  setViewMode: (m: 'rows' | 'fav') => void;

  // Local engine overrides (favorite toggle + health drift from SSE)
  engines: Engine[];
  setEngines: (engines: Engine[]) => void;
  toggleFavorite: (engineId: string) => void;
  applyHealthDrift: (drift: Array<{ engineId: string; health: number }>) => void;

  // Mobile sidebar
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;

  // Toast
  toastHtml: string | null;
  showToast: (html: string) => void;
  clearToast: () => void;
}

export const useDashboard = create<DashboardState>((set) => ({
  drawerEngineId: null,
  drawerTab: 'metrics',
  openDrawer: (engineId) => set({ drawerEngineId: engineId, drawerTab: 'metrics' }),
  closeDrawer: () => set({ drawerEngineId: null }),
  setDrawerTab: (tab) => set({ drawerTab: tab }),

  paletteOpen: false,
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),

  query: '',
  activeCats: new Set(),
  viewMode: 'rows',
  setQuery: (q) => set({ query: q }),
  toggleCat: (c) =>
    set((s) => {
      const next = new Set(s.activeCats);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return { activeCats: next };
    }),
  setViewMode: (m) => set({ viewMode: m }),

  engines: [],
  setEngines: (engines) => set({ engines }),
  toggleFavorite: (engineId) =>
    set((s) => ({
      engines: s.engines.map((e) =>
        e.id === engineId ? { ...e, favorite: !e.favorite } : e,
      ),
    })),
  applyHealthDrift: (drift) =>
    set((s) => {
      const m = new Map(drift.map((d) => [d.engineId, d.health]));
      return {
        engines: s.engines.map((e) =>
          m.has(e.id) ? { ...e, health: m.get(e.id)! } : e,
        ),
      };
    }),

  mobileSidebarOpen: false,
  setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),

  toastHtml: null,
  showToast: (html) => {
    set({ toastHtml: html });
    if (typeof window !== 'undefined') {
      window.setTimeout(() => set({ toastHtml: null }), 2600);
    }
  },
  clearToast: () => set({ toastHtml: null }),
}));
