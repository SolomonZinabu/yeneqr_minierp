// ============================================================
// Yene QR — Floors API (List & Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/floors
 * List floors for a restaurant.
 * Query params: branchId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Non-admin staff can only view floors of their own restaurant
    if (auth && auth.type === 'staff') {
      const permErr = requirePerm(auth, 'table:view', id)
      if (permErr) return permErr
    }

    // Verify restaurant exists
    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId') || undefined

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId query parameter is required' },
        { status: 400 }
      )
    }

    // Verify branch belongs to this restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId: id },
    })
    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Verify branch access — branch-scoped staff can only view floors at their branch
    if (auth && auth.type === 'staff') {
      const branchErr = verifyBranchAccess(auth, branchId, id)
      if (branchErr) return branchErr
    }

    const floors = await db.floor.findMany({
      where: { branchId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { tables: true },
        },
      },
    })

    return NextResponse.json({ data: floors })
  } catch (error) {
    console.error('[FLOORS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch floors' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/floors
 * Create a new floor for a branch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    // Must have table:manage permission for this restaurant
    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    // Verify restaurant exists and is active
    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }
    if (!restaurant.isActive) {
      return NextResponse.json(
        { error: 'Cannot add floors to an inactive restaurant' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { branchId, name, sortOrder } = body

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }
    if (!name) {
      return NextResponse.json(
        { error: 'Floor name is required' },
        { status: 400 }
      )
    }

    // Verify branch belongs to this restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId: id, isActive: true },
    })
    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found or inactive' },
        { status: 404 }
      )
    }

    // Verify branch access — branch-scoped staff can only create floors at their branch
    const branchErr = verifyBranchAccess(auth, branchId, id)
    if (branchErr) return branchErr

    // Check for duplicate floor name in the same branch
    const existing = await db.floor.findFirst({
      where: { branchId, name },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Floor name already exists in this branch' },
        { status: 409 }
      )
    }

    const floor = await db.floor.create({
      data: {
        branchId,
        name,
        sortOrder: sortOrder ?? 0,
      },
      include: {
        _count: {
          select: { tables: true },
        },
      },
    })

    return NextResponse.json({ data: floor }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[FLOOR_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create floor' },
      { status: 500 }
    )
  }
}
