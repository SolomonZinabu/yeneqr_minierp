// ============================================================
// Yene QR — Branches API (List & Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm } from '@/lib/api-auth'
import { checkLimit, limitCheckErrorResponse } from '@/lib/subscription-limits'

/**
 * GET /api/restaurants/[id]/branches
 * List branches for a restaurant.
 * Query params: includeInactive, page, limit
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

    // Non-admin staff can only view branches of their own restaurant
    if (auth && auth.type === 'staff') {
      const permErr = requirePerm(auth, 'branch:view', id)
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
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = { restaurantId: id }
    if (!includeInactive) {
      where.isActive = true
    }

    const [branches, total] = await Promise.all([
      db.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isMainBranch: 'desc' }, { name: 'asc' }],
        include: {
          _count: {
            select: { tables: true, floors: true, kitchenStations: true, qrCodes: true },
          },
        },
      }),
      db.branch.count({ where }),
    ])

    return NextResponse.json({
      data: branches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[BRANCHES_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/branches
 * Create a new branch for a restaurant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    // Must have branch:manage permission for this restaurant
    const permErr = requirePerm(auth, 'branch:manage', id)
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
        { error: 'Cannot add branches to an inactive restaurant' },
        { status: 400 }
      )
    }

    // ── Subscription Limit Check ──────────────────────
    const limitCheck = await checkLimit(id, 'branches')
    if (!limitCheck.allowed) {
      return NextResponse.json(limitCheckErrorResponse(limitCheck), { status: 403 })
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
      settings,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Branch name is required' },
        { status: 400 }
      )
    }

    // If setting as main branch, unset any existing main branch
    if (isMainBranch) {
      await db.branch.updateMany({
        where: { restaurantId: id, isMainBranch: true },
        data: { isMainBranch: false },
      })
    }

    const branch = await db.branch.create({
      data: {
        restaurantId: id,
        name,
        nameAm: nameAm || null,
        address: address || null,
        city: city || null,
        phone: phone || null,
        latitude: latitude || null,
        longitude: longitude || null,
        workingHours: workingHours ? JSON.stringify(workingHours) : null,
        isMainBranch: isMainBranch ?? false,
        settings: settings ? (typeof settings === 'string' ? settings : JSON.stringify(settings)) : null,
      },
    })

    return NextResponse.json({ data: branch }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create branch' },
      { status: 500 }
    )
  }
}
