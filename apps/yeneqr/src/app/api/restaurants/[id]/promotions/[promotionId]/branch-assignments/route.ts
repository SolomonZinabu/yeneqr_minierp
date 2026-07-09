// ============================================================
// Yene QR — Promotion Branch Assignments API
// Phase 6.2: implements the Toast/Square pattern for per-branch promotion activation.
// ============================================================
// GET  /api/restaurants/[id]/promotions/[promotionId]/branch-assignments
//   Lists all branch assignments for a promotion.
//
// PUT  /api/restaurants/[id]/promotions/[promotionId]/branch-assignments
//   Upserts a branch assignment (activates a promotion at a branch).
//   Body: { branchId, isActive? }
//
// DELETE /api/restaurants/[id]/promotions/[promotionId]/branch-assignments?branchId=xxx
//   Removes a branch assignment.
//
// Semantics:
//   - Promotion with ZERO assignments = active at ALL branches (default)
//   - Promotion with assignments = active ONLY at those branches
//   - Assignment with isActive=false = paused at that branch (keeps the record)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id: restaurantId, promotionId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    // Verify the promotion belongs to this restaurant
    const promotion = await db.promotion.findFirst({
      where: { id: promotionId, restaurantId },
      select: { id: true, name: true, code: true, isActive: true },
    })
    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    const assignments = await db.promotionBranchAssignment.findMany({
      where: { promotionId },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { branch: { name: 'asc' } },
    })

    return NextResponse.json({
      data: assignments,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        code: promotion.code,
        isActive: promotion.isActive,
      },
      // Helpful hint for the UI: "active everywhere" when no assignments exist
      activeEverywhere: assignments.length === 0,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PROMOTION_BRANCH_ASSIGNMENTS_LIST]', error)
    return NextResponse.json({ error: 'Failed to fetch branch assignments' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id: restaurantId, promotionId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { branchId, isActive } = body as {
      branchId: string
      isActive?: boolean
    }

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    // Verify the promotion belongs to this restaurant
    const promotion = await db.promotion.findFirst({
      where: { id: promotionId, restaurantId },
      select: { id: true },
    })
    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // Verify the user has access to the target branch
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    // Upsert the assignment
    const assignment = await db.promotionBranchAssignment.upsert({
      where: {
        promotionId_branchId: { promotionId, branchId },
      },
      update: {
        ...(isActive !== undefined ? { isActive } : {}),
      },
      create: {
        promotionId,
        branchId,
        isActive: isActive ?? true,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: assignment })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PROMOTION_BRANCH_ASSIGNMENT_UPSERT]', error)
    return NextResponse.json({ error: 'Failed to save branch assignment' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id: restaurantId, promotionId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')

    if (!branchId) {
      return NextResponse.json({ error: 'branchId query param is required' }, { status: 400 })
    }

    // Verify the user has access to the target branch
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    await db.promotionBranchAssignment.deleteMany({
      where: { promotionId, branchId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PROMOTION_BRANCH_ASSIGNMENT_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete branch assignment' }, { status: 500 })
  }
}
