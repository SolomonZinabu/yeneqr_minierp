// ============================================================
// Yene QR — Ingredient Detail API (GET, PUT, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'

/**
 * GET /api/restaurants/[id]/ingredients/[ingredientId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ingredientId: string }> }
) {
  try {
    const { id, ingredientId } = await params

    const ingredient = await db.ingredient.findFirst({
      where: { id: ingredientId, restaurantId: id },
      include: {
        menuItems: {
          include: {
            menuItem: { select: { id: true, name: true, image: true } },
          },
        },
      },
    })

    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }

    return NextResponse.json({ data: ingredient })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INGREDIENT_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch ingredient' }, { status: 500 })
  }
}

/**
 * PUT /api/restaurants/[id]/ingredients/[ingredientId]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ingredientId: string }> }
) {
  try {
    const { id, ingredientId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', id)
    if (permErr) return permErr

    const existing = await db.ingredient.findFirst({
      where: { id: ingredientId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, nameAm, nameI18n, allergens, isAvailable, inventoryItemId, sortOrder } = body

    // If name is changing, check for duplicate
    if (name && name !== existing.name) {
      const dup = await db.ingredient.findFirst({
        where: { restaurantId: id, name, id: { not: ingredientId } },
      })
      if (dup) {
        return NextResponse.json(
          { error: 'An ingredient with this name already exists' },
          { status: 409 }
        )
      }
    }

    const ingredient = await db.ingredient.update({
      where: { id: ingredientId },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(nameI18n !== undefined && { nameI18n }),
        ...(allergens !== undefined && { allergens }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(inventoryItemId !== undefined && { inventoryItemId: inventoryItemId || null }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    // If ingredient availability was toggled, propagate to affected menu items
    if (isAvailable !== undefined && isAvailable !== existing.isAvailable) {
      const affectedMenuItems = await db.menuItemIngredient.findMany({
        where: {
          ingredientId,
          isDefault: true,
        },
        include: {
          menuItem: { select: { id: true, name: true, isAvailable: true } },
        },
      })

      if (isAvailable === false) {
        // Ingredient marked unavailable — mark affected menu items unavailable
        for (const mi of affectedMenuItems) {
          if (mi.menuItem.isAvailable) {
            await db.menuItem.update({
              where: { id: mi.menuItem.id },
              data: { isAvailable: false },
            })
            emitEvent({
              type: 'item_availability_changed',
              restaurantId: id,
              menuItemId: mi.menuItem.id,
              menuItemName: mi.menuItem.name,
              isAvailable: false,
              reason: 'ingredient_out_of_stock',
              ingredientId,
              ingredientName: existing.name,
            })
          }
        }
      } else {
        // Ingredient marked available — check if menu items can be re-enabled
        for (const mi of affectedMenuItems) {
          if (!mi.menuItem.isAvailable) {
            // Check if ALL required ingredients are now available
            const allRequiredIngredients = await db.menuItemIngredient.findMany({
              where: {
                menuItemId: mi.menuItem.id,
                isDefault: true,
              },
              include: {
                ingredient: { select: { isAvailable: true } },
              },
            })
            const allAvailable = allRequiredIngredients.every((r) => r.ingredient.isAvailable)
            if (allAvailable) {
              await db.menuItem.update({
                where: { id: mi.menuItem.id },
                data: { isAvailable: true },
              })
              emitEvent({
                type: 'item_availability_changed',
                restaurantId: id,
                menuItemId: mi.menuItem.id,
                menuItemName: mi.menuItem.name,
                isAvailable: true,
                reason: 'restocked',
                ingredientId,
                ingredientName: existing.name,
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ data: ingredient })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INGREDIENT_UPDATE]', error)
    return NextResponse.json({ error: 'Failed to update ingredient' }, { status: 500 })
  }
}

/**
 * DELETE /api/restaurants/[id]/ingredients/[ingredientId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ingredientId: string }> }
) {
  try {
    const { id, ingredientId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', id)
    if (permErr) return permErr

    const existing = await db.ingredient.findFirst({
      where: { id: ingredientId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }

    // Delete all join table entries first, then the ingredient
    await db.menuItemIngredient.deleteMany({
      where: { ingredientId },
    })
    await db.ingredient.delete({
      where: { id: ingredientId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INGREDIENT_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete ingredient' }, { status: 500 })
  }
}
