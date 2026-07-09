// ============================================================
// Yene QR — Ingredients API (List & Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/ingredients
 * List all ingredients for a restaurant.
 * Query params: isAvailable, search
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { searchParams } = new URL(request.url)
    const isAvailable = searchParams.get('isAvailable')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = { restaurantId: id }
    if (isAvailable !== null) where.isAvailable = isAvailable === 'true'
    if (search) where.name = { contains: search }

    const ingredients = await db.ingredient.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        menuItems: {
          select: {
            id: true,
            isRemovable: true,
            isDefault: true,
            menuItemId: true,
            menuItem: { select: { id: true, name: true } },
          },
        },
        inventoryItem: {
          select: { id: true, name: true, currentStock: true, unit: true },
        },
      },
    })

    return NextResponse.json({ data: ingredients })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INGREDIENTS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch ingredients' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/ingredients
 * Create a new ingredient.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', id)
    if (permErr) return permErr

    const body = await request.json()
    const { name, nameAm, nameI18n, allergens, isAvailable, inventoryItemId, sortOrder } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Ingredient name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existing = await db.ingredient.findFirst({
      where: { restaurantId: id, name },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'An ingredient with this name already exists' },
        { status: 409 }
      )
    }

    const ingredient = await db.ingredient.create({
      data: {
        restaurantId: id,
        name,
        nameAm: nameAm || null,
        nameI18n: nameI18n || null,
        allergens: allergens || null,
        isAvailable: isAvailable !== false,
        inventoryItemId: inventoryItemId || null,
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({ data: ingredient }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INGREDIENT_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create ingredient' },
      { status: 500 }
    )
  }
}
