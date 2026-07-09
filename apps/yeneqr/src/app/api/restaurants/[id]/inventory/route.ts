// ============================================================
// Yene QR — Inventory API (List, Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/inventory
 * List inventory items for a restaurant with optional filters.
 * Query params: status (all/low/out), search, isActive, page, limit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all' // all, low, out
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const search = searchParams.get('search') || ''
    const isActiveParam = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId }

    if (branchId) where.branchId = branchId

    if (isActiveParam !== null) {
      where.isActive = isActiveParam === 'true'
    } else {
      where.isActive = true
    }

    if (search) {
      where.name = { contains: search }
    }

    // Status filter requires post-fetch filtering since it depends on comparing currentStock to minimumStock
    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          ingredients: {
            select: {
              id: true,
              name: true,
              isAvailable: true,
            },
          },
        },
      }),
      db.inventoryItem.count({ where }),
    ])

    // Apply status filter
    let filtered = items
    if (status === 'low') {
      filtered = items.filter(
        (item) => item.currentStock > 0 && item.currentStock <= item.minimumStock
      )
    } else if (status === 'out') {
      filtered = items.filter((item) => item.currentStock === 0)
    }

    return NextResponse.json({
      data: filtered,
      pagination: {
        page,
        limit,
        total: status === 'all' ? total : filtered.length,
        totalPages: Math.ceil((status === 'all' ? total : filtered.length) / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVENTORY_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory items' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/inventory
 * Create a new inventory item.
 * Body: { name, unit, currentStock, minimumStock, costPerUnit, supplier }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { name, unit, currentStock, minimumStock, costPerUnit, supplier, branchId } = body as {
      name: string
      unit?: string
      currentStock?: number
      minimumStock?: number
      costPerUnit?: number
      supplier?: string
      branchId?: string
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Item name is required' },
        { status: 400 }
      )
    }

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
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

    // Check for duplicate name within this branch
    const existing = await db.inventoryItem.findUnique({
      where: {
        restaurantId_branchId_name: { restaurantId, branchId, name: name.trim() },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An inventory item with this name already exists' },
        { status: 409 }
      )
    }

    const item = await db.inventoryItem.create({
      data: {
        restaurantId,
        branchId,
        name: name.trim(),
        unit: unit || 'pcs',
        currentStock: currentStock ?? 0,
        minimumStock: minimumStock ?? 0,
        costPerUnit: costPerUnit ?? 0,
        supplier: supplier || null,
        lastRestocked: currentStock && currentStock > 0 ? new Date() : null,
      },
    })

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVENTORY_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create inventory item' },
      { status: 500 }
    )
  }
}
