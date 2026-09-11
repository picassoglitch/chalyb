'use client';

import { create } from 'zustand';

interface WorkspaceState {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
  toastHtml: string | null;
  showToast: (html: string) => void;
  clearToast: () => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
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
