// ============================================================
// Yene QR — Order Item Kitchen Status API (GET, PUT, PATCH)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, getAuthContext, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { canTransitionKitchenItem, type KitchenItemStatus, type OrderStatus } from '@/lib/orders'
import { emitEvent } from '@/lib/realtime'
import { notifyOrderReady, notifyWaiterOrderReady } from '@/lib/notifications'

/**
 * GET /api/restaurants/[id]/orders/[orderId]/items/[itemId]
 * Get a single order item with removedIngredients and modifierSelections.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string; itemId: string }> }
) {
  try {
    const { id, orderId, itemId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify order belongs to this restaurant
    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: id },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify branch access — kitchen_staff at Branch A cannot modify items
    // on an order at Branch B.
    if (auth.type !== 'customer') {
      const branchErr = verifyBranchAccess(auth, order.branchId, id)
      if (branchErr) return branchErr
    }

    const item = await db.orderItem.findFirst({
      where: { id: itemId, orderId },
      include: {
        menuItem: {
          select: { id: true, name: true, image: true },
        },
        modifierSelections: true,
      },
    })
    if (!item) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    return NextResponse.json({ data: item })
  } catch (error) {
    console.error('[ORDER_ITEM_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch order item' }, { status: 500 })
  }
}

/**
 * PATCH /api/restaurants/[id]/orders/[orderId]/items/[itemId]
 * Partial update for kitchen item status.
 * Supports: { kitchenStatus: 'preparing' } — accept/mark preparing
 *           { kitchenStatus: 'cancelled' } — cancel individual item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string; itemId: string }> }
) {
  try {
    const { id, orderId, itemId } = await params
    const auth = requireAuth(request)

    // Staff: require order:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'order:manage', id)
    if (permErr) return permErr

    // Kitchen-specific role checks for item status transitions
    const kitchenOnlyRoles = ['super_admin', 'owner', 'manager', 'kitchen_staff']
    const waiterAllowedStatuses: KitchenItemStatus[] = ['picked_up', 'served']

    const body = await request.json()
    const { kitchenStatus, cancelledAt } = body

    if (!kitchenStatus) {
      return NextResponse.json(
        { error: 'kitchenStatus is required' },
        { status: 400 }
      )
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

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: id },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify branch access — kitchen_staff at Branch A cannot modify items
    // on an order at Branch B.
    if (auth.type !== 'customer') {
      const branchErr = verifyBranchAccess(auth, order.branchId, id)
      if (branchErr) return branchErr
    }

    const orderItem = await db.orderItem.findFirst({
      where: { id: itemId, orderId },
    })
    if (!orderItem) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    const validStatuses: KitchenItemStatus[] = ['pending', 'preparing', 'ready', 'picked_up', 'served', 'cancelled']
    if (!validStatuses.includes(kitchenStatus as KitchenItemStatus)) {
      return NextResponse.json(
        { error: `Invalid kitchen status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const currentStatus = orderItem.kitchenStatus as KitchenItemStatus
    const newStatus = kitchenStatus as KitchenItemStatus

    if (currentStatus === newStatus) {
      return NextResponse.json(
        { error: 'Item is already in this kitchen status' },
        { status: 400 }
      )
    }

    const canTransition = canTransitionKitchenItem(currentStatus, newStatus, auth.role)
    if (!canTransition) {
      return NextResponse.json(
        { error: `Cannot transition item from "${currentStatus}" to "${newStatus}" with your role (${auth.role})` },
        { status: 400 }
      )
    }

    // Build update data with timestamps
    const updateData: Record<string, unknown> = {
      kitchenStatus: newStatus,
    }

    if (newStatus === 'preparing') {
      updateData.preparationStartedAt = new Date()
    }

    if (newStatus === 'ready') {
      updateData.preparationCompletedAt = new Date()
    }

    // Cancelled items get a cancelledAt timestamp
    if (newStatus === 'cancelled') {
      updateData.cancelledAt = cancelledAt ? new Date(cancelledAt) : new Date()
    }

    // Use transaction to update item and create event
    // Declare auto-transition tracking OUTSIDE the transaction to avoid scope bugs
    let orderAutoTransitioned = false
    let previousOrderStatus = order.status as OrderStatus

    await db.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: updateData,
      })

      await tx.orderEvent.create({
        data: {
          orderId,
          restaurantId: id,
          branchId: order.branchId,
          event: newStatus === 'cancelled' ? 'item_cancelled' : 'item_kitchen_status_change',
          fromStatus: currentStatus,
          toStatus: newStatus,
          data: JSON.stringify({
            itemId,
            itemName: orderItem.name,
            quantity: orderItem.quantity,
          }),
          performedBy: auth.userId,
          performedByType: 'staff',
        },
      })

      // Auto-transition: when first item starts preparing, move order from 'pending' → 'preparing'
      // or 'accepted' → 'preparing'
      if (newStatus === 'preparing' && (order.status === 'pending' || order.status === 'accepted')) {
        // Use updateMany with status check to prevent double-transition
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
              restaurantId: id,
              branchId: order.branchId,
              event: 'status_change',
              fromStatus: order.status,
              toStatus: 'preparing',
              data: JSON.stringify({ reason: 'first_item_started' }),
              performedBy: auth.userId,
              performedByType: 'system',
            },
          })
        }
      }

      // Check if all items are ready — auto-transition order to "ready"
      // This can happen from 'pending', 'accepted', or 'preparing' states
      if (newStatus === 'ready') {
        const pendingItems = await tx.orderItem.count({
          where: {
            orderId,
            kitchenStatus: { in: ['pending', 'preparing'] },
          },
        })

        if (pendingItems === 0 && (order.status === 'pending' || order.status === 'preparing' || order.status === 'accepted')) {
          // Use updateMany with status check to make transition idempotent
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
                restaurantId: id,
                branchId: order.branchId,
                event: 'status_change',
                fromStatus: order.status,
                toStatus: 'ready',
                data: JSON.stringify({ reason: 'all_items_ready' }),
                performedBy: auth.userId,
                performedByType: 'system',
              },
            })

            orderAutoTransitioned = true
          }
        }
      }
    })

    // Fetch updated item with menu item info
    const completeItem = await db.orderItem.findUnique({
      where: { id: itemId },
      include: {
        menuItem: {
          select: { id: true, name: true, image: true },
        },
        modifierSelections: true,
      },
    })

    // Emit real-time event for kitchen item update
    emitEvent({
      type: 'kitchen_item_updated',
      restaurantId: id,
      orderId,
      itemId,
      kitchenStatus: newStatus,
      tableId: order.tableId,
    })

    // If the order auto-transitioned to "ready", emit SSE events and notify waiter
    if (orderAutoTransitioned) {
      // Emit order status changed SSE so all clients (kitchen, waiter, customer) update
      emitEvent({
        type: 'order_status_changed',
        restaurantId: id,
        orderId,
        fromStatus: previousOrderStatus,
        toStatus: 'ready',
      })

      // Notify the assigned waiter that the order is ready for pickup
      try {
        const orderWithTable = await db.order.findUnique({
          where: { id: orderId },
          include: { table: { select: { id: true, number: true } } },
        })
        const tableId = orderWithTable?.tableId || order.tableId
        const tableNum = orderWithTable?.table?.number ?? ''

        notifyWaiterOrderReady(
          id,
          orderId,
          order.orderNumber,
          tableId,
          String(tableNum)
        ).then((waiterUserIds) => {
          // Emit a dedicated SSE event for the waiter
          emitEvent({
            type: 'waiter_order_ready',
            restaurantId: id,
            orderId,
            orderNumber: order.orderNumber,
            tableId,
            tableNumber: String(tableNum),
            waiterUserId: waiterUserIds[0] || undefined,
          })
        }).catch((err) =>
          console.error('[NOTIFY_WAITER_ORDER_READY_AUTO]', err)
        )

        // Notify the customer that the order is ready
        const orderWithCustomer = await db.order.findUnique({
          where: { id: orderId },
          include: { customer: { select: { phone: true } } },
        })
        notifyOrderReady(id, order.orderNumber, orderWithCustomer?.customer?.phone || undefined).catch((err) =>
          console.error('[NOTIFY_ORDER_READY_AUTO]', err)
        )
      } catch (err) {
        console.error('[AUTO_TRANSITION_NOTIFICATION_ERROR]', err)
      }
    }

    return NextResponse.json({ data: completeItem })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ORDER_ITEM_PATCH]', error)
    return NextResponse.json(
      { error: 'Failed to update kitchen item status' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/orders/[orderId]/items/[itemId]
 * Update kitchen item status (pending → preparing → ready).
 * Validates kitchen state machine transitions.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string; itemId: string }> }
) {
  try {
    const { id, orderId, itemId } = await params
    const auth = requireAuth(request)

    // Staff: require order:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'order:manage', id)
    if (permErr) return permErr

    // Kitchen-specific role checks for item status transitions
    const kitchenOnlyRoles = ['super_admin', 'owner', 'manager', 'kitchen_staff']
    const waiterAllowedStatuses: KitchenItemStatus[] = ['picked_up', 'served']

    const body = await request.json()
    const { kitchenStatus } = body

    if (!kitchenStatus) {
      return NextResponse.json(
        { error: 'kitchenStatus is required' },
        { status: 400 }
      )
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

    // Verify order exists and belongs to this restaurant
    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: id },
    })
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify branch access — kitchen_staff at Branch A cannot modify items
    // on an order at Branch B.
    if (auth.type !== 'customer') {
      const branchErr = verifyBranchAccess(auth, order.branchId, id)
      if (branchErr) return branchErr
    }

    // Verify item exists and belongs to this order
    const orderItem = await db.orderItem.findFirst({
      where: { id: itemId, orderId },
    })
    if (!orderItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      )
    }

    const validStatuses: KitchenItemStatus[] = ['pending', 'preparing', 'ready', 'picked_up', 'served', 'cancelled']
    if (!validStatuses.includes(kitchenStatus as KitchenItemStatus)) {
      return NextResponse.json(
        { error: `Invalid kitchen status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate state machine transition
    const currentStatus = orderItem.kitchenStatus as KitchenItemStatus
    const newStatus = kitchenStatus as KitchenItemStatus

    if (currentStatus === newStatus) {
      return NextResponse.json(
        { error: 'Item is already in this kitchen status' },
        { status: 400 }
      )
    }

    const canTransition = canTransitionKitchenItem(
      currentStatus,
      newStatus,
      auth.role
    )

    if (!canTransition) {
      return NextResponse.json(
        { error: `Cannot transition item from "${currentStatus}" to "${newStatus}" with your role (${auth.role})` },
        { status: 400 }
      )
    }

    // Build update data with timestamps
    const updateData: Record<string, unknown> = {
      kitchenStatus: newStatus,
    }

    if (newStatus === 'preparing') {
      updateData.preparationStartedAt = new Date()
    }

    if (newStatus === 'ready') {
      updateData.preparationCompletedAt = new Date()
    }

    // Use transaction to update item and create event
    let orderAutoTransitioned = false
    let previousOrderStatus = order.status as OrderStatus

    const updated = await db.$transaction(async (tx) => {
      const item = await tx.orderItem.update({
        where: { id: itemId },
        data: updateData,
      })

      // Create order event for item status change
      await tx.orderEvent.create({
        data: {
          orderId,
          restaurantId: id,
          branchId: order.branchId,
          event: 'item_kitchen_status_change',
          fromStatus: currentStatus,
          toStatus: newStatus,
          data: JSON.stringify({
            itemId,
            itemName: orderItem.name,
            quantity: orderItem.quantity,
          }),
          performedBy: auth.userId,
          performedByType: 'staff',
        },
      })

      // Auto-transition: when first item starts preparing, move order from 'pending' → 'preparing'
      // or 'accepted' → 'preparing'
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
              restaurantId: id,
              branchId: order.branchId,
              event: 'status_change',
              fromStatus: order.status,
              toStatus: 'preparing',
              data: JSON.stringify({ reason: 'first_item_started' }),
              performedBy: auth.userId,
              performedByType: 'system',
            },
          })
        }
      }

      // Check if all items are ready — auto-transition order to "ready"
      // This can happen from 'pending', 'accepted', or 'preparing' states
      if (newStatus === 'ready') {
        const pendingItems = await tx.orderItem.count({
          where: {
            orderId,
            kitchenStatus: { in: ['pending', 'preparing'] },
          },
        })

        if (pendingItems === 0 && (order.status === 'pending' || order.status === 'preparing' || order.status === 'accepted')) {
          // Use updateMany with status check to make transition idempotent
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
                restaurantId: id,
                branchId: order.branchId,
                event: 'status_change',
                fromStatus: order.status,
                toStatus: 'ready',
                data: JSON.stringify({ reason: 'all_items_ready' }),
                performedBy: auth.userId,
                performedByType: 'system',
              },
            })

            orderAutoTransitioned = true
          }
        }
      }

      return item
    })

    // Fetch updated item with menu item info
    const completeItem = await db.orderItem.findUnique({
      where: { id: itemId },
      include: {
        menuItem: {
          select: { id: true, name: true, image: true },
        },
        modifierSelections: true,
      },
    })

    // Emit real-time event for kitchen item update
    emitEvent({
      type: 'kitchen_item_updated',
      restaurantId: id,
      orderId,
      itemId,
      kitchenStatus: newStatus,
      tableId: order.tableId,
    })

    // If the order auto-transitioned to "ready", emit SSE events and notify waiter
    if (orderAutoTransitioned) {
      emitEvent({
        type: 'order_status_changed',
        restaurantId: id,
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
          id,
          orderId,
          order.orderNumber,
          tableId,
          String(tableNum)
        ).then((waiterUserIds) => {
          emitEvent({
            type: 'waiter_order_ready',
            restaurantId: id,
            orderId,
            orderNumber: order.orderNumber,
            tableId,
            tableNumber: String(tableNum),
            waiterUserId: waiterUserIds[0] || undefined,
          })
        }).catch((err) =>
          console.error('[NOTIFY_WAITER_ORDER_READY_AUTO_PUT]', err)
        )

        const orderWithCustomer = await db.order.findUnique({
          where: { id: orderId },
          include: { customer: { select: { phone: true } } },
        })
        notifyOrderReady(id, order.orderNumber, orderWithCustomer?.customer?.phone || undefined).catch((err) =>
          console.error('[NOTIFY_ORDER_READY_AUTO_PUT]', err)
        )
      } catch (err) {
        console.error('[AUTO_TRANSITION_NOTIFICATION_ERROR_PUT]', err)
      }
    }

    return NextResponse.json({ data: completeItem })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ORDER_ITEM_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update kitchen item status' },
      { status: 500 }
    )
  }
}
