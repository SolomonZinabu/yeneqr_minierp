// ============================================================
// Yene QR — Floor Detail API (GET, PUT, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/floors/[floorId]
 * Get floor details with tables.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; floorId: string }> }
) {
  try {
    const { id, floorId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (auth && auth.type === 'staff') {
      const permErr = requirePerm(auth, 'table:view', id)
      if (permErr) return permErr
    }

    const floor = await db.floor.findFirst({
      where: { id: floorId, branch: { restaurantId: id } },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: [{ number: 'asc' }],
          include: {
            floor: { select: { id: true, name: true, sortOrder: true } },
            qrCode: { select: { id: true, type: true, isActive: true } },
            _count: { select: { orders: true, sessions: true } },
          },
        },
        _count: { select: { tables: true } },
      },
    })

    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 })
    }

    // Verify branch access — branch-scoped staff can only view floors at their branch
    if (auth && auth.type === 'staff') {
      const branchErr = verifyBranchAccess(auth, floor.branchId, id)
      if (branchErr) return branchErr
    }

    return NextResponse.json({ data: floor })
  } catch (error) {
    console.error('[FLOOR_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch floor' }, { status: 500 })
  }
}

/**
 * PUT /api/restaurants/[id]/floors/[floorId]
 * Update floor details (name, sortOrder, dimensions, walls, obstacles).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; floorId: string }> }
) {
  try {
    const { id, floorId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    const existing = await db.floor.findFirst({
      where: { id: floorId, branch: { restaurantId: id } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 })
    }

    // Verify branch access
    const branchErr = verifyBranchAccess(auth, existing.branchId, id)
    if (branchErr) return branchErr

    const body = await request.json()
    const { name, sortOrder, width, height, walls, obstacles } = body

    // Check for duplicate name if renaming
    if (name && name !== existing.name) {
      const dup = await db.floor.findFirst({
        where: { branchId: existing.branchId, name, id: { not: floorId } },
      })
      if (dup) {
        return NextResponse.json({ error: 'Floor name already exists in this branch' }, { status: 409 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (width !== undefined) updateData.width = width
    if (height !== undefined) updateData.height = height
    if (walls !== undefined) updateData.walls = walls ? JSON.stringify(walls) : null
    if (obstacles !== undefined) updateData.obstacles = obstacles ? JSON.stringify(obstacles) : null

    const updated = await db.floor.update({
      where: { id: floorId },
      data: updateData,
      include: {
        _count: { select: { tables: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[FLOOR_UPDATE]', error)
    return NextResponse.json({ error: 'Failed to update floor' }, { status: 500 })
  }
}

/**
 * DELETE /api/restaurants/[id]/floors/[floorId]
 * Delete a floor (unassigns tables by setting floorId to null).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; floorId: string }> }
) {
  try {
    const { id, floorId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    const existing = await db.floor.findFirst({
      where: { id: floorId, branch: { restaurantId: id } },
      include: { _count: { select: { tables: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 })
    }

    // Unassign all tables from this floor
    await db.table.updateMany({
      where: { floorId },
      data: { floorId: null },
    })

    // Delete the floor
    await db.floor.delete({ where: { id: floorId } })

    return NextResponse.json({ message: 'Floor deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[FLOOR_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete floor' }, { status: 500 })
  }
}
