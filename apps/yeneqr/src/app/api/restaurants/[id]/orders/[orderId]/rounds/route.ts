// ============================================================
// Yene QR — Order Rounds API (Add items to existing order)
// ============================================================
// Allows customers to add more items to an active order
// (multi-round ordering). Increments roundNumber on the order
// and creates new OrderItems with the corresponding round.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPerm } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'
import { calculateOrderTotalsCents } from '@/lib/money'
import { deductStockForOrder } from '@/lib/inventory-watchdog'

interface RoundItemInput {
  menuItemId: string
  quantity: number
  specialInstructions?: string
  removedIngredients?: string // JSON
  modifierSelections?: {
    modifierGroupId: string
    modifierOptionId: string
    name: string
    priceDeltaCents: number
    quantity: number
  }[]
}

/**
 * POST /api/restaurants/[id]/orders/[orderId]/rounds
 * Add items to an existing active order (new round).
 *
 * Body: {
 *   items: RoundItemInput[],
 *   specialInstructions?: string,
 *   sessionId?: string  // Customer session for auth
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id: restaurantId, orderId } = await params
    const auth = requireAuth(request)

    // Authorization: customers can add to their own orders, staff need order:manage
    if (auth.type === 'customer') {
      if (auth.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Staff: require order:manage permission + restaurant scope
      if (!hasPerm(auth, 'order:manage') && !hasPerm(auth, 'platform:manage')) {
        return NextResponse.json(
          { error: 'Forbidden — insufficient permission' },
          { status: 403 }
        )
      }
      if (auth.restaurantId !== restaurantId && !hasPerm(auth, 'platform:manage')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Verify the order exists and belongs to this restaurant
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            modifierSelections: true,
          },
        },
      },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (existingOrder.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // For staff (non-customer), verify branch access
    if (auth.type !== 'customer') {
      // Staff can only add to orders in their own branch (unless they have view_all)
      if (auth.branchId && existingOrder.branchId && auth.branchId !== existingOrder.branchId) {
        const hasViewAll = hasPerm(auth, 'branch:view_all') || hasPerm(auth, 'platform:manage')
        if (!hasViewAll) {
          return NextResponse.json({ error: 'Forbidden — branch mismatch' }, { status: 403 })
        }
      }
    }

    // Only allow adding to orders that are in an active state
    const activeStatuses = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served']
    if (!activeStatuses.includes(existingOrder.status)) {
      return NextResponse.json(
        { error: `Cannot add items to an order with status "${existingOrder.status}". Order must be in an active state.` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { items, specialInstructions } = body as {
      items: RoundItemInput[]
      specialInstructions?: string
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Calculate the new round number
    const currentRound = existingOrder.roundNumber
    const newRoundNumber = currentRound + 1

    // Validate all menu items exist and are available
    const menuItemIds = items.map((item) => item.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId,
        isAvailable: true,
      },
    })

    const foundIds = new Set(menuItems.map((mi) => mi.id))
    const unavailableItems = items.filter((item) => !foundIds.has(item.menuItemId))

    if (unavailableItems.length > 0) {
      return NextResponse.json(
        {
          error: 'Some items are no longer available',
          unavailableItems: unavailableItems.map((i) => i.menuItemId),
        },
        { status: 400 }
      )
    }

    // Build menu item lookup
    const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi]))

    // Calculate item prices and create order items in a transaction
    const result = await db.$transaction(async (tx) => {
      const newItemsData: Array<{
        id: string
        name: string
        priceCents: number
      }> = []

      let roundSubtotalCents = 0

      // Create order items for the new round
      for (const itemInput of items) {
        const menuItem = menuItemMap.get(itemInput.menuItemId)
        if (!menuItem) continue

        // Calculate item price with modifiers
        let itemPriceCents = menuItem.priceCents
        if (itemInput.modifierSelections && itemInput.modifierSelections.length > 0) {
          for (const mod of itemInput.modifierSelections) {
            itemPriceCents += mod.priceDeltaCents
          }
        }

        const lineTotal = itemPriceCents * (itemInput.quantity || 1)
        roundSubtotalCents += lineTotal

        // Resolve kitchen station
        let kitchenStationId: string | null = null
        if (menuItem.categoryId) {
          const category = await tx.menuCategory.findUnique({
            where: { id: menuItem.categoryId },
            select: { name: true },
          })
          // Auto-assign station based on category name keywords
          if (category) {
            const catLower = category.name.toLowerCase()
            const station = await tx.kitchenStation.findFirst({
              where: { branchId: existingOrder.branchId, isActive: true },
            })
            if (station) kitchenStationId = station.id
          }
        }

        const orderItem = await tx.orderItem.create({
          data: {
            orderId,
            restaurantId,
            branchId: existingOrder.branchId,  // Denormalized from Order for branch-scoped queries
            menuItemId: itemInput.menuItemId,
            name: menuItem.name,
            nameAm: menuItem.nameAm,
            priceCents: itemPriceCents,
            quantity: itemInput.quantity || 1,
            specialInstructions: itemInput.specialInstructions || null,
            removedIngredients: itemInput.removedIngredients || null,
            kitchenStatus: 'pending',
            kitchenStationId,
            roundNumber: newRoundNumber,
          },
        })

        // Create modifier selections
        if (itemInput.modifierSelections && itemInput.modifierSelections.length > 0) {
          await tx.orderItemModifier.createMany({
            data: itemInput.modifierSelections.map((mod) => ({
              orderItemId: orderItem.id,
              modifierGroupId: mod.modifierGroupId,
              modifierOptionId: mod.modifierOptionId,
              name: mod.name,
              priceDeltaCents: mod.priceDeltaCents,
              quantity: mod.quantity,
            })),
          })
        }

        newItemsData.push({
          id: orderItem.id,
          name: menuItem.name,
          priceCents: itemPriceCents,
        })
      }

      // Recalculate order totals with the new items
      // Get all items (existing + new round)
      const allItems = await tx.orderItem.findMany({
        where: { orderId },
      })

      const newSubtotalCents = allItems.reduce(
        (sum, item) => sum + item.priceCents * item.quantity,
        0
      )

      // Get restaurant for tax/service charge
      const restaurant = await tx.restaurant.findUnique({
        where: { id: restaurantId },
        select: { taxRate: true, serviceCharge: true },
      })

      const totals = calculateOrderTotalsCents({
        subtotalCents: newSubtotalCents,
        taxRate: restaurant?.taxRate || 0,
        serviceChargeRate: restaurant?.serviceCharge || 0,
        discountAmountCents: existingOrder.discountAmountCents,
        tipAmountCents: existingOrder.tipAmountCents,
        packagingChargeCents: existingOrder.packagingChargeCents,
      })

      // Update the order with new round number and recalculated totals
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          roundNumber: newRoundNumber,
          subtotalCents: newSubtotalCents,
          taxAmountCents: totals.taxAmountCents,
          serviceChargeCents: totals.serviceChargeCents,
          totalAmountCents: totals.totalAmountCents,
          ...(specialInstructions && {
            specialInstructions: existingOrder.specialInstructions
              ? `${existingOrder.specialInstructions}\n[Round ${newRoundNumber}] ${specialInstructions}`
              : `[Round ${newRoundNumber}] ${specialInstructions}`,
          }),
        },
      })

      // Create order event for the new round
      await tx.orderEvent.create({
        data: {
          orderId,
          restaurantId,
          branchId: existingOrder.branchId,
          event: 'round_added',
          fromStatus: existingOrder.status,
          toStatus: existingOrder.status,
          data: JSON.stringify({
            roundNumber: newRoundNumber,
            itemsAdded: newItemsData.length,
            roundSubtotalCents,
          }),
          performedBy: auth.userId || 'customer',
          performedByType: auth.role === 'customer' ? 'customer' : 'staff',
        },
      })

      return { updatedOrder, newItemsData, roundSubtotalCents }
    })

    // Emit real-time events
    emitEvent({
      type: 'order_status_changed',
      restaurantId,
      orderId,
      fromStatus: existingOrder.status,
      toStatus: existingOrder.status, // Status doesn't change, but this signals an update
    } as any)

    // Also emit kitchen item events for each new item so kitchen sees them
    for (const newItem of result.newItemsData) {
      emitEvent({
        type: 'kitchen_item_updated',
        restaurantId,
        orderId,
        itemId: newItem.id,
        kitchenStatus: 'pending',
        tableId: existingOrder.tableId || undefined,
      } as any)
    }

    // Deduct inventory stock for the new round items (async — doesn't block response)
    deductStockForOrder(restaurantId, orderId).catch((err) =>
      console.error('[STOCK_DEDUCTION_ROUND_ERROR]', err)
    )

    return NextResponse.json({
      data: {
        orderId,
        roundNumber: newRoundNumber,
        itemsAdded: result.newItemsData.length,
        roundSubtotalCents: result.roundSubtotalCents,
        newSubtotalCents: result.updatedOrder.subtotalCents,
        newTotalCents: result.updatedOrder.totalAmountCents,
        items: result.newItemsData,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ORDER_ROUNDS_CREATE]', error)
    const errorDetail = error instanceof Error ? error.message : String(error)
    const prismaMeta = (error as any)?.meta ? JSON.stringify((error as any).meta) : undefined
    return NextResponse.json(
      { error: 'Failed to add items to order', errorDetail, prismaMeta },
      { status: 500 }
    )
  }
}
