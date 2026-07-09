// ============================================================
// Yene QR — Bulk Order Item Kitchen Status Update
// ============================================================
// PATCH /api/restaurants/[id]/orders/[orderId]/items/bulk
// Body: { itemIds: string[], kitchenStatus: string }
// Used for "Mark All Ready" and other bulk actions from kitchen display.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { canTransitionKitchenItem, type KitchenItemStatus, type OrderStatus } from '@/lib/orders'
import { emitEvent } from '@/lib/realtime'
import { notifyWaiterOrderReady, notifyOrderReady } from '@/lib/notifications'

/**
 * PATCH /api/restaurants/[id]/orders/[orderId]/items/bulk
 * Bulk update kitchen item status for multiple items in one request.
 * Body: { itemIds: string[], kitchenStatus: KitchenItemStatus }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id: restaurantId, orderId } = await params
    const auth = requireAuth(request)

    // Require order:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'order:manage', restaurantId)
    if (permErr) return permErr

    // Allow kitchen staff, managers, owners, and waiters (for picked_up/served transitions)
    const kitchenOnlyRoles = ['super_admin', 'owner', 'manager', 'kitchen_staff']
    const waiterAllowedStatuses: KitchenItemStatus[] = ['picked_up', 'served']

    const body = await request.json()
    const { itemIds, kitchenStatus } = body as {
      itemIds: string[]
      kitchenStatus: string
    }

    // Check role permissions based on the requested status
    if (!kitchenOnlyRoles.includes(auth.role)) {
      // Waiters can only transition to picked_up or served
      if (auth.role !== 'waiter' || !waiterAllowedStatuses.includes(kitchenStatus as KitchenItemStatus)) {
        return NextResponse.json(
          { error: 'Forbidden — only kitchen staff, managers, and owners can update kitchen item status. Waiters can only mark items as picked up or served.' },
          { status: 403 }
        )
      }
    }

    // Verify order belongs to this restaurant
    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify branch access — kitchen staff at Branch A cannot bulk-update items on Branch B orders
    if (auth.type !== 'customer') {
      const branchErr = verifyBranchAccess(auth, order.branchId, restaurantId)
      if (branchErr) return branchErr
    }

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    const validStatuses: KitchenItemStatus[] = ['pending', 'preparing', 'ready', 'picked_up', 'served', 'cancelled']
    if (!validStatuses.includes(kitchenStatus as KitchenItemStatus)) {
      return NextResponse.json(
        { error: `Invalid kitchen status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const newStatus = kitchenStatus as KitchenItemStatus

    // Fetch all items that belong to this order
    const orderItems = await db.orderItem.findMany({
      where: { id: { in: itemIds }, orderId },
    })

    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'No matching items found' }, { status: 404 })
    }

    // Filter to only items that can transition
    const transitionableItems = orderItems.filter((item) => {
      const currentStatus = item.kitchenStatus as KitchenItemStatus
      return currentStatus !== newStatus && canTransitionKitchenItem(currentStatus, newStatus, auth.role)
    })

    if (transitionableItems.length === 0) {
      return NextResponse.json(
        { error: 'No items can be transitioned to the requested status' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      kitchenStatus: newStatus,
    }

    if (newStatus === 'preparing') {
      updateData.preparationStartedAt = new Date()
    }
    if (newStatus === 'ready') {
      updateData.preparationCompletedAt = new Date()
    }
    if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date()
    }

    let orderAutoTransitioned = false
    let previousOrderStatus = order.status as OrderStatus

    await db.$transaction(async (tx) => {
      // Update all transitionable items
      await tx.orderItem.updateMany({
        where: { id: { in: transitionableItems.map((i) => i.id) } },
        data: updateData,
      })

      // Create events for each item
      for (const item of transitionableItems) {
        await tx.orderEvent.create({
          data: {
            orderId,
            restaurantId,
            branchId: order.branchId,
            event: newStatus === 'cancelled' ? 'item_cancelled' : 'item_kitchen_status_change',
            fromStatus: item.kitchenStatus,
            toStatus: newStatus,
            data: JSON.stringify({
              itemId: item.id,
              itemName: item.name,
              quantity: item.quantity,
              bulkUpdate: true,
            }),
            performedBy: auth.userId,
            performedByType: 'staff',
          },
        })
      }

      // Auto-transition order to 'preparing' if any item started preparing
      if (newStatus === 'preparing' && (order.status === 'pending' || order.status === 'accepted')) {
        const result = await tx.order.updateMany({
          where: { id: orderId, status: { in: ['pending', 'accepted'] } },
          data: {
            status: 'preparing',
            confirmedAt: order.confirmedAt || new Date(),
            preparingAt: new Date(),
          },
        })
        if (result.count > 0) {
          await tx.orderEvent.create({
            data: {
              orderId,
              restaurantId,
              branchId: order.branchId,
              event: 'status_change',
              fromStatus: order.status,
              toStatus: 'preparing',
              data: JSON.stringify({ reason: 'items_started_bulk' }),
              performedBy: auth.userId,
              performedByType: 'system',
            },
          })
        }
      }

      // Check if all items are ready — auto-transition order to "ready"
      if (newStatus === 'ready') {
        const pendingItems = await tx.orderItem.count({
          where: {
            orderId,
            kitchenStatus: { in: ['pending', 'preparing'] },
          },
        })

        if (pendingItems === 0 && ['pending', 'accepted', 'preparing'].includes(order.status)) {
          const result = await tx.order.updateMany({
            where: { id: orderId, status: { in: ['pending', 'accepted', 'preparing'] } },
            data: {
              status: 'ready',
              readyAt: new Date(),
            },
          })
          if (result.count > 0) {
            await tx.orderEvent.create({
              data: {
                orderId,
                restaurantId,
                branchId: order.branchId,
                event: 'status_change',
                fromStatus: order.status,
                toStatus: 'ready',
                data: JSON.stringify({ reason: 'all_items_ready_bulk' }),
                performedBy: auth.userId,
                performedByType: 'system',
              },
            })
            orderAutoTransitioned = true
          }
        }
      }
    })

    // Emit real-time events
    for (const item of transitionableItems) {
      emitEvent({
        type: 'kitchen_item_updated',
        restaurantId,
        orderId,
        itemId: item.id,
        kitchenStatus: newStatus,
        tableId: order.tableId,
      })
    }

    // If the order auto-transitioned to "ready", emit events and notify
    if (orderAutoTransitioned) {
      emitEvent({
        type: 'order_status_changed',
        restaurantId,
        orderId,
        fromStatus: previousOrderStatus,
        toStatus: 'ready',
      })

      try {
        const orderWithTable = await db.order.findUnique({
          where: { id: orderId },
          include: { table: { select: { id: true, number: true } } },
        })
        const tableId = orderWithTable?.tableId || order.tableId
        const tableNum = orderWithTable?.table?.number ?? ''

        notifyWaiterOrderReady(
          restaurantId,
          orderId,
          order.orderNumber,
          tableId,
          String(tableNum)
        ).then((waiterUserIds) => {
          emitEvent({
            type: 'waiter_order_ready',
            restaurantId,
            orderId,
            orderNumber: order.orderNumber,
            tableId,
            tableNumber: String(tableNum),
            waiterUserId: waiterUserIds[0] || undefined,
          })
        }).catch((err) =>
          console.error('[NOTIFY_WAITER_ORDER_READY_BULK]', err)
        )

        const orderWithCustomer = await db.order.findUnique({
          where: { id: orderId },
          include: { customer: { select: { phone: true } } },
        })
        notifyOrderReady(restaurantId, order.orderNumber, orderWithCustomer?.customer?.phone || undefined).catch((err) =>
          console.error('[NOTIFY_ORDER_READY_BULK]', err)
        )
      } catch (err) {
        console.error('[BULK_AUTO_TRANSITION_NOTIFICATION_ERROR]', err)
      }
    }

    return NextResponse.json({
      data: {
        updatedCount: transitionableItems.length,
        skippedCount: orderItems.length - transitionableItems.length,
        kitchenStatus: newStatus,
        orderAutoTransitioned,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ORDER_ITEMS_BULK_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to bulk update kitchen item status' },
      { status: 500 }
    )
  }
}
