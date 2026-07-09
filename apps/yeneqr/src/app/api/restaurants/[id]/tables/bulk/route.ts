// ============================================================
// Yene QR — Tables Bulk API (Batch position/status update)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'

/**
 * PATCH /api/restaurants/[id]/tables/bulk
 * Batch update table positions and/or properties.
 *
 * Body: {
 *   branchId: string,  // REQUIRED — all tables in `updates` must belong to this branch
 *   updates: [{ id, positionX?, positionY?, width?, height?, rotation?, floorId?, status? }]
 * }
 *
 * SECURITY (Phase 2.4): Previously this route only verified that each table's
 * branch belonged to the restaurant — but did NOT check that the user had
 * access to that branch. A branch-A user could include branch-B table IDs in
 * the `updates` array and mutate their positions, statuses, floor assignments,
 * capacities, etc. Now requires an explicit `branchId` in the body and
 * verifies the user has access to it via verifyBranchAccess. Each table is
 * then verified to belong to that specific branch.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    const body = await request.json()
    const { branchId, updates } = body

    // ── Require explicit branchId (Phase 2.4) ──
    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required for bulk table updates' },
        { status: 400 }
      )
    }

    // ── Verify the user has access to this branch ──
    const branchErr = verifyBranchAccess(auth, branchId, id)
    if (branchErr) return branchErr

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 })
    }

    if (updates.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 updates per request' }, { status: 400 })
    }

    const results = []

    for (const update of updates) {
      const { id: tableId, positionX, positionY, width, height, rotation, floorId, status, shape, capacity, number, notes } = update

      if (!tableId) continue

      // Verify table belongs to this branch (was: only checked branch.restaurantId === id,
      // which allowed cross-branch mutation within the same restaurant)
      const existing = await db.table.findFirst({
        where: { id: tableId, branchId },
      })
      if (!existing) continue

      const updateData: Record<string, unknown> = {}
      if (positionX !== undefined) updateData.positionX = positionX
      if (positionY !== undefined) updateData.positionY = positionY
      if (width !== undefined) updateData.width = width
      if (height !== undefined) updateData.height = height
      if (rotation !== undefined) updateData.rotation = rotation
      if (floorId !== undefined) updateData.floorId = floorId || null
      if (status !== undefined) updateData.status = status
      if (shape !== undefined) updateData.shape = shape
      if (capacity !== undefined) updateData.capacity = capacity
      if (number !== undefined) updateData.number = number
      if (notes !== undefined) updateData.notes = notes || null

      try {
        const updated = await db.table.update({
          where: { id: tableId },
          data: updateData,
          include: {
            floor: { select: { id: true, name: true, sortOrder: true } },
            qrCode: { select: { id: true, type: true, isActive: true } },
          },
        })
        results.push(updated)
      } catch {
        results.push({ id: tableId, error: 'Failed to update' })
      }
    }

    return NextResponse.json({ data: results, updated: results.length })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[TABLES_BULK]', error)
    return NextResponse.json({ error: 'Failed to bulk update tables' }, { status: 500 })
  }
}
