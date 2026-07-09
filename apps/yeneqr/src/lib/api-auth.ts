// ============================================================
// Yene QR — API Authentication Helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, resolveUserPermissions, type TokenPayload, type CustomerTokenPayload } from './auth'

interface AuthResult {
  userId: string
  restaurantId: string
  role: string
  branchId?: string
  type: 'staff' | 'admin' | 'customer'
  sessionId?: string
  tableId?: string
  permissions: string[] // Resolved effective permissions from JWT (or fallback to role defaults)
}

/**
 * Get auth context from request — returns null if not authenticated.
 * Tries JWT Bearer token first.
 * 
 * SECURITY: Header-based auth is ONLY available in development mode.
 * In production, only JWT tokens are accepted.
 * Using headers in production would allow anyone to forge x-restaurant-id,
 * x-user-id, x-user-role to impersonate any user.
 */
export function getAuthContext(request: NextRequest): AuthResult | null {
  // Try Bearer token (JWT) first — this is the production auth path
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (payload) {
      if (payload.type === 'customer') {
        const cp = payload as CustomerTokenPayload
        return {
          userId: cp.sessionId,
          restaurantId: cp.restaurantId,
          branchId: cp.branchId,
          role: 'customer',
          type: 'customer',
          sessionId: cp.sessionId,
          tableId: cp.tableId,
          permissions: resolveUserPermissions('customer'),
        }
      }
      const sp = payload as TokenPayload
      // Use permissions from JWT if available; otherwise fall back to role defaults
      // (fallback handles tokens issued before the permissions-in-JWT migration)
      const permissions = sp.permissions || resolveUserPermissions(sp.role)
      return {
        userId: sp.userId,
        restaurantId: sp.restaurantId || '',
        branchId: sp.branchId,
        role: sp.role,
        type: sp.type,
        permissions,
      }
    }
  }

  // No valid auth found
  return null
}

/**
 * Require authentication — throws if not authenticated.
 * Used for mutation endpoints where auth is mandatory.
 */
export function requireAuth(request: NextRequest): AuthResult {
  const auth = getAuthContext(request)
  if (!auth) {
    throw new Error('Unauthorized')
  }
  return auth
}

// ============================================================
// Permission-Based Authorization Helpers
// Use these instead of raw role checks (auth.role !== 'super_admin' etc.)
// ============================================================

/**
 * Check if the authenticated user has a specific permission.
 * Uses the resolved permissions from the JWT token (includes per-user overrides).
 * 
 * Example:
 *   if (!hasPerm(auth, 'menu:manage')) return forbidden()
 */
export function hasPerm(auth: AuthResult, permissionKey: string): boolean {
  return auth.permissions.includes(permissionKey)
}

/**
 * Check if the authenticated user has ANY of the given permissions.
 */
export function hasAnyPerm(auth: AuthResult, permissionKeys: string[]): boolean {
  return permissionKeys.some(key => auth.permissions.includes(key))
}

/**
 * Check if the authenticated user has ALL of the given permissions.
 */
export function hasAllPerms(auth: AuthResult, permissionKeys: string[]): boolean {
  return permissionKeys.every(key => auth.permissions.includes(key))
}

/**
 * Require a specific permission — returns a 403 response if the user lacks it.
 * Also checks that the user belongs to the correct restaurant (for restaurant-scoped routes).
 * 
 * Usage in API routes:
 *   const auth = requireAuth(request)
 *   const permErr = requirePerm(auth, 'menu:manage', id)
 *   if (permErr) return permErr
 *
 * For platform-level routes (no restaurant scope), pass no restaurantId:
 *   const permErr = requirePerm(auth, 'platform:manage')
 */
export function requirePerm(
  auth: AuthResult,
  permissionKey: string,
  restaurantId?: string
): NextResponse | null {
  // Restaurant scope check: non-super_admin users must belong to the restaurant
  if (restaurantId && !hasPerm(auth, 'platform:manage')) {
    if (auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Permission check
  if (!hasPerm(auth, permissionKey)) {
    return NextResponse.json({ error: 'Forbidden — insufficient permission' }, { status: 403 })
  }

  return null // No error — user has permission
}

/**
 * Require ANY of the given permissions — returns 403 if the user has none.
 * Also checks restaurant scope like requirePerm.
 */
export function requireAnyPerm(
  auth: AuthResult,
  permissionKeys: string[],
  restaurantId?: string
): NextResponse | null {
  // Restaurant scope check
  if (restaurantId && !hasPerm(auth, 'platform:manage')) {
    if (auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Permission check
  if (!hasAnyPerm(auth, permissionKeys)) {
    return NextResponse.json({ error: 'Forbidden — insufficient permission' }, { status: 403 })
  }

  return null
}

// ============================================================
// Branch-Access Verification
// Use these after requirePerm() on any route that accepts a ?branchId=
// query param or a branchId in the request body.
// ============================================================

/**
 * Verify that the authenticated user is allowed to access the requested branch.
 *
 * Access rules (in order):
 *   1. Platform admins (platform:manage) → always allowed
 *   2. Restaurant staff with 'branch:view_all' → allowed at any branch of their restaurant
 *   3. Restaurant staff without 'branch:view_all' → allowed ONLY if
 *      auth.branchId matches requestedBranchId (or requestedBranchId is null/undefined,
 *      meaning "my branch" — see resolveBranchScope below for the helper that
 *      handles the "all branches" fallback)
 *   4. Customers → allowed ONLY if auth.branchId matches requestedBranchId
 *      (a customer at Branch A cannot query Branch B)
 *
 * Returns null if access is granted, or a 403 NextResponse if denied.
 *
 * Usage:
 *   const branchErr = verifyBranchAccess(auth, requestedBranchId, restaurantId)
 *   if (branchErr) return branchErr
 *
 * NOTE: This helper does NOT check restaurant scope — call requirePerm first.
 *       This helper does NOT check if the branch exists — call db.branch.findFirst
 *       afterwards if you need that (most routes already do).
 */
export function verifyBranchAccess(
  auth: AuthResult,
  requestedBranchId: string | undefined | null,
  restaurantId?: string
): NextResponse | null {
  // Platform admins can access any branch
  if (hasPerm(auth, 'platform:manage')) {
    return null
  }

  // Restaurant-scoped staff with branch:view_all can access any branch of their restaurant
  if (hasPerm(auth, 'branch:view_all')) {
    // (restaurant scope was already checked by requirePerm, but double-check defensively)
    if (restaurantId && auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return null
  }

  // Customer tokens: must match their session branch exactly
  if (auth.type === 'customer') {
    if (!requestedBranchId) {
      // Customer requests without branchId are suspicious — deny by default.
      // Customer-facing routes should always pass branchId from their session.
      return NextResponse.json(
        { error: 'Forbidden — branchId is required for customer requests' },
        { status: 403 }
      )
    }
    if (auth.branchId && auth.branchId !== requestedBranchId) {
      return NextResponse.json(
        { error: 'Forbidden — branch mismatch with customer session' },
        { status: 403 }
      )
    }
    return null
  }

  // Branch-scoped staff (waiter, kitchen_staff, cashier, etc. without view_all):
  // can only access their assigned branch.
  if (!requestedBranchId) {
    // No branchId requested — see resolveBranchScope for the recommended
    // pattern (default to auth.branchId for branch-scoped roles). A bare
    // null requestedBranchId here means the caller didn't resolve the scope,
    // which would leak all-branch data. Deny defensively.
    return NextResponse.json(
      { error: 'Forbidden — branchId is required. Your role is scoped to a single branch.' },
      { status: 403 }
    )
  }
  if (auth.branchId && auth.branchId !== requestedBranchId) {
    return NextResponse.json(
      { error: 'Forbidden — you do not have access to this branch' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Resolve the effective branch scope for a list query.
 *
 * For roles with 'branch:view_all': returns the requested branchId (or undefined
 * to mean "all branches"), so managers/owners can filter or view all.
 *
 * For branch-scoped roles (waiter, kitchen_staff, cashier): returns auth.branchId
 * — ignoring whatever the client sent. This closes the "all-branch data leak" anti-
 * pattern where omitting ?branchId= returns data from every branch.
 *
 * For platform admins: returns the requested branchId (or undefined for all).
 *
 * For customers: returns auth.branchId (their session branch).
 *
 * Usage:
 *   const effectiveBranchId = resolveBranchScope(auth, searchParams.get('branchId'))
 *   const where = { restaurantId, ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}) }
 */
export function resolveBranchScope(
  auth: AuthResult,
  requestedBranchId: string | undefined | null
): string | undefined {
  // Platform admins: respect the requested scope
  if (hasPerm(auth, 'platform:manage')) {
    return requestedBranchId || undefined
  }

  // Restaurant staff with view_all: respect the requested scope (can be undefined = all)
  if (hasPerm(auth, 'branch:view_all')) {
    return requestedBranchId || undefined
  }

  // Branch-scoped staff and customers: ALWAYS use their own branch,
  // ignoring whatever the client sent. This is the security boundary.
  return auth.branchId || undefined
}
