// ============================================================
// Yene QR — Table Detail API (GET, PUT, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/tables/[tableId]
 * Get table details with QR code info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  try {
    const { id, tableId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Non-admin staff can only view tables of their own restaurant
    if (auth && auth.type === 'staff') {
      const permErr = requirePerm(auth, 'table:view', id)
      if (permErr) return permErr
    }

    const table = await db.table.findFirst({
      where: { id: tableId, branch: { restaurantId: id } },
      include: {
        floor: {
          select: { id: true, name: true, sortOrder: true },
        },
        qrCode: true,
        branch: {
          select: { id: true, name: true, isMainBranch: true },
        },
        _count: {
          select: { orders: true, sessions: true },
        },
      },
    })

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // Verify branch access — branch-scoped staff can only view tables at their branch
    if (auth && auth.type === 'staff') {
      const branchErr = verifyBranchAccess(auth, table.branchId, id)
      if (branchErr) return branchErr
    }

    return NextResponse.json({ data: table })
  } catch (error) {
    console.error('[TABLE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch table' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/tables/[tableId]
 * Update table details.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  try {
    const { id, tableId } = await params
    const auth = requireAuth(request)

    // Must have table:manage permission for this restaurant
    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    // Verify table exists and belongs to this restaurant
    const existing = await db.table.findFirst({
      where: { id: tableId, branch: { restaurantId: id } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // Verify branch access — a manager at Branch A cannot edit/delete tables
    // at Branch B (even with table:manage permission).
    const branchErr = verifyBranchAccess(auth, existing.branchId, id)
    if (branchErr) return branchErr

    const body = await request.json()
    const {
      number,
      capacity,
      status,
      positionX,
      positionY,
      width,
      height,
      rotation,
      floorId,
      shape,
      notes,
      menuId,
    } = body

    // Check for duplicate table number if changing number
    if (number && number !== existing.number) {
      const duplicate = await db.table.findFirst({
        where: {
          branchId: existing.branchId,
          number,
          isActive: true,
          id: { not: tableId },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Table number already exists in this branch' },
          { status: 409 }
        )
      }
    }

    // Verify floor belongs to the same branch if changing floor
    if (floorId !== undefined && floorId !== null) {
      const floor = await db.floor.findFirst({
        where: { id: floorId, branchId: existing.branchId },
      })
      if (!floor) {
        return NextResponse.json(
          { error: 'Floor not found in this branch' },
          { status: 404 }
        )
      }
    }

    // Validate status transition
    const validStatuses = ['available', 'occupied', 'reserved', 'cleaning']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (number !== undefined) updateData.number = number
    if (capacity !== undefined) updateData.capacity = capacity
    if (status !== undefined) updateData.status = status
    if (positionX !== undefined) updateData.positionX = positionX
    if (positionY !== undefined) updateData.positionY = positionY
    if (width !== undefined) updateData.width = width
    if (height !== undefined) updateData.height = height
    if (rotation !== undefined) updateData.rotation = rotation
    if (floorId !== undefined) updateData.floorId = floorId || null
    if (shape !== undefined) updateData.shape = shape
    if (notes !== undefined) updateData.notes = notes || null
    if (menuId !== undefined) updateData.menuId = menuId || null

    const updated = await db.table.update({
      where: { id: tableId },
      data: updateData,
      include: {
        floor: {
          select: { id: true, name: true, sortOrder: true },
        },
        qrCode: {
          select: { id: true, type: true, isActive: true },
        },
        menu: {
          select: { id: true, name: true, nameAm: true, isActive: true },
        },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[TABLE_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update table' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/tables/[tableId]
 * Soft delete a table (sets isActive = false).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  try {
    const { id, tableId } = await params
    const auth = requireAuth(request)

    // Must have table:manage permission for this restaurant
    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    const existing = await db.table.findFirst({
      where: { id: tableId, branch: { restaurantId: id } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: 'Table is already inactive' },
        { status: 400 }
      )
    }

    // Prevent deleting occupied tables
    if (existing.status === 'occupied') {
      return NextResponse.json(
        { error: 'Cannot delete an occupied table' },
        { status: 400 }
      )
    }

    const updated = await db.table.update({
      where: { id: tableId },
      data: { isActive: false, status: 'available' },
    })

    return NextResponse.json({
      data: updated,
      message: 'Table deactivated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[TABLE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete table' },
      { status: 500 }
    )
  }
}
