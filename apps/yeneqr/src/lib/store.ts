import { create } from 'zustand';
import type { OrderStatus, KitchenItemStatus, TableStatus } from './types';

export type TabId = 
  | 'dashboard' 
  | 'orders' 
  | 'menu' 
  | 'tables' 
  | 'qrcodes' 
  | 'kitchen' 
  | 'waiter'
  | 'staff' 
  | 'analytics'
  | 'crm'
  | 'waitlist'
  | 'menu-engineering'
  | 'branches'
  | 'settings' 
  | 'notifications'
  | 'reservations'
  | 'localization'
  | 'promotions'
  | 'reviews'
  | 'refunds'
  | 'shifts'
  | 'inventory'
  | 'audit-logs'
  | 'ai'
  | 'invoices'
  | 'platform-billing';

// ============================================================
// Auth Types & State
// ============================================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  restaurantId?: string;
  restaurantName?: string;
  restaurantSlug?: string;
  branchId?: string;
  avatar?: string;
  isAdminImpersonation?: boolean;
  originalRole?: string;
  permissions?: string[];  // Per-user permission overrides (for permission-based access control)
  additionalPermissions?: string[];  // Extra permissions on top of role defaults
  revokedPermissions?: string[];  // Permissions revoked from role defaults
  resolvedPermissions?: string[];  // Fully resolved effective permissions (computed at login)
}

export interface UserRestaurant {
  id: string;
  name: string;
  nameAm?: string;
  slug: string;
  cuisineType?: string;
  logo?: string | null;
  city?: string | null;
  address?: string | null;
  branchCount: number;
  staffCount: number;
  role: string;
  userId?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  userRestaurants: UserRestaurant[];
  setUserRestaurants: (restaurants: UserRestaurant[]) => void;
  switchRestaurant: (token: string, user: AuthUser) => void;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  hydrateAuth: () => void;
}

// ============================================================
// App State
// ============================================================

interface AppState {
  // Navigation (kept for compatibility with dashboard views)
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  
  // Restaurant
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  branchesVersion: number;
  incrementBranchesVersion: () => void;
  branchChangeVersion: number;
  
  // Language
  language: string;
  setLanguage: (lang: string) => void;
  
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // Orders
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  orderStatusFilter: OrderStatus | 'all';
  setOrderStatusFilter: (status: OrderStatus | 'all') => void;
  
  // Menu
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  editMenuItemId: string | null;
  setEditMenuItemId: (id: string | null) => void;
  isAddMenuItemOpen: boolean;
  setIsAddMenuItemOpen: (open: boolean) => void;
  
  // Tables
  selectedFloorId: string;
  setSelectedFloorId: (id: string) => void;
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  
  // Kitchen
  kitchenStation: string;
  setKitchenStation: (station: string) => void;
  
  // Staff
  isAddStaffOpen: boolean;
  setIsAddStaffOpen: (open: boolean) => void;
  
  // QR Codes
  isGenerateQROpen: boolean;
  setIsGenerateQROpen: (open: boolean) => void;
  
  // Notifications
  unreadNotificationCount: number;
  setUnreadNotificationCount: (count: number) => void;
}

// ============================================================
// Combined Store
// ============================================================

type RootStore = AuthState & AppState;

export const useAppStore = create<RootStore>((set) => ({
  // ── Auth ──────────────────────────────────────────────────
  token: null,
  user: null,
  isAuthenticated: false,
  userRestaurants: [],

  setUserRestaurants: (restaurants) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('yeneqr_restaurants', JSON.stringify(restaurants));
    }
    set({ userRestaurants: restaurants });
  },

  switchRestaurant: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('yeneqr_token', token);
      localStorage.setItem('yeneqr_user', JSON.stringify(user));
      localStorage.removeItem('yeneqr_selected_branch');
    }
    set({
      token,
      user,
      isAuthenticated: true,
      // Reset branch selection when switching restaurants
      selectedBranchId: '',
      selectedFloorId: '',
    });
  },

  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('yeneqr_token', token);
      localStorage.setItem('yeneqr_user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('yeneqr_token');
      localStorage.removeItem('yeneqr_user');
      localStorage.removeItem('yeneqr_restaurants');
      localStorage.removeItem('yeneqr_selected_branch');
    }
    set({ token: null, user: null, isAuthenticated: false, userRestaurants: [], selectedBranchId: '' });
  },

  hydrateAuth: () => {
    if (typeof window === 'undefined') return;
    try {
      const token = localStorage.getItem('yeneqr_token');
      const userStr = localStorage.getItem('yeneqr_user');
      const restaurantsStr = localStorage.getItem('yeneqr_restaurants');
      if (token && userStr) {
        const user = JSON.parse(userStr) as AuthUser;
        // Basic JWT expiry check
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          const userRestaurants = restaurantsStr ? JSON.parse(restaurantsStr) : [];
          const savedBranchId = localStorage.getItem('yeneqr_selected_branch') || '';
          set({ token, user, isAuthenticated: true, userRestaurants, selectedBranchId: savedBranchId });
        } else {
          // Token expired, clear it
          localStorage.removeItem('yeneqr_token');
          localStorage.removeItem('yeneqr_user');
          localStorage.removeItem('yeneqr_restaurants');
          localStorage.removeItem('yeneqr_selected_branch');
          set({ token: null, user: null, isAuthenticated: false, userRestaurants: [], selectedBranchId: '' });
        }
      }
    } catch {
      // Invalid stored data, clear it
      localStorage.removeItem('yeneqr_token');
      localStorage.removeItem('yeneqr_user');
      localStorage.removeItem('yeneqr_restaurants');
      localStorage.removeItem('yeneqr_selected_branch');
    }
  },
  
  // ── Navigation ────────────────────────────────────────────
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Restaurant
  selectedBranchId: (typeof window !== 'undefined' && localStorage.getItem('yeneqr_selected_branch')) || '',
  setSelectedBranchId: (id) => {
    console.log('[Store] setSelectedBranchId called with:', id);
    // IMPORTANT: Update the store FIRST, then dispatch the event.
    // Components responding to the event read selectedBranchId from the store
    // via useAppStore.getState() — if the store isn't updated yet, they get stale data.
    set((s) => ({ selectedBranchId: id, branchChangeVersion: s.branchChangeVersion + 1 }));
    if (typeof window !== 'undefined') {
      localStorage.setItem('yeneqr_selected_branch', id);
      // Dispatch a custom event so all components (including those with
      // stale closures) know the branch changed and must re-fetch data
      window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: id } }));
    }
  },
  branchesVersion: 0,
  incrementBranchesVersion: () => set((s) => ({ branchesVersion: s.branchesVersion + 1 })),
  branchChangeVersion: 0,
  
  // Language
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
  
  // Sidebar
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  // Orders
  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),
  orderStatusFilter: 'all',
  setOrderStatusFilter: (status) => set({ orderStatusFilter: status }),
  
  // Menu
  selectedCategoryId: 'cat-001',
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  editMenuItemId: null,
  setEditMenuItemId: (id) => set({ editMenuItemId: id }),
  isAddMenuItemOpen: false,
  setIsAddMenuItemOpen: (open) => set({ isAddMenuItemOpen: open }),
  
  // Tables
  selectedFloorId: 'floor-001',
  setSelectedFloorId: (id) => set({ selectedFloorId: id }),
  selectedTableId: null,
  setSelectedTableId: (id) => set({ selectedTableId: id }),
  
  // Kitchen
  kitchenStation: 'all',
  setKitchenStation: (station) => set({ kitchenStation: station }),
  
  // Staff
  isAddStaffOpen: false,
  setIsAddStaffOpen: (open) => set({ isAddStaffOpen: open }),
  
  // QR Codes
  isGenerateQROpen: false,
  setIsGenerateQROpen: (open) => set({ isGenerateQROpen: open }),
  
  // Notifications
  unreadNotificationCount: 3,
  setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),
}));
