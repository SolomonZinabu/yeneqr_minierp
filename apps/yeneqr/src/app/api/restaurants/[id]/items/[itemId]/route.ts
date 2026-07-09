import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/items/[itemId] — Get item with modifiers, addons, translations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params

    const item = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameAm: true,
            nameI18n: true,
            menuId: true,
          },
        },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        addonItems: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                nameAm: true,
                nameI18n: true,
                priceCents: true,
                image: true,
              },
            },
          },
        },
        translations: true,
        comboItems: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                nameAm: true,
                nameI18n: true,
                priceCents: true,
                image: true,
              },
            },
            includedItem: {
              select: {
                id: true,
                name: true,
                nameAm: true,
                nameI18n: true,
                priceCents: true,
                image: true,
              },
            },
          },
        },
        menuItemIngredients: {
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
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('[ITEM_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

// PUT /api/restaurants/[id]/items/[itemId] — Update item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Auth check — only authorized staff/admin can update items
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()

    const existing = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const {
      categoryId,
      name,
      nameAm,
      description,
      descriptionAm,
      image,
      images,
      price: bodyPrice,
      priceCents: bodyPriceCents,
      originalPrice,
      originalPriceCents: bodyOriginalPriceCents,
      preparationTime,
      calories,
      isAvailable,
      isPopular,
      isVegetarian,
      isSpicy,
      showServingSize,
      availabilityType,
      availabilitySchedule,
      availableFrom,
      availableTo,
      availableDays,
      sortOrder,
      ingredients,
      ingredientsI18n,
    } = body

    // Accept price in either 'priceCents' (preferred, from frontend) or 'price' (legacy)
    const priceCents = bodyPriceCents ?? bodyPrice
    const originalPriceCents = bodyOriginalPriceCents ?? originalPrice

    // If categoryId is being changed, verify it belongs to the same restaurant
    if (categoryId && categoryId !== existing.categoryId) {
      const category = await db.menuCategory.findFirst({
        where: { id: categoryId, restaurantId },
      })
      if (!category) {
        return NextResponse.json(
          { error: 'Category not found in this restaurant' },
          { status: 404 }
        )
      }
    }

    const item = await db.menuItem.update({
      where: { id: itemId },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(name !== undefined && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(description !== undefined && { description }),
        ...(descriptionAm !== undefined && { descriptionAm }),
        ...(image !== undefined && { image }),
        ...(images !== undefined && { images }),
        ...(priceCents !== undefined && { priceCents: typeof priceCents === 'number' ? Math.round(priceCents) : Math.round(Number(priceCents)) }),
        ...(originalPriceCents !== undefined && { originalPriceCents: originalPriceCents != null ? Math.round(Number(originalPriceCents)) : null }),
        ...(preparationTime !== undefined && { preparationTime }),
        ...(calories !== undefined && { calories }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(isPopular !== undefined && { isPopular }),
        ...(isVegetarian !== undefined && { isVegetarian }),
        ...(isSpicy !== undefined && { isSpicy }),
        ...(showServingSize !== undefined && { showServingSize }),
        ...(availabilityType !== undefined && { availabilityType }),
        ...(availabilitySchedule !== undefined && { availabilitySchedule }),
        ...(availableFrom !== undefined && { availableFrom: availableFrom || null }),
        ...(availableTo !== undefined && { availableTo: availableTo || null }),
        ...(availableDays !== undefined && { availableDays: availableDays || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(ingredients !== undefined && { ingredients }),
        ...(ingredientsI18n !== undefined && { ingredientsI18n }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ item })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ITEM_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE /api/restaurants/[id]/items/[itemId] — Soft delete item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Auth check — only authorized staff/admin can delete items
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const existing = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const item = await db.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
    })

    return NextResponse.json({ item })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ITEM_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
