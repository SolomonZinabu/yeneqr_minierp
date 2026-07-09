// ============================================================
// Yene QR — Tables API (List & Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { checkLimit, limitCheckErrorResponse } from '@/lib/subscription-limits'

/**
 * GET /api/restaurants/[id]/tables
 * List tables for a restaurant.
 * Query params: branchId, status, page, limit
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

    // Non-admin staff can only view tables of their own restaurant
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
    // SECURITY (Phase 2.3): resolveBranchScope forces auth.branchId for
    // branch-scoped roles (waiter, kitchen_staff, cashier) and customers,
    // ignoring client-supplied branchId. Owners/managers (branch:view_all)
    // and platform admins can filter or view all branches.
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      branch: { restaurantId: id },
      isActive: true,
    }
    if (branchId) {
      where.branchId = branchId
    }
    if (status) {
      where.status = status
    }

    const [tables, total] = await Promise.all([
      db.table.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ number: 'asc' }],
        include: {
          floor: {
            select: { id: true, name: true, sortOrder: true },
          },
          branch: {
            select: { id: true, name: true },
          },
          qrCode: {
            select: { id: true, type: true, isActive: true },
          },
          menu: {
            select: { id: true, name: true, nameAm: true, isActive: true },
          },
          _count: {
            select: { orders: true, sessions: true },
          },
        },
      }),
      db.table.count({ where }),
    ])

    return NextResponse.json({
      data: tables,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[TABLES_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/tables
 * Create a new table for a restaurant.
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
        { error: 'Cannot add tables to an inactive restaurant' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      branchId,
      number,
      capacity,
      floorId,
      positionX,
      positionY,
      width,
      height,
      rotation,
      shape,
      notes,
      status,
      menuId,
    } = body

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }
    if (!number) {
      return NextResponse.json(
        { error: 'Table number is required' },
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

    // Verify floor belongs to the branch if specified
    if (floorId) {
      const floor = await db.floor.findFirst({
        where: { id: floorId, branchId },
      })
      if (!floor) {
        return NextResponse.json(
          { error: 'Floor not found in this branch' },
          { status: 404 }
        )
      }
    }

    // ── Subscription Limit Check ──────────────────────
    const limitCheck = await checkLimit(id, 'tables')
    if (!limitCheck.allowed) {
      return NextResponse.json(limitCheckErrorResponse(limitCheck), { status: 403 })
    }

    // Check for duplicate table number in the same branch
    const existing = await db.table.findFirst({
      where: { branchId, number, isActive: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Table number already exists in this branch' },
        { status: 409 }
      )
    }

    const table = await db.table.create({
      data: {
        branchId,
        floorId: floorId || null,
        number,
        capacity: capacity || 4,
        positionX: positionX ?? null,
        positionY: positionY ?? null,
        width: width || 80,
        height: height || 80,
        rotation: rotation || 0,
        shape: shape || 'round',
        notes: notes || null,
        status: status || 'available',
        menuId: menuId || null,
      },
      include: {
        floor: {
          select: { id: true, name: true, sortOrder: true },
        },
      },
    })

    return NextResponse.json({ data: table }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[TABLE_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create table' },
      { status: 500 }
    )
  }
}
