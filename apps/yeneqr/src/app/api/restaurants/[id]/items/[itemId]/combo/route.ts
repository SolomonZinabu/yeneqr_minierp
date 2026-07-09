// ============================================================
// Yene QR — Combo Items API
// PUT: Update combo items for a menu item
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * PUT /api/restaurants/[id]/items/[itemId]/combo
 * Replace combo items for a menu item
 * Body: { comboItems: [{ includedItemId: string, quantity: number }] }
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

    const existing = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const { comboItems } = body as {
      comboItems: { includedItemId: string; quantity: number }[]
    }

    // Validate that all included items exist and belong to this restaurant
    if (comboItems && comboItems.length > 0) {
      const includedIds = comboItems.map((ci) => ci.includedItemId)
      const validItems = await db.menuItem.findMany({
        where: {
          id: { in: includedIds },
          restaurantId,
        },
        select: { id: true },
      })

      const validIds = new Set(validItems.map((v) => v.id))
      for (const ci of comboItems) {
        if (!validIds.has(ci.includedItemId)) {
          return NextResponse.json(
            { error: `Menu item ${ci.includedItemId} not found in this restaurant` },
            { status: 400 }
          )
        }
      }
    }

    // Delete existing combo items and create new ones
    await db.$transaction(async (tx) => {
      // Delete existing combo items
      await tx.comboItem.deleteMany({
        where: { menuItemId: itemId },
      })

      // Create new combo items
      if (comboItems && comboItems.length > 0) {
        await tx.comboItem.createMany({
          data: comboItems.map((ci) => ({
            menuItemId: itemId,
            includedItemId: ci.includedItemId,
            quantity: ci.quantity || 1,
          })),
        })
      }
    })

    // Fetch updated item with combo items
    const updatedItem = await db.menuItem.findUnique({
      where: { id: itemId },
      include: {
        comboItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, priceCents: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ item: updatedItem })
  } catch (error) {
    console.error('[COMBO_ITEMS_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update combo items' },
      { status: 500 }
    )
  }
}
