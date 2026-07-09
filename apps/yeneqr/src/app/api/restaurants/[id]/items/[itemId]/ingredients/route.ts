// ============================================================
// Yene QR — Menu Item Ingredients API (Link/Unlink ingredients)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/items/[itemId]/ingredients
 * List ingredients linked to a menu item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params

    const item = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const menuItemIngredients = await db.menuItemIngredient.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: 'asc' },
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            nameAm: true,
            nameI18n: true,
            allergens: true,
            isAvailable: true,
          },
        },
      },
    })

    return NextResponse.json({ data: menuItemIngredients })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ITEM_INGREDIENTS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch item ingredients' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/items/[itemId]/ingredients
 * Replace all ingredient links for a menu item.
 * Body: { ingredients: [{ ingredientId, isRemovable, isDefault, portion, extraPrice, sortOrder }] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const item = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const { ingredients } = body

    if (!Array.isArray(ingredients)) {
      return NextResponse.json(
        { error: 'ingredients must be an array' },
        { status: 400 }
      )
    }

    // Validate all ingredient IDs exist and belong to this restaurant
    for (const ing of ingredients) {
      if (!ing.ingredientId) {
        return NextResponse.json(
          { error: 'Each ingredient must have an ingredientId' },
          { status: 400 }
        )
      }
      const exists = await db.ingredient.findFirst({
        where: { id: ing.ingredientId, restaurantId },
      })
      if (!exists) {
        return NextResponse.json(
          { error: `Ingredient ${ing.ingredientId} not found` },
          { status: 400 }
        )
      }
    }

    // Replace all links in a transaction
    const result = await db.$transaction(async (tx) => {
      // Delete existing links
      await tx.menuItemIngredient.deleteMany({
        where: { menuItemId: itemId },
      })

      // Create new links
      if (ingredients.length > 0) {
        await tx.menuItemIngredient.createMany({
          data: ingredients.map((ing: {
            ingredientId: string
            isRemovable?: boolean
            isDefault?: boolean
            portion?: string
            extraPrice?: number
            sortOrder?: number
          }) => ({
            menuItemId: itemId,
            ingredientId: ing.ingredientId,
            isRemovable: ing.isRemovable !== false,
            isDefault: ing.isDefault !== false,
            portion: ing.portion || null,
            extraPrice: ing.extraPrice || 0,
            sortOrder: ing.sortOrder || 0,
          })),
        })
      }

      // Also update the legacy ingredients field for backward compat
      const allIngredientNames = ingredients.length > 0
        ? JSON.stringify(ingredients.map((ing: { ingredientId: string }) => {
            // We'll get names after transaction
            return ing.ingredientId
          }))
        : null

      return ingredients
    })

    // Fetch the actual ingredient names to update the legacy field
    const linkedIngredients = await db.menuItemIngredient.findMany({
      where: { menuItemId: itemId },
      include: { ingredient: { select: { name: true, nameAm: true } } },
      orderBy: { sortOrder: 'asc' },
    })

    // Update legacy ingredients field
    const names = linkedIngredients
      .filter((li) => li.isDefault)
      .map((li) => li.ingredient.name)
    const namesAm = linkedIngredients
      .filter((li) => li.isDefault && li.ingredient.nameAm)
      .map((li) => li.ingredient.nameAm)

    await db.menuItem.update({
      where: { id: itemId },
      data: {
        ingredients: names.length > 0 ? JSON.stringify(names) : null,
        ingredientsI18n: namesAm.length > 0 ? JSON.stringify({ am: namesAm }) : null,
      },
    })

    return NextResponse.json({ data: linkedIngredients })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ITEM_INGREDIENTS_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update item ingredients' },
      { status: 500 }
    )
  }
}
