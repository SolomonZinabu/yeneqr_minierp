// ============================================================
// Yene QR — Menu Item Branch Overrides API
// Phase 6.1: implements the Toast LSP (Location-Specific Pricing) pattern.
// ============================================================
// GET  /api/restaurants/[id]/items/[itemId]/branch-overrides
//   Lists all branch overrides for a menu item.
//
// PUT  /api/restaurants/[id]/items/[itemId]/branch-overrides
//   Upserts a branch override (creates or updates).
//   Body: { branchId, priceCents?, isAvailable?, notes? }
//
// DELETE /api/restaurants/[id]/items/[itemId]/branch-overrides?branchId=xxx
//   Removes a branch override (revert to inheriting restaurant defaults).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    // Verify the menu item belongs to this restaurant
    const menuItem = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
      select: { id: true, name: true, priceCents: true, isAvailable: true },
    })
    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    const overrides = await db.menuItemBranchOverride.findMany({
      where: { menuItemId: itemId },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { branch: { name: 'asc' } },
    })

    return NextResponse.json({
      data: overrides,
      menuItem: {
        id: menuItem.id,
        name: menuItem.name,
        basePriceCents: menuItem.priceCents,
        baseIsAvailable: menuItem.isAvailable,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_OVERRIDES_LIST]', error)
    return NextResponse.json({ error: 'Failed to fetch branch overrides' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { branchId, priceCents, isAvailable, notes } = body as {
      branchId: string
      priceCents?: number | null
      isAvailable?: boolean
      notes?: string | null
    }

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    // Verify the menu item belongs to this restaurant
    const menuItem = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
      select: { id: true },
    })
    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // Verify the user has access to the target branch
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    // Validate priceCents if provided
    if (priceCents !== null && priceCents !== undefined) {
      if (typeof priceCents !== 'number' || priceCents < 0 || !Number.isInteger(priceCents)) {
        return NextResponse.json(
          { error: 'priceCents must be a non-negative integer (in cents)' },
          { status: 400 }
        )
      }
    }

    // Upsert the override (one row per menuItemId + branchId)
    const override = await db.menuItemBranchOverride.upsert({
      where: {
        menuItemId_branchId: { menuItemId: itemId, branchId },
      },
      update: {
        ...(priceCents !== undefined ? { priceCents: priceCents ?? null } : {}),
        ...(isAvailable !== undefined ? { isAvailable } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
      create: {
        menuItemId: itemId,
        branchId,
        priceCents: priceCents ?? null,
        isAvailable: isAvailable ?? true,
        notes: notes || null,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: override })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_OVERRIDE_UPSERT]', error)
    return NextResponse.json({ error: 'Failed to save branch override' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
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

    await db.menuItemBranchOverride.deleteMany({
      where: { menuItemId: itemId, branchId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_OVERRIDE_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete branch override' }, { status: 500 })
  }
}
