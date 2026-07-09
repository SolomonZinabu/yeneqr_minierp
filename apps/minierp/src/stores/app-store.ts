// src/stores/app-store.ts
// Zustand store for client-side application state.

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SessionUser, Tenant } from "@/types";

interface AppState {
  // ── Sidebar ──
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // ── Mobile sidebar (Sheet) ──
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  // ── Theme (also stored by next-themes, but we mirror here for SSR) ──
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // ── Session (mirrored from Better-Auth; source of truth is the cookie) ──
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;

  // ── Tenants ──
  tenants: Tenant[];
  currentTenantId: string | null;
  setTenants: (tenants: Tenant[]) => void;
  setCurrentTenant: (tenantId: string | null) => void;

  // ── Toasts (mirrors sonner; kept for non-React contexts) ──
  lastError: string | null;
  setLastError: (error: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      mobileSidebarOpen: false,
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

      theme: "system",
      setTheme: (theme) => set({ theme }),

      user: null,
      setUser: (user) => set({ user }),

      tenants: [],
      currentTenantId: null,
      setTenants: (tenants) => set({ tenants }),
      setCurrentTenant: (tenantId) => set({ currentTenantId: tenantId }),

      lastError: null,
      setLastError: (error) => set({ lastError: error }),
    }),
    {
      name: "mini-erp-app-store",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        currentTenantId: s.currentTenantId,
      }),
    },
  ),
);
