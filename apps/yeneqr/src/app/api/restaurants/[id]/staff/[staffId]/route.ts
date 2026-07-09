// ============================================================
// Yene QR — Staff Detail API (GET, PUT, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { logRoleChange } from '@/lib/audit-log'

/**
 * GET /api/restaurants/[id]/staff/[staffId]
 * Get staff member details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const { id: restaurantId, staffId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'staff:view', restaurantId)
    if (permErr) return permErr

    const staff = await db.restaurantUser.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        permissions: true,
        additionalPermissions: true,
        revokedPermissions: true,
        isActive: true,
        branchId: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        restaurant: {
          select: { id: true, name: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        staffAssignments: {
          where: { isActive: true },
          include: {
            branch: { select: { id: true, name: true } },
            kitchenStation: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    if (staff.restaurant.id !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ data: staff })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STAFF_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff member' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/staff/[staffId]
 * Update staff member (name, role, isActive).
 * Body: { name?, role?, isActive?, branchId?, phone?, avatar? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const { id: restaurantId, staffId } = await params
    const auth = requireAuth(request)

    // Must have staff:manage permission for this restaurant
    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    const staff = await db.restaurantUser.findUnique({
      where: { id: staffId },
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    if (staff.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, role, isActive, branchId, phone, avatar, permissions, additionalPermissions, revokedPermissions } = body as {
      name?: string
      role?: string
      isActive?: boolean
      branchId?: string | null
      phone?: string | null
      avatar?: string | null
      permissions?: string[] | null
      additionalPermissions?: string[] | null
      revokedPermissions?: string[] | null
    }

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (avatar !== undefined) updateData.avatar = avatar
    if (branchId !== undefined) updateData.branchId = branchId
    if (isActive !== undefined) updateData.isActive = isActive
    if (permissions !== undefined) updateData.permissions = permissions ? JSON.stringify(permissions) : null
    if (additionalPermissions !== undefined) updateData.additionalPermissions = additionalPermissions ? JSON.stringify(additionalPermissions) : null
    if (revokedPermissions !== undefined) updateData.revokedPermissions = revokedPermissions ? JSON.stringify(revokedPermissions) : null

    if (role !== undefined) {
      const validRoles = ['owner', 'manager', 'cashier', 'waiter', 'kitchen_staff']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }

      // Only super_admin can assign owner role
      if (role === 'owner' && auth.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Only super admins can assign the owner role' },
          { status: 403 }
        )
      }

      // Cannot demote the last owner
      if (staff.role === 'owner' && role !== 'owner') {
        const ownerCount = await db.restaurantUser.count({
          where: { restaurantId, role: 'owner', isActive: true },
        })
        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last owner of the restaurant' },
            { status: 400 }
          )
        }
      }

      updateData.role = role
    }

    const updated = await db.restaurantUser.update({
      where: { id: staffId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        permissions: true,
        additionalPermissions: true,
        revokedPermissions: true,
        isActive: true,
        branchId: true,
        updatedAt: true,
        branch: {
          select: { id: true, name: true },
        },
      },
    })

    // ── Audit Log for role change ──
    if (role !== undefined && role !== staff.role) {
      logRoleChange({
        restaurantId,
        userId: auth.userId,
        performedByType: auth.type,
        staffId,
        staffName: staff.name,
        previousRole: staff.role,
        newRole: role,
      }).catch((err) => console.error('[AUDIT_ROLE_CHANGE]', err))
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STAFF_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update staff member' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/staff/[staffId]
 * Deactivate a staff member (soft delete).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const { id: restaurantId, staffId } = await params
    const auth = requireAuth(request)

    // Must have staff:manage permission for this restaurant
    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    const staff = await db.restaurantUser.findUnique({
      where: { id: staffId },
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    if (staff.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!staff.isActive) {
      return NextResponse.json(
        { error: 'Staff member is already deactivated' },
        { status: 400 }
      )
    }

    // Cannot deactivate the last owner
    if (staff.role === 'owner') {
      const ownerCount = await db.restaurantUser.count({
        where: { restaurantId, role: 'owner', isActive: true },
      })
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot deactivate the last owner of the restaurant' },
          { status: 400 }
        )
      }
    }

    const updated = await db.restaurantUser.update({
      where: { id: staffId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    })

    return NextResponse.json({
      data: updated,
      message: 'Staff member deactivated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STAFF_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate staff member' },
      { status: 500 }
    )
  }
}
