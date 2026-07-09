// ============================================================
// Yene QR — Kitchen Stations API (List, Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/kitchen-stations
 * List kitchen stations for a restaurant.
 * Optional query params: branchId (filter by branch), isActive (filter by active status)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require kitchen:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'kitchen:manage', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const isActive = searchParams.get('isActive')

    // Build where clause — KitchenStation is on Branch, so we need to
    // filter branches belonging to this restaurant
    const branchWhere: Record<string, unknown> = { restaurantId }
    if (branchId) branchWhere.id = branchId

    const where: Record<string, unknown> = {}
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'
    if (branchId) where.branchId = branchId

    const stations = await db.kitchenStation.findMany({
      where: {
        ...where,
        branch: { restaurantId },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        branchId: true,
        name: true,
        nameI18n: true,
        type: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ data: stations })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[KITCHEN_STATIONS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch kitchen stations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/kitchen-stations
 * Create a kitchen station.
 * Body: { name, type?, branchId, sortOrder?, isActive? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require kitchen:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'kitchen:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { name, type = 'general', branchId, sortOrder = 0, isActive = true } = body as {
      name: string
      type?: string
      branchId: string
      sortOrder?: number
      isActive?: boolean
    }

    if (!name || !branchId) {
      return NextResponse.json(
        { error: 'name and branchId are required' },
        { status: 400 }
      )
    }

    // Validate branchId belongs to this restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId },
    })
    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 400 }
      )
    }

    const station = await db.kitchenStation.create({
      data: {
        branchId,
        name,
        type,
        sortOrder,
        isActive,
      },
      select: {
        id: true,
        branchId: true,
        name: true,
        nameI18n: true,
        type: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ data: station }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[KITCHEN_STATIONS_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create kitchen station' },
      { status: 500 }
    )
  }
}
