'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from './store';
import { PERMISSIONS, hasAnyPermission, hasUserAnyPermission } from './auth';

// ============================================================
// Route Definitions
// ============================================================

export type AuthRequirement = 'none' | 'staff' | 'super_admin';

export interface RouteDefinition {
  name: string;
  pattern: string;           // e.g. '/dashboard/orders' or '/menu/:qrPayload'
  auth: AuthRequirement;
  title: string;
}

const ROUTES: RouteDefinition[] = [
  // Public routes (no slug context)
  { name: 'landing',        pattern: '/',                      auth: 'none',        title: 'Yene QR' },
  { name: 'register',       pattern: '/register',              auth: 'none',        title: 'Register' },
  { name: 'forgot-password', pattern: '/forgot-password',      auth: 'none',        title: 'Forgot Password' },
  { name: 'reset-password', pattern: '/reset-password',        auth: 'none',        title: 'Reset Password' },
  { name: 'two-factor',     pattern: '/two-factor',            auth: 'none',        title: '2FA Verification' },

  // Restaurant-scoped public routes (slug required)
  { name: 'restaurant-landing', pattern: '/restaurant-landing', auth: 'none',       title: 'Restaurant' },
  { name: 'restaurant-login',   pattern: '/login',              auth: 'none',       title: 'Login' },
  { name: 'customer-menu',      pattern: '/menu/:qrPayload',    auth: 'none',       title: 'Menu' },

  // Protected: staff (accessed via /{slug}/dashboard/...)
  { name: 'dashboard',              pattern: '/dashboard',              auth: 'staff',       title: 'Dashboard' },
  { name: 'dashboard-orders',       pattern: '/dashboard/orders',       auth: 'staff',       title: 'Orders' },
  { name: 'dashboard-menu',         pattern: '/dashboard/menu',         auth: 'staff',       title: 'Menu Management' },
  { name: 'dashboard-tables',       pattern: '/dashboard/tables',       auth: 'staff',       title: 'Tables' },
  { name: 'dashboard-reservations', pattern: '/dashboard/reservations', auth: 'staff',       title: 'Reservations' },
  { name: 'dashboard-kitchen',      pattern: '/dashboard/kitchen',      auth: 'staff',       title: 'Kitchen Display' },
  { name: 'dashboard-qr-codes',     pattern: '/dashboard/qr-codes',     auth: 'staff',       title: 'QR Codes' },
  { name: 'dashboard-staff',        pattern: '/dashboard/staff',        auth: 'staff',       title: 'Staff' },
  { name: 'dashboard-branches',     pattern: '/dashboard/branches',     auth: 'staff',       title: 'Branches' },
  { name: 'dashboard-analytics',    pattern: '/dashboard/analytics',    auth: 'staff',       title: 'Analytics' },
  { name: 'dashboard-crm',          pattern: '/dashboard/crm',          auth: 'staff',       title: 'CRM' },
  { name: 'dashboard-waitlist',     pattern: '/dashboard/waitlist',     auth: 'staff',       title: 'Waitlist' },
  { name: 'dashboard-menu-engineering', pattern: '/dashboard/menu-engineering', auth: 'staff', title: 'Menu Engineering' },
  { name: 'dashboard-promotions',   pattern: '/dashboard/promotions',   auth: 'staff',       title: 'Promotions' },
  { name: 'dashboard-settings',     pattern: '/dashboard/settings',     auth: 'staff',       title: 'Settings' },
  { name: 'dashboard-notifications', pattern: '/dashboard/notifications', auth: 'staff',     title: 'Notifications' },
  { name: 'dashboard-localization', pattern: '/dashboard/localization',  auth: 'staff',     title: 'Localization' },
  { name: 'dashboard-refunds',     pattern: '/dashboard/refunds',      auth: 'staff',     title: 'Refunds' },
  { name: 'dashboard-reviews',     pattern: '/dashboard/reviews',        auth: 'staff',       title: 'Reviews' },
  { name: 'dashboard-waiter',      pattern: '/dashboard/waiter',         auth: 'staff',       title: 'Waiter View' },
  { name: 'dashboard-inventory',   pattern: '/dashboard/inventory',      auth: 'staff',       title: 'Inventory' },
  { name: 'dashboard-shifts',     pattern: '/dashboard/shifts',         auth: 'staff',       title: 'Shifts' },
  { name: 'dashboard-audit-logs',  pattern: '/dashboard/audit-logs',     auth: 'staff',       title: 'Audit Logs' },
  { name: 'dashboard-ai',          pattern: '/dashboard/ai',             auth: 'staff',       title: 'AI Assistant' },
  { name: 'dashboard-invoices',    pattern: '/dashboard/invoices',       auth: 'staff',       title: 'Invoices' },
  { name: 'dashboard-platform-billing', pattern: '/dashboard/platform-billing', auth: 'staff', title: 'Platform Billing' },
  { name: 'dashboard-rewards',     pattern: '/dashboard/rewards',        auth: 'staff',       title: 'Rewards' },
  { name: 'dashboard-printers',    pattern: '/dashboard/printers',       auth: 'staff',       title: 'Printers' },
  { name: 'dashboard-z-report',    pattern: '/dashboard/z-report',       auth: 'staff',       title: 'Z-Report' },

  // Protected: super_admin
  { name: 'admin',                  pattern: '/admin',                  auth: 'super_admin', title: 'Admin Overview' },
  { name: 'admin-restaurants',      pattern: '/admin/restaurants',      auth: 'super_admin', title: 'Restaurants' },
  { name: 'admin-subscriptions',    pattern: '/admin/subscriptions',    auth: 'super_admin', title: 'Subscriptions' },
  { name: 'admin-invoices',         pattern: '/admin/invoices',         auth: 'super_admin', title: 'Invoices' },
  { name: 'admin-support',          pattern: '/admin/support',          auth: 'super_admin', title: 'Support Tickets' },
  { name: 'admin-flags',            pattern: '/admin/flags',            auth: 'super_admin', title: 'Feature Flags' },
  { name: 'admin-analytics',        pattern: '/admin/analytics',        auth: 'super_admin', title: 'Platform Analytics' },
  { name: 'admin-ai',              pattern: '/admin/ai',                auth: 'super_admin', title: 'AI Management' },
];

// ============================================================
// Slug Extraction & URL Helpers
// ============================================================

// Known non-slug path prefixes — these are platform-level routes without a restaurant slug
const PLATFORM_PREFIXES = new Set([
  'admin', 'register', 'forgot-password', 'reset-password', 'two-factor', 'login', 'menu',
]);

/**
 * Extract the restaurant slug from a hash path.
 * New pattern: /{slug}/dashboard/... → { slug: 'slug', rest: '/dashboard/...' }
 * Legacy pattern: /r/{slug}/dashboard/... → { slug: 'slug', rest: '/dashboard/...' }
 * Platform routes: /admin/... → { slug: null, rest: '/admin/...' }
 * Root: / → { slug: null, rest: '/' }
 */
function extractSlug(pathname: string): { slug: string | null; rest: string } {
  const parts = pathname.split('/').filter(Boolean);

  // Root path
  if (parts.length === 0) {
    return { slug: null, rest: '/' };
  }

  // Legacy /r/{slug}/... pattern (redirect later)
  if (parts.length >= 2 && parts[0] === 'r') {
    const slug = parts[1];
    const rest = '/' + parts.slice(2).join('/');
    return { slug, rest: rest || '/' };
  }

  // Platform routes (no slug)
  if (PLATFORM_PREFIXES.has(parts[0])) {
    return { slug: null, rest: pathname };
  }

  // The first segment is the restaurant slug
  const slug = parts[0];
  const rest = '/' + parts.slice(1).join('/');
  return { slug, rest: rest === '/' ? '/restaurant-landing' : rest };
}

/**
 * Build a slug-prefixed path for dashboard routes.
 * /dashboard → /{slug}/dashboard
 * /admin stays as /admin
 * Public non-restaurant routes stay as-is
 */
export function slugPath(slug: string | undefined | null, path: string): string {
  // Admin routes don't get a slug prefix
  if (path.startsWith('/admin')) return path;
  // Platform public routes don't get a slug prefix
  if (path === '/' || path.startsWith('/register') || path.startsWith('/login') ||
      path.startsWith('/forgot-password') || path.startsWith('/reset-password') ||
      path.startsWith('/two-factor')) {
    return path;
  }
  // Restaurant-scoped routes get slug prefix
  if (slug) {
    return `/${slug}${path}`;
  }
  return path;
}

// ============================================================
// Route Matching
// ============================================================

export interface MatchedRoute {
  name: string;
  params: Record<string, string>;
  title: string;
  auth: AuthRequirement;
  slug: string | null; // The restaurant slug from the URL
}

function matchRoute(pathname: string): MatchedRoute {
  // Normalize: remove trailing slash (except root)
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

  // Try to extract slug prefix
  const { slug, rest } = extractSlug(normalized);

  // Match the rest of the path against route patterns
  for (const route of ROUTES) {
    const params = matchPattern(route.pattern, rest);
    if (params !== null) {
      // Resolve title for restaurant landing
      let title = route.title;
      if (route.name === 'restaurant-landing' && slug) {
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      return {
        name: route.name,
        params,
        title,
        auth: route.auth,
        slug,
      };
    }
  }

  // Fallback to landing
  return { name: 'landing', params: {}, title: 'Yene QR', auth: 'none', slug: null };
}

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const pathP = pathParts[i];

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(pathP);
    } else if (pp !== pathP) {
      return null;
    }
  }

  return params;
}

// ============================================================
// Parse hash from URL
// ============================================================

function getHashPathname(): string {
  if (typeof window === 'undefined') return '/';
  const hash = window.location.hash.slice(1) || '/'; // Remove leading #
  return hash.startsWith('/') ? hash : '/' + hash;
}

// ============================================================
// Auth Guard
// ============================================================

function checkAuth(auth: AuthRequirement, slug: string | null): { allowed: boolean; redirect?: string } {
  if (auth === 'none') return { allowed: true };

  // Read from localStorage synchronously (no zustand dependency for initial check)
  let token: string | null = null;
  let userStr: string | null = null;

  try {
    token = localStorage.getItem('yeneqr_token');
    userStr = localStorage.getItem('yeneqr_user');
  } catch {
    // SSR or storage unavailable
  }

  if (!token || !userStr) {
    // Redirect to restaurant-specific login if slug is present
    if (slug) {
      return { allowed: false, redirect: `/${slug}/login` };
    }
    return { allowed: false, redirect: '/' };
  }

  // Basic JWT expiry check
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      if (slug) {
        return { allowed: false, redirect: `/${slug}/login` };
      }
      return { allowed: false, redirect: '/' };
    }

    if (auth === 'super_admin') {
      const user = JSON.parse(userStr);
      if (user.role !== 'super_admin' && user.role !== 'support_admin') {
        return { allowed: false, redirect: '/admin' };
      }
    }
  } catch {
    if (slug) {
      return { allowed: false, redirect: `/${slug}/login` };
    }
    return { allowed: false, redirect: '/' };
  }

  return { allowed: true };
}

// ============================================================
// Router Context
// ============================================================

interface RouterContextValue {
  route: MatchedRoute;
  navigate: (path: string) => void;
  back: () => void;
}

const RouterContext = createContext<RouterContextValue>({
  route: { name: 'landing', params: {}, title: 'Yene QR', auth: 'none', slug: null },
  navigate: () => {},
  back: () => {},
});

export function useRouter() {
  return useContext(RouterContext);
}

// ============================================================
// Helper: Build a hash URL (supports slug-prefixed paths)
// ============================================================

export function hashUrl(path: string): string {
  return `#${path}`;
}

// ============================================================
// Role-Based Route Permission Guard
// Ensures users can only navigate to routes their role permits
// ============================================================

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  'dashboard':              [PERMISSIONS.RESTAURANT_VIEW.key],
  'dashboard-orders':       [PERMISSIONS.ORDER_VIEW.key],
  'dashboard-menu':         [PERMISSIONS.MENU_VIEW.key],
  'dashboard-tables':       [PERMISSIONS.TABLE_VIEW.key],
  'dashboard-reservations': [PERMISSIONS.TABLE_VIEW.key],
  'dashboard-kitchen':      [PERMISSIONS.KITCHEN_MANAGE.key, PERMISSIONS.ORDER_VIEW.key],
  'dashboard-waiter':       [PERMISSIONS.TABLE_VIEW.key, PERMISSIONS.ORDER_VIEW.key],
  'dashboard-qr-codes':     [PERMISSIONS.QR_VIEW.key],
  'dashboard-staff':        [PERMISSIONS.STAFF_VIEW.key],
  'dashboard-branches':     [PERMISSIONS.BRANCH_VIEW.key],
  'dashboard-analytics':    [PERMISSIONS.ANALYTICS_VIEW.key],
  'dashboard-crm':          [PERMISSIONS.ANALYTICS_VIEW.key],
  'dashboard-waitlist':     [PERMISSIONS.RESTAURANT_VIEW.key],
  'dashboard-menu-engineering': [PERMISSIONS.ANALYTICS_VIEW.key],
  'dashboard-promotions':   [PERMISSIONS.MENU_MANAGE.key],
  'dashboard-settings':     [PERMISSIONS.STAFF_VIEW.key],
  'dashboard-localization': [PERMISSIONS.BRANCH_MANAGE.key],
  'dashboard-notifications': [PERMISSIONS.RESTAURANT_VIEW.key],
  'dashboard-refunds':      [PERMISSIONS.PAYMENT_VIEW.key],
  'dashboard-reviews':      [PERMISSIONS.ANALYTICS_VIEW.key],
  'dashboard-inventory':    [PERMISSIONS.RESTAURANT_MANAGE.key],
  'dashboard-shifts':      [PERMISSIONS.STAFF_VIEW.key],
  'dashboard-audit-logs':   [PERMISSIONS.RESTAURANT_MANAGE.key],
  'dashboard-ai':           [PERMISSIONS.RESTAURANT_VIEW.key],
  'dashboard-invoices':     [PERMISSIONS.SUBSCRIPTION_MANAGE.key],
  'dashboard-platform-billing': [PERMISSIONS.PAYMENT_VIEW.key],
  'dashboard-rewards':      [PERMISSIONS.PAYMENT_VIEW.key],
  'dashboard-printers':     [PERMISSIONS.PAYMENT_VIEW.key],
  'dashboard-z-report':     [PERMISSIONS.ANALYTICS_VIEW.key],
};

/** Get the default dashboard path for a given role */
function getRoleDefaultPath(role: string, slug: string | null): string {
  const prefix = slug ? `/${slug}` : '';
  switch (role) {
    case 'kitchen_staff': return `${prefix}/dashboard/kitchen`;
    case 'waiter':        return `${prefix}/dashboard/waiter`;
    case 'cashier':       return `${prefix}/dashboard/orders`;
    default:              return `${prefix}/dashboard`;
  }
}

function checkRoutePermission(routeName: string, slug: string | null): { allowed: boolean; redirect?: string } {
  // No permission check for non-dashboard routes
  if (!routeName.startsWith('dashboard')) return { allowed: true };

  const requiredPermissions = ROUTE_PERMISSIONS[routeName];
  if (!requiredPermissions) return { allowed: true }; // Unknown route, allow

  try {
    const userStr = localStorage.getItem('yeneqr_user');
    if (!userStr) return { allowed: true }; // Will be caught by auth guard

    const user = JSON.parse(userStr);
    const role = user.role || 'waiter';

    // Super admins can access everything
    if (role === 'super_admin' || role === 'support_admin') return { allowed: true };

    // Use resolved permissions if available (from login response), 
    // otherwise fall back to per-user override resolution
    if (user.resolvedPermissions && Array.isArray(user.resolvedPermissions)) {
      if (requiredPermissions.some(key => user.resolvedPermissions.includes(key))) {
        return { allowed: true };
      }
    } else {
      // Fall back to resolving from role + per-user overrides
      const userOverrides = {
        permissions: user.permissions,
        additionalPermissions: user.additionalPermissions,
        revokedPermissions: user.revokedPermissions,
      };
      if (hasUserAnyPermission(role, requiredPermissions, userOverrides)) {
        return { allowed: true };
      }
    }

    // Access denied — redirect to role-appropriate default page
    return { allowed: false, redirect: getRoleDefaultPath(role, slug) };
  } catch {
    return { allowed: true }; // On error, allow (auth guard will catch)
  }
}

// ============================================================
// Slug Guard — ensures the URL slug matches the user's restaurant
// ============================================================

function validateSlug(slug: string | null, routeName: string): { valid: boolean; redirect?: string } {
  // No slug validation needed for platform routes
  if (routeName === 'landing' || routeName.startsWith('admin') ||
      routeName === 'register' ||
      routeName === 'forgot-password' || routeName === 'reset-password' ||
      routeName === 'two-factor') {
    return { valid: true };
  }

  // Restaurant-scoped public pages (restaurant-landing, restaurant-login, customer-menu)
  // are allowed without auth — anyone can view a restaurant's login page or menu
  if (routeName === 'restaurant-landing' || routeName === 'restaurant-login' || routeName === 'customer-menu') {
    return { valid: true };
  }

  // For dashboard routes, auth is required
  try {
    const userStr = localStorage.getItem('yeneqr_user');
    if (!userStr) {
      // Not logged in — redirect to restaurant-specific login
      if (slug) {
        return { valid: false, redirect: `/${slug}/login` };
      }
      return { valid: false, redirect: '/' };
    }

    const user = JSON.parse(userStr);

    // Super admins can access any slug
    if (user.role === 'super_admin' || user.role === 'support_admin') {
      // If they're on a dashboard route without a slug, redirect to admin
      if (!slug && routeName.startsWith('dashboard')) {
        return { valid: false, redirect: '/admin' };
      }
      return { valid: true };
    }

    // For regular staff: slug is required for dashboard routes
    if (!slug && routeName.startsWith('dashboard')) {
      // Legacy URL without slug — redirect to slug-prefixed URL
      if (user.restaurantSlug) {
        return { valid: false, redirect: `/${user.restaurantSlug}/dashboard` };
      }
      if (user.restaurantId) {
        return { valid: false, redirect: `/${user.restaurantId}/dashboard` };
      }
      return { valid: false, redirect: '/' };
    }

    // For regular staff: slug must match their restaurant
    if (slug) {
      const expectedSlug = user.restaurantSlug || user.restaurantId;
      if (expectedSlug && slug !== expectedSlug) {
        // Wrong restaurant! Redirect to their own restaurant
        return { valid: false, redirect: `/${expectedSlug}/dashboard` };
      }
    }

    return { valid: true };
  } catch {
    if (slug) {
      return { valid: false, redirect: `/${slug}/login` };
    }
    return { valid: false, redirect: '/' };
  }
}

// ============================================================
// Legacy URL Redirect
// ============================================================

function checkLegacyRedirect(pathname: string): string | null {
  // /r/{slug}/... → /{slug}/...
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'r') {
    const slug = parts[1];
    const rest = parts.slice(2).join('/');
    return `/${slug}${rest ? '/' + rest : ''}`;
  }

  // /login → if logged in, redirect to appropriate dashboard; if NOT logged in, let it pass through
  // so the user can see the login page (PlatformLoginPage when no slug, RestaurantLoginPage when slug present)
  if (pathname === '/login') {
    try {
      const userStr = localStorage.getItem('yeneqr_user');
      const token = localStorage.getItem('yeneqr_token');
      if (userStr && token) {
        const user = JSON.parse(userStr);
        if (user.role === 'super_admin' || user.role === 'support_admin') {
          return '/admin';
        }
        if (user.restaurantSlug) {
          return getRoleDefaultPath(user.role, user.restaurantSlug);
        }
      }
    } catch {}
    // NOT logged in — do NOT redirect; let /login resolve to the login page
    return null;
  }

  if (pathname === '/dashboard') {
    try {
      const userStr = localStorage.getItem('yeneqr_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.restaurantSlug) {
          return getRoleDefaultPath(user.role, user.restaurantSlug);
        }
      }
    } catch {}
    return '/';
  }

  return null;
}

// ============================================================
// Router Provider
// ============================================================

export function RouterProvider({ children }: { children: React.ReactNode }) {
  // Always initialize with landing route to avoid hydration mismatch.
  // On SSR, getHashPathname() returns '/' which matches 'landing'.
  // On client, we must also start with 'landing' so the initial render
  // matches the SSR output, then update to the real hash route in useEffect.
  const [route, setRoute] = useState<MatchedRoute>(() =>
    typeof window === 'undefined'
      ? matchRoute('/')
      : matchRoute('/')
  );
  const { hydrateAuth, logout: storeLogout } = useAppStore.getState();
  const [hydrated, setHydrated] = useState(false);

  // Compute the current route from the hash
  const computeRoute = useCallback(() => {
    const pathname = getHashPathname();

    // Check for legacy URL redirects first
    const legacyRedirect = checkLegacyRedirect(pathname);
    if (legacyRedirect) {
      window.location.hash = legacyRedirect;
      return; // computeRoute will be called again by hashchange
    }

    const matched = matchRoute(pathname);

    // Auth guard
    const authCheck = checkAuth(matched.auth, matched.slug);
    if (!authCheck.allowed && authCheck.redirect) {
      window.location.hash = authCheck.redirect;
      return; // computeRoute will be called again by hashchange
    }

    // Slug guard — ensure the slug in the URL matches the user's restaurant
    const slugCheck = validateSlug(matched.slug, matched.name);
    if (!slugCheck.valid && slugCheck.redirect) {
      window.location.hash = slugCheck.redirect;
      return; // computeRoute will be called again by hashchange
    }

    // Role-based route permission guard — ensure the user's role permits this route
    const permCheck = checkRoutePermission(matched.name, matched.slug);
    if (!permCheck.allowed && permCheck.redirect) {
      window.location.hash = permCheck.redirect;
      return;
    }

    setRoute(matched);

    // Update document title
    if (typeof document !== 'undefined') {
      const slugSuffix = matched.slug ? ` — ${matched.slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : '';
      document.title = `${matched.title}${slugSuffix} — Yene QR`;
    }

    // Sync activeTab in the store for backward compat with dashboard views
    const tabMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'dashboard-orders': 'orders',
      'dashboard-menu': 'menu',
      'dashboard-tables': 'tables',
      'dashboard-reservations': 'reservations',
      'dashboard-qr-codes': 'qrcodes',
      'dashboard-kitchen': 'kitchen',
      'dashboard-staff': 'staff',
      'dashboard-branches': 'branches',
      'dashboard-analytics': 'analytics',
      'dashboard-crm': 'crm',
      'dashboard-waitlist': 'waitlist',
      'dashboard-menu-engineering': 'menu-engineering',
      'dashboard-promotions': 'promotions',
      'dashboard-settings': 'settings',
      'dashboard-notifications': 'notifications',
      'dashboard-localization': 'localization',
      'dashboard-refunds': 'refunds',
      'dashboard-reviews': 'reviews',
      'dashboard-waiter': 'waiter',
      'dashboard-inventory': 'inventory',
      'dashboard-shifts': 'shifts',
      'dashboard-audit-logs': 'audit-logs',
      'dashboard-ai': 'ai',
      'dashboard-invoices': 'invoices',
      'dashboard-platform-billing': 'platform-billing',
      'dashboard-rewards': 'rewards',
      'dashboard-printers': 'printers',
      'dashboard-z-report': 'z-report',
    };
    const tab = tabMap[matched.name];
    if (tab) {
      useAppStore.getState().setActiveTab(tab as import('./store').TabId);
    }
  }, []);

  // Initialize: hydrate auth and compute route (client-only, after hydration)
  useEffect(() => {
    // Now that we're in useEffect (client-only, post-hydration),
    // compute the actual route from the hash
    hydrateAuth();
    computeRoute();
    setHydrated(true);

    // Set initial hash if none
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '/';
    }

    // Listen for hash changes
    const handleHashChange = () => {
      computeRoute();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [computeRoute, hydrateAuth]);

  const navigate = useCallback((path: string) => {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : '/' + path;
    window.location.hash = normalizedPath;
  }, []);

  const back = useCallback(() => {
    window.history.back();
  }, []);

  const value = useMemo(() => ({ route, navigate, back }), [route, navigate, back]);

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
}
