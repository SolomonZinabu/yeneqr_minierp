// ============================================================
// Yene QR — Switch Branch API Route
// POST /api/auth/switch-branch
// Reissues a JWT with a new branchId for the current user.
//
// This endpoint exists because the frontend branch switcher (in
// dashboard-layout.tsx) updates the Zustand store but, once the
// backend started enforcing auth.branchId via resolveBranchScope
// (Phase 2.3), the JWT itself must be re-issued for the switch to
// take effect on the server side.
//
// Access rules:
//   - Platform admins (super_admin, support_admin): can switch to
//     any branch of any restaurant (subject to restaurant scope
//     already in their token).
//   - Restaurant staff with 'branch:view_all' (owner, manager): can
//     switch to any branch of their restaurant.
//   - Branch-scoped staff (waiter, kitchen_staff, cashier without
//     view_all): can switch ONLY to branches they have an active
//     StaffAssignment for. If they have no assignments, they are
//     stuck on their auth.branchId (their "home" branch from the
//     RestaurantUser record).
//   - Customers: cannot call this endpoint (their branch is bound
//     to the QR session they scanned).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, generateStaffToken, resolveUserPermissions, hasUserPermission, type TokenPayload } from '@/lib/auth'

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Customer tokens cannot switch branches — their branch is bound to
    // the QR session they scanned.
    if (decoded.type === 'customer') {
      return NextResponse.json(
        { error: 'Customers cannot switch branches — branch is bound to the QR session' },
        { status: 403 }
      )
    }

    const staffPayload = decoded as TokenPayload

    const body = await request.json()
    const { branchId } = body

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }

    const restaurantId = staffPayload.restaurantId
    if (!restaurantId) {
      return NextResponse.json(
        { error: 'No restaurant context in token — call /api/auth/switch-restaurant first' },
        { status: 400 }
      )
    }

    // ── Verify the branch exists and belongs to the user's restaurant ──
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId, isActive: true },
      select: { id: true, name: true, isMainBranch: true },
    })

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found, inactive, or does not belong to your restaurant' },
        { status: 404 }
      )
    }

    // ── Resolve the user's permissions to check branch:view_all ──
    // We need to re-fetch the user record because the token's permissions
    // may have been updated since issuance (rare, but possible).
    let canSwitchToAnyBranch = false

    if (staffPayload.role === 'super_admin' || staffPayload.role === 'support_admin') {
      // Platform admins can switch to any branch
      canSwitchToAnyBranch = true
    } else {
      // Restaurant staff: check if they have branch:view_all
      // First try the permissions already in the token (fast path)
      const tokenPermissions = staffPayload.permissions || []
      if (tokenPermissions.includes('branch:view_all')) {
        canSwitchToAnyBranch = true
      } else {
        // Re-fetch the user to get the latest permission overrides
        const userRecord = await db.restaurantUser.findFirst({
          where: { id: staffPayload.userId, restaurantId, isActive: true },
          select: {
            role: true,
            permissions: true,
            additionalPermissions: true,
            revokedPermissions: true,
          },
        })

        if (userRecord) {
          const effectivePerms = resolveUserPermissions(userRecord.role, {
            permissions: userRecord.permissions ? JSON.parse(userRecord.permissions) : undefined,
            additionalPermissions: userRecord.additionalPermissions ? JSON.parse(userRecord.additionalPermissions) : undefined,
            revokedPermissions: userRecord.revokedPermissions ? JSON.parse(userRecord.revokedPermissions) : undefined,
          })
          canSwitchToAnyBranch = effectivePerms.includes('branch:view_all')
        }
      }
    }

    // ── If the user lacks branch:view_all, check for an active StaffAssignment ──
    if (!canSwitchToAnyBranch) {
      const assignment = await db.staffAssignment.findFirst({
        where: {
          userId: staffPayload.userId,
          branchId,
          isActive: true,
        },
        select: { id: true },
      })

      if (!assignment) {
        return NextResponse.json(
          {
            error: 'You do not have access to this branch. Your role is scoped to branches where you have an active staff assignment.',
            branchId,
            yourBranchId: staffPayload.branchId,
          },
          { status: 403 }
        )
      }
    }

    // ── Re-issue the JWT with the new branchId ──
    const newTokenPayload: TokenPayload = {
      userId: staffPayload.userId,
      email: staffPayload.email,
      role: staffPayload.role,
      restaurantId,
      branchId,
      type: staffPayload.type,
      // Preserve admin impersonation context if present
      originalRole: staffPayload.originalRole,
      originalType: staffPayload.originalType,
      permissions: staffPayload.permissions || resolveUserPermissions(staffPayload.role),
    }

    const newToken = generateStaffToken(newTokenPayload)

    return NextResponse.json({
      message: 'Switched branch successfully',
      token: newToken,
      branch: {
        id: branch.id,
        name: branch.name,
        isMainBranch: branch.isMainBranch,
      },
    })
  } catch (error) {
    console.error('[SWITCH_BRANCH_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
