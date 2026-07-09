// ============================================================
// Yene QR — Authentication & Authorization
// ============================================================

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// JWT_SECRET is only used server-side (token signing/verification).
// On the client, process.env.JWT_SECRET is never set, so we must NOT
// throw here — the RBAC exports (PERMISSIONS, hasPermission, etc.) are
// safely used client-side and don't need the secret.
const JWT_SECRET = (() => {
  // In the browser there is no JWT_SECRET — that's fine, token ops are server-only.
  if (typeof window !== 'undefined') return ''
  // Server-side: enforce the secret in production (but not during `next build`).
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('FATAL: JWT_SECRET env var required in production')
  }
  return 'yene-qr-dev-secret-change-in-production'
})()
const JWT_EXPIRES_IN = '24h'

export interface TokenPayload {
  userId: string
  email: string
  role: string
  restaurantId?: string
  branchId?: string
  type: 'staff' | 'admin' | 'customer'
  originalRole?: string // For admin impersonation
  originalType?: string // For admin impersonation
  permissions?: string[] // Resolved effective permissions (embedded at login)
}

export interface CustomerTokenPayload {
  sessionId: string
  restaurantId: string
  branchId: string
  tableId: string
  customerId?: string
  language: string
  type: 'customer'
}

// ============================================================
// Password Hashing
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  // Use lower rounds in development for faster sandbox performance
  const rounds = process.env.NODE_ENV === 'production' ? 12 : 4
  const salt = await bcrypt.genSalt(rounds)
  return bcrypt.hash(password, salt)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================================
// JWT Token Generation & Verification
// ============================================================

export function generateStaffToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function generateCustomerToken(payload: CustomerTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '4h' })
}

export function verifyToken(token: string): TokenPayload | CustomerTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload | CustomerTokenPayload
  } catch {
    return null
  }
}

export function generateRefreshToken(payload: { userId: string; type: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

// ============================================================
// RBAC — Role & Permission Definitions
// ============================================================

export type PlatformRole = 'super_admin' | 'support_admin'
export type RestaurantRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen_staff'

export interface Permission {
  key: string
  label: string
  description: string
}

export const PERMISSIONS = {
  // Platform
  PLATFORM_MANAGE: { key: 'platform:manage', label: 'Manage Platform', description: 'Full platform administration' },
  PLATFORM_SUPPORT: { key: 'platform:support', label: 'Support Tenants', description: 'Provide tenant support' },

  // Restaurant
  RESTAURANT_MANAGE: { key: 'restaurant:manage', label: 'Manage Restaurant', description: 'Full restaurant management' },
  RESTAURANT_VIEW: { key: 'restaurant:view', label: 'View Restaurant', description: 'View restaurant details' },

  // Branch
  BRANCH_MANAGE: { key: 'branch:manage', label: 'Manage Branches', description: 'Create and manage branches' },
  BRANCH_VIEW: { key: 'branch:view', label: 'View Branches', description: 'View branch details' },
  BRANCH_VIEW_ALL: { key: 'branch:view_all', label: 'View All Branches', description: 'Access data across all branches of the restaurant (owners, managers). Without this, staff are scoped to their assigned branch only.' },

  // Staff
  STAFF_MANAGE: { key: 'staff:manage', label: 'Manage Staff', description: 'Create and manage staff accounts' },
  STAFF_VIEW: { key: 'staff:view', label: 'View Staff', description: 'View staff list' },

  // Menu
  MENU_MANAGE: { key: 'menu:manage', label: 'Manage Menus', description: 'Create and modify menus' },
  MENU_VIEW: { key: 'menu:view', label: 'View Menus', description: 'View menu items' },

  // QR
  QR_MANAGE: { key: 'qr:manage', label: 'Manage QR Codes', description: 'Generate and manage QR codes' },
  QR_VIEW: { key: 'qr:view', label: 'View QR Codes', description: 'View QR code details' },

  // Orders
  ORDER_VIEW: { key: 'order:view', label: 'View Orders', description: 'View order details' },
  ORDER_MANAGE: { key: 'order:manage', label: 'Manage Orders', description: 'Accept, cancel, modify orders' },
  ORDER_CREATE: { key: 'order:create', label: 'Create Orders', description: 'Place orders' },

  // Kitchen
  KITCHEN_MANAGE: { key: 'kitchen:manage', label: 'Kitchen Operations', description: 'Update kitchen item status' },

  // Payments
  PAYMENT_MANAGE: { key: 'payment:manage', label: 'Manage Payments', description: 'Process and manage payments' },
  PAYMENT_VIEW: { key: 'payment:view', label: 'View Payments', description: 'View payment details' },

  // Analytics
  ANALYTICS_VIEW: { key: 'analytics:view', label: 'View Analytics', description: 'View analytics dashboard' },

  // Tables
  TABLE_MANAGE: { key: 'table:manage', label: 'Manage Tables', description: 'Manage table layout and status' },
  TABLE_VIEW: { key: 'table:view', label: 'View Tables', description: 'View table status' },

  // Subscriptions
  SUBSCRIPTION_MANAGE: { key: 'subscription:manage', label: 'Manage Subscription', description: 'Manage billing and plans' },

  // Customer actions
  CUSTOMER_ORDER: { key: 'customer:order', label: 'Place Order', description: 'Browse menu and place orders' },
  CUSTOMER_CALL_WAITER: { key: 'customer:call_waiter', label: 'Call Waiter', description: 'Request waiter assistance' },
  CUSTOMER_REQUEST_BILL: { key: 'customer:request_bill', label: 'Request Bill', description: 'Request the bill' },
} as const

// Role → Permissions mapping
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: Object.values(PERMISSIONS).map(p => p.key),
  support_admin: [
    PERMISSIONS.PLATFORM_SUPPORT.key,
    PERMISSIONS.RESTAURANT_VIEW.key,
    PERMISSIONS.STAFF_VIEW.key,
  ],
  owner: [
    PERMISSIONS.RESTAURANT_MANAGE.key,
    PERMISSIONS.RESTAURANT_VIEW.key,
    PERMISSIONS.BRANCH_MANAGE.key,
    PERMISSIONS.BRANCH_VIEW.key,
    PERMISSIONS.BRANCH_VIEW_ALL.key,
    PERMISSIONS.STAFF_MANAGE.key,
    PERMISSIONS.STAFF_VIEW.key,
    PERMISSIONS.MENU_MANAGE.key,
    PERMISSIONS.MENU_VIEW.key,
    PERMISSIONS.QR_MANAGE.key,
    PERMISSIONS.QR_VIEW.key,
    PERMISSIONS.ORDER_VIEW.key,
    PERMISSIONS.ORDER_CREATE.key,
    PERMISSIONS.ORDER_MANAGE.key,
    PERMISSIONS.PAYMENT_MANAGE.key,
    PERMISSIONS.PAYMENT_VIEW.key,
    PERMISSIONS.ANALYTICS_VIEW.key,
    PERMISSIONS.TABLE_MANAGE.key,
    PERMISSIONS.TABLE_VIEW.key,
    PERMISSIONS.SUBSCRIPTION_MANAGE.key,
  ],
  manager: [
    PERMISSIONS.RESTAURANT_VIEW.key,
    PERMISSIONS.BRANCH_MANAGE.key,
    PERMISSIONS.BRANCH_VIEW.key,
    PERMISSIONS.BRANCH_VIEW_ALL.key,
    PERMISSIONS.STAFF_MANAGE.key,
    PERMISSIONS.STAFF_VIEW.key,
    PERMISSIONS.MENU_MANAGE.key,
    PERMISSIONS.MENU_VIEW.key,
    PERMISSIONS.QR_MANAGE.key,
    PERMISSIONS.QR_VIEW.key,
    PERMISSIONS.ORDER_VIEW.key,
    PERMISSIONS.ORDER_CREATE.key,
    PERMISSIONS.ORDER_MANAGE.key,
    PERMISSIONS.PAYMENT_MANAGE.key,
    PERMISSIONS.PAYMENT_VIEW.key,
    PERMISSIONS.ANALYTICS_VIEW.key,
    PERMISSIONS.TABLE_MANAGE.key,
    PERMISSIONS.TABLE_VIEW.key,
  ],
  cashier: [
    PERMISSIONS.RESTAURANT_VIEW.key,
    PERMISSIONS.ORDER_VIEW.key,
    PERMISSIONS.ORDER_CREATE.key,
    PERMISSIONS.ORDER_MANAGE.key,
    PERMISSIONS.PAYMENT_MANAGE.key,
    PERMISSIONS.PAYMENT_VIEW.key,
    PERMISSIONS.TABLE_VIEW.key,
  ],
  waiter: [
    PERMISSIONS.RESTAURANT_VIEW.key,
    PERMISSIONS.ORDER_VIEW.key,
    PERMISSIONS.ORDER_CREATE.key,
    PERMISSIONS.ORDER_MANAGE.key,       // Accept orders, pick up & deliver
    PERMISSIONS.TABLE_VIEW.key,
    PERMISSIONS.TABLE_MANAGE.key,
    PERMISSIONS.MENU_VIEW.key,
  ],
  kitchen_staff: [
    PERMISSIONS.RESTAURANT_VIEW.key,
    PERMISSIONS.ORDER_VIEW.key,
    PERMISSIONS.KITCHEN_MANAGE.key,
  ],
  customer: [
    PERMISSIONS.CUSTOMER_ORDER.key,
    PERMISSIONS.CUSTOMER_CALL_WAITER.key,
    PERMISSIONS.CUSTOMER_REQUEST_BILL.key,
  ],
}

// ============================================================
// Permission-Based Access Control
// Supports per-user permission overrides on top of role defaults
// ============================================================

/**
 * Resolve the effective permission set for a user.
 * Merges role-default permissions with per-user overrides:
 *   - If user has `permissions` array, those are used as the BASE
 *   - If user has `additionalPermissions`, those are ADDED on top of role defaults
 *   - If user has `revokedPermissions`, those are REMOVED from role defaults
 *   - If no overrides, falls back to pure role-based permissions
 */
export function resolveUserPermissions(
  role: string,
  userOverrides?: {
    permissions?: string[]        // Explicit permission list (replaces role defaults entirely)
    additionalPermissions?: string[]  // Added on top of role defaults
    revokedPermissions?: string[]     // Removed from role defaults
  } | null
): string[] {
  const rolePerms = ROLE_PERMISSIONS[role] || []

  // If user has an explicit permission list, use that as the base
  if (userOverrides?.permissions && userOverrides.permissions.length > 0) {
    return [...new Set([...userOverrides.permissions, ...(userOverrides.additionalPermissions || [])])]
      .filter(p => !(userOverrides.revokedPermissions || []).includes(p))
  }

  // Otherwise, start with role defaults and apply additions/removals
  let effective = [...rolePerms]

  if (userOverrides?.additionalPermissions) {
    effective = [...effective, ...userOverrides.additionalPermissions]
  }

  if (userOverrides?.revokedPermissions) {
    effective = effective.filter(p => !userOverrides.revokedPermissions!.includes(p))
  }

  return [...new Set(effective)]
}

/**
 * Check if a user (by role + optional overrides) has a specific permission.
 */
export function hasPermission(role: string, permissionKey: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permissionKey)
}

/**
 * Check if a user has a specific permission, considering per-user overrides.
 * This is the PREFERRED function for permission checks in the dashboard.
 */
export function hasUserPermission(
  role: string,
  permissionKey: string,
  userOverrides?: {
    permissions?: string[]
    additionalPermissions?: string[]
    revokedPermissions?: string[]
  } | null
): boolean {
  const effective = resolveUserPermissions(role, userOverrides)
  return effective.includes(permissionKey)
}

export function hasAnyPermission(role: string, permissionKeys: string[]): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissionKeys.some(key => permissions.includes(key))
}

/**
 * Check if a user has ANY of the given permissions, considering per-user overrides.
 */
export function hasUserAnyPermission(
  role: string,
  permissionKeys: string[],
  userOverrides?: {
    permissions?: string[]
    additionalPermissions?: string[]
    revokedPermissions?: string[]
  } | null
): boolean {
  const effective = resolveUserPermissions(role, userOverrides)
  return permissionKeys.some(key => effective.includes(key))
}

export function hasAllPermissions(role: string, permissionKeys: string[]): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissionKeys.every(key => permissions.includes(key))
}

/**
 * Check if a user has ALL of the given permissions, considering per-user overrides.
 */
export function hasUserAllPermissions(
  role: string,
  permissionKeys: string[],
  userOverrides?: {
    permissions?: string[]
    additionalPermissions?: string[]
    revokedPermissions?: string[]
  } | null
): boolean {
  const effective = resolveUserPermissions(role, userOverrides)
  return permissionKeys.every(key => effective.includes(key))
}

// ============================================================
// Permission → Role mapping (which roles grant a permission)
// ============================================================

/**
 * Get all roles that have a specific permission.
 * Used by the order state machine to check if a user's role allows a transition.
 */
export function getRolesWithPermission(permissionKey: string): string[] {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([_, perms]) => perms.includes(permissionKey))
    .map(([role, _]) => role)
}

/**
 * Check if a role has a specific permission (alias for hasPermission, more explicit name).
 */
export function roleHasPermission(role: string, permissionKey: string): boolean {
  return hasPermission(role, permissionKey)
}
