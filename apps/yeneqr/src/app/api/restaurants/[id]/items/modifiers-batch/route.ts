// ============================================================
// Yene QR — Batch Modifiers API
// GET /api/restaurants/[id]/items/modifiers-batch?itemIds=id1,id2,id3
// Returns modifier groups + combo items for multiple items at once,
// fixing the N+1 query problem in the customer menu page.
//
// Intentionally public (no auth) — called from the customer-facing menu
// page where no staff token is available. Only returns data for items
// that belong to the specified restaurantId and are isAvailable=true.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const { searchParams } = new URL(request.url)
    const itemIdsParam = searchParams.get('itemIds')

    if (!itemIdsParam) {
      return NextResponse.json(
        { error: 'itemIds query parameter is required' },
        { status: 400 }
      )
    }

    const itemIds = itemIdsParam.split(',').filter(Boolean)

    if (itemIds.length === 0) {
      return NextResponse.json({ data: {} })
    }

    // Cap at 200 items to prevent abuse
    if (itemIds.length > 200) {
      return NextResponse.json(
        { error: 'Too many item IDs. Maximum 200.' },
        { status: 400 }
      )
    }

    // Verify all items belong to this restaurant
    const validItems = await db.menuItem.findMany({
      where: {
        id: { in: itemIds },
        restaurantId,
      },
      select: { id: true },
    })

    const validItemIds = new Set(validItems.map((i) => i.id))

    // Fetch modifier groups with options for all valid items
    const modifierGroups = await db.modifierGroup.findMany({
      where: {
        menuItemId: { in: Array.from(validItemIds) },
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    // Fetch combo items for all valid items
    const comboItems = await db.comboItem.findMany({
      where: {
        menuItemId: { in: Array.from(validItemIds) },
      },
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
    })

    // Group by menuItemId
    const result: Record<string, { modifierGroups: typeof modifierGroups; comboItems: typeof comboItems }> = {}

    for (const itemId of validItemIds) {
      result[itemId] = {
        modifierGroups: modifierGroups.filter((mg) => mg.menuItemId === itemId),
        comboItems: comboItems.filter((ci) => ci.menuItemId === itemId),
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[MODIFIERS_BATCH]', error)
    return NextResponse.json(
      { error: 'Failed to fetch modifiers batch' },
      { status: 500 }
    )
  }
}
