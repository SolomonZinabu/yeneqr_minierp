// ============================================================
// Yene QR — Branch Detail API (GET, PUT, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/branches/[branchId]
 * Get branch details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id, branchId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Non-admin staff can only view branches of their own restaurant
    if (auth && auth.type === 'staff') {
      const permErr = requirePerm(auth, 'branch:view', id)
      if (permErr) return permErr
    }

    const branch = await db.branch.findUnique({
      where: { id: branchId, restaurantId: id },
      include: {
        _count: {
          select: {
            tables: true,
            floors: true,
            kitchenStations: true,
            staffAssignments: true,
          },
        },
        floors: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            sortOrder: true,
            _count: { select: { tables: true } },
          },
        },
      },
    })

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: branch })
  } catch (error) {
    console.error('[BRANCH_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch branch' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/branches/[branchId]
 * Update branch details.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id, branchId } = await params
    const auth = requireAuth(request)

    // Must have branch:manage permission for this restaurant
    const permErr = requirePerm(auth, 'branch:manage', id)
    if (permErr) return permErr

    // Verify branch exists and belongs to this restaurant
    const existing = await db.branch.findUnique({
      where: { id: branchId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      name,
      nameAm,
      address,
      city,
      phone,
      latitude,
      longitude,
      workingHours,
      isMainBranch,
      isActive,
      settings,
    } = body

    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (nameAm !== undefined) updateData.nameAm = nameAm
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (phone !== undefined) updateData.phone = phone
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (workingHours !== undefined) updateData.workingHours = JSON.stringify(workingHours)
    if (isActive !== undefined) updateData.isActive = isActive
    if (settings !== undefined) updateData.settings = typeof settings === 'string' ? settings : JSON.stringify(settings)

    // Handle main branch toggle
    if (isMainBranch !== undefined) {
      if (isMainBranch && !existing.isMainBranch) {
        // Unset existing main branch
        await db.branch.updateMany({
          where: { restaurantId: id, isMainBranch: true },
          data: { isMainBranch: false },
        })
      }
      updateData.isMainBranch = isMainBranch
    }

    // ── Don't allow deactivating the main branch if other active branches exist ──
    if (isActive === false && existing.isActive && existing.isMainBranch) {
      const otherActiveBranches = await db.branch.count({
        where: {
          restaurantId: id,
          isActive: true,
          id: { not: branchId },
        },
      })
      if (otherActiveBranches > 0) {
        return NextResponse.json(
          { error: 'Cannot deactivate main branch. Please set another branch as main first.' },
          { status: 400 }
        )
      }
    }

    const updated = await db.branch.update({
      where: { id: branchId },
      data: updateData,
    })

    // ── Cascade branch active state to QR codes ──
    // When a branch is deactivated, its QR codes should also be deactivated
    // so scans are properly rejected. When reactivated, QR codes are also
    // reactivated (without changing signatures, so printed QRs keep working).
    if (isActive !== undefined && isActive !== existing.isActive) {
      if (!isActive) {
        // Deactivating branch → deactivate all its QR codes
        await db.qRCode.updateMany({
          where: { branchId: branchId, isActive: true },
          data: { isActive: false },
        })
      } else {
        // Reactivating branch → reactivate all its QR codes (preserving signatures)
        await db.qRCode.updateMany({
          where: { branchId: branchId, isActive: false },
          data: { isActive: true },
        })
      }
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update branch' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/branches/[branchId]
 * Soft delete — sets isActive = false.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id, branchId } = await params
    const auth = requireAuth(request)

    // Must have branch:manage permission for this restaurant
    const permErr = requirePerm(auth, 'branch:manage', id)
    if (permErr) return permErr

    const existing = await db.branch.findUnique({
      where: { id: branchId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: 'Branch is already inactive' },
        { status: 400 }
      )
    }

    // Don't allow deactivating the main branch if there are other active branches
    if (existing.isMainBranch) {
      const otherActiveBranches = await db.branch.count({
        where: {
          restaurantId: id,
          isActive: true,
          id: { not: branchId },
        },
      })
      if (otherActiveBranches > 0) {
        return NextResponse.json(
          { error: 'Cannot deactivate main branch. Please set another branch as main first.' },
          { status: 400 }
        )
      }
    }

    const updated = await db.branch.update({
      where: { id: branchId },
      data: { isActive: false },
    })

    // Cascade: deactivate all QR codes for this branch
    await db.qRCode.updateMany({
      where: { branchId: branchId, isActive: true },
      data: { isActive: false },
    })

    return NextResponse.json({ data: updated, message: 'Branch deactivated successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete branch' },
      { status: 500 }
    )
  }
}
