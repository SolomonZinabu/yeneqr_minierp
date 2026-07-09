// ============================================================
// Yene QR — Order Detail API (GET, PUT)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { canTransitionOrder, type OrderStatus } from '@/lib/orders'
import { emitEvent } from '@/lib/realtime'
import { notifyOrderReady, notifyWaiterOrderReady, notifyOrderCancelledByCustomer, notifyOrderCancelledByRestaurant, sendNotification } from '@/lib/notifications'
import { creditLoyaltyPoints } from '@/lib/loyalty'
import { triggerReaggregation } from '@/lib/analytics'
import { logStaffAction } from '@/lib/audit-log'
import { restoreStockForOrder } from '@/lib/inventory-watchdog'
import { dispatchPOSWebhook } from '@/lib/pos-webhook'

/**
 * GET /api/restaurants/[id]/orders/[orderId]
 * Get order details with items, payments, and events.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id, orderId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Customers can view their own orders (validated below after fetching the order)
    // Staff: require order:view permission + restaurant scope
    if (auth.type !== 'customer') {
      const permErr = requirePerm(auth, 'order:view', id)
      if (permErr) return permErr
    } else if (auth.restaurantId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: id },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, nameAm: true, image: true, priceCents: true },
            },
            modifierSelections: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        table: {
          select: { id: true, number: true, status: true, floor: { select: { id: true, name: true } } },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        session: {
          select: { id: true, language: true, startedAt: true },
        },
        billSplits: {
          include: {
            payments: {
              select: { id: true, amountCents: true, method: true, status: true },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Customer: can only view orders from their own table/session
    if (auth.type === 'customer') {
      const customerAuth = auth as { type: 'customer'; tableId?: string; sessionId?: string }
      const isOwnTable = customerAuth.tableId && order.tableId === customerAuth.tableId
      const isOwnSession = customerAuth.sessionId && order.sessionId === customerAuth.sessionId
      if (!isOwnTable && !isOwnSession) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ data: order })
  } catch (error) {
    console.error('[ORDER_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/orders/[orderId]
 * Update order status (validate state machine transition).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id, orderId } = await params
    const auth = requireAuth(request)

    // Customer tokens: scope check only (customer-specific restrictions below)
    if (auth.type === 'customer') {
      if (auth.restaurantId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Staff: require order:manage permission + restaurant scope
      const permErr = requirePerm(auth, 'order:manage', id)
      if (permErr) return permErr
    }

    const existing = await db.order.findFirst({
      where: { id: orderId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify branch access — a waiter at Branch A cannot update an order at Branch B.
    // (Customer tokens are checked below via sessionId matching.)
    if (auth.type !== 'customer') {
      const branchErr = verifyBranchAccess(auth, existing.branchId, id)
      if (branchErr) return branchErr
    }

    // Customers can only cancel their own orders (matched by sessionId)
    if (auth.type === 'customer' && auth.sessionId && existing.sessionId && auth.sessionId !== existing.sessionId) {
      return NextResponse.json({ error: 'Forbidden — you can only cancel your own order' }, { status: 403 })
    }

    const body = await request.json()
    const { status, cancellationReason, priority } = body

    // Allow priority-only updates (no status change required)
    if (priority && !status) {
      const validPriorities = ['normal', 'rush', 'vip']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: 'Invalid priority. Must be: normal, rush, or vip' },
          { status: 400 }
        )
      }

      const updated = await db.order.update({
        where: { id: orderId },
        data: { priority },
      })

      // Emit event so kitchen display updates
      emitEvent({
        type: 'order_status_changed',
        restaurantId: id,
        orderId,
        fromStatus: existing.status,
        toStatus: existing.status,
      })

      return NextResponse.json({ data: updated })
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      )
    }

    // Customers can only cancel orders (not change to other statuses)
    if (auth.type === 'customer' && status !== 'cancelled') {
      return NextResponse.json({ error: 'Forbidden — customers can only cancel orders' }, { status: 403 })
    }

    // Customers cannot cancel orders that have reached the kitchen (preparing or beyond)
    if (auth.type === 'customer' && status === 'cancelled' && ['preparing', 'ready', 'picked_up', 'served', 'paid', 'completed'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot cancel — order is already being prepared. Please contact the restaurant.' }, { status: 400 })
    }

    const validStatuses: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served', 'paid', 'completed', 'cancelled']
    if (!validStatuses.includes(status as OrderStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate state machine transition
    const currentStatus = existing.status as OrderStatus
    const newStatus = status as OrderStatus

    if (currentStatus === newStatus) {
      return NextResponse.json(
        { error: 'Order is already in this status' },
        { status: 400 }
      )
    }

    // Resolve effective permissions for this user (role defaults + overrides)
    // Fetch from DB to get the latest per-user permission overrides
    let userPermissions: string[] | null = null;
    try {
      const { resolveUserPermissions } = await import('@/lib/auth');
      const staffUser = await db.restaurantUser.findUnique({
        where: { id: auth.userId },
        select: {
          permissions: true,
          additionalPermissions: true,
          revokedPermissions: true,
        },
      });
      if (staffUser) {
        userPermissions = resolveUserPermissions(auth.role, {
          permissions: staffUser.permissions ? JSON.parse(staffUser.permissions) : undefined,
          additionalPermissions: staffUser.additionalPermissions ? JSON.parse(staffUser.additionalPermissions) : undefined,
          revokedPermissions: staffUser.revokedPermissions ? JSON.parse(staffUser.revokedPermissions) : undefined,
        });
      }
    } catch {
      // If we can't fetch permissions, fall back to role-based check
    }

    const canTransition = canTransitionOrder(
      currentStatus,
      newStatus,
      auth.role,
      userPermissions
    )

    if (!canTransition) {
      return NextResponse.json(
        { error: `Cannot transition order from "${currentStatus}" to "${newStatus}" with your role (${auth.role})` },
        { status: 400 }
      )
    }

    // Cancellation requires a reason (for staff; optional for customers)
    if (newStatus === 'cancelled' && auth.role !== 'customer' && auth.type !== 'customer' && !cancellationReason) {
      return NextResponse.json(
        { error: 'cancellationReason is required when cancelling an order' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = { status: newStatus }

    // Per-status timestamps for analytics and tracking
    if (newStatus === 'accepted') updateData.confirmedAt = new Date()
    if (newStatus === 'preparing') updateData.preparingAt = new Date()
    if (newStatus === 'ready') updateData.readyAt = new Date()
    if (newStatus === 'served') updateData.servedAt = new Date()
    if (newStatus === 'paid') updateData.paidAt = new Date()

    if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date()
      updateData.cancellationReason = cancellationReason
      updateData.cancelledBy = auth.userId
    }

    if (newStatus === 'completed') {
      updateData.completedAt = new Date()
    }

    // Track which waiter picked up the order
    if (newStatus === 'picked_up') {
      updateData.pickedUpBy = auth.userId
    }

    // Use transaction to update order and create event
    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      })

      // Create order event
      await tx.orderEvent.create({
        data: {
          orderId,
          restaurantId: id,
          branchId: order.branchId,
          event: 'status_change',
          fromStatus: currentStatus,
          toStatus: newStatus,
          data: JSON.stringify({
            cancellationReason: cancellationReason || null,
          }),
          performedBy: auth.userId,
          performedByType: 'staff',
        },
      })

      // If order is completed or cancelled, free up the table (dine-in only)
      if ((newStatus === 'completed' || newStatus === 'cancelled') && existing.tableId) {
        // Check if there are other active orders for this table
        const activeOrders = await tx.order.count({
          where: {
            tableId: existing.tableId,
            status: { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served', 'paid'] },
            id: { not: orderId },
          },
        })

        if (activeOrders === 0) {
          await tx.table.update({
            where: { id: existing.tableId },
            data: { status: 'available' },
          })
        }
      }

      return order
    })

    // Fetch the updated order with items
    const completeOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    // Emit real-time event for order status change
    emitEvent({
      type: 'order_status_changed',
      restaurantId: id,
      orderId,
      fromStatus: currentStatus,
      toStatus: newStatus,
    })

    // ── Audit Log for order cancellation ──
    if (newStatus === 'cancelled') {
      // Restore inventory stock for cancelled order
      restoreStockForOrder(id, orderId).catch((err) =>
        console.error('[STOCK_RESTORE_ERROR]', err)
      )

      logStaffAction({
        restaurantId: id,
        userId: auth.userId,
        performedByType: auth.type,
        action: 'order_cancelled',
        entityType: 'order',
        entityId: orderId,
        previousData: {
          status: currentStatus,
          orderNumber: existing.orderNumber,
        },
        newData: {
          status: newStatus,
          cancellationReason: cancellationReason || null,
          orderNumber: existing.orderNumber,
        },
      }).catch((err) => console.error('[AUDIT_ORDER_CANCEL]', err))

      // ── Notifications for order cancellation ──
      // Fetch table number and customer info for notification
      const orderForNotif = await db.order.findUnique({
        where: { id: orderId },
        include: {
          table: { select: { id: true, number: true } },
          customer: { select: { id: true, phone: true, email: true } },
        },
      })
      const tableNum = String(orderForNotif?.table?.number || '?')

      if (auth.role === 'customer' || auth.type === 'customer') {
        // Customer cancelled → notify restaurant staff
        notifyOrderCancelledByCustomer(
          id,
          existing.orderNumber,
          tableNum,
          cancellationReason || undefined
        ).catch((err) => console.error('[NOTIFY_ORDER_CANCELLED_BY_CUSTOMER]', err))
      } else {
        // Restaurant cancelled → notify the customer
        const customerPhone = orderForNotif?.customer?.phone || undefined
        const customerEmail = orderForNotif?.customer?.email || undefined
        notifyOrderCancelledByRestaurant(
          id,
          existing.orderNumber,
          tableNum,
          cancellationReason || 'No reason provided',
          customerPhone,
          customerEmail
        ).catch((err) => console.error('[NOTIFY_ORDER_CANCELLED_BY_RESTAURANT]', err))
      }
    }

    // Send notification when order is ready
    if (newStatus === 'ready') {
      // Try to get customer phone for SMS
      const orderWithCustomer = await db.order.findUnique({
        where: { id: orderId },
        include: { customer: { select: { phone: true } } },
      })
      notifyOrderReady(id, existing.orderNumber, orderWithCustomer?.customer?.phone || undefined).catch((err) =>
        console.error('[NOTIFY_ORDER_READY]', err)
      )

      // ⭐ Notify ALL assigned waiters that the order is ready for pickup
      const orderWithTable = await db.order.findUnique({
        where: { id: orderId },
        include: { table: { select: { id: true, number: true } } },
      })
      const tableNum = orderWithTable?.table?.number || (existing.type === 'takeaway' ? 'Takeaway' : '')
      notifyWaiterOrderReady(
        id,
        orderId,
        existing.orderNumber,
        existing.tableId || '',
        String(tableNum)
      ).then((waiterUserIds) => {
        // Emit a dedicated SSE event for the waiters
        emitEvent({
          type: 'waiter_order_ready',
          restaurantId: id,
          orderId,
          orderNumber: existing.orderNumber,
          tableId: existing.tableId || '',
          tableNumber: String(tableNum),
          waiterUserId: waiterUserIds[0] || undefined,
        })
      }).catch((err) =>
        console.error('[NOTIFY_WAITER_ORDER_READY]', err)
      )
    }

    // When waiter picks up order → notify customer that food is on its way
    if (newStatus === 'picked_up') {
      const pickupMessage = existing.type === 'takeaway'
        ? `Order ${existing.orderNumber} is ready for pickup!`
        : `Order ${existing.orderNumber} has been picked up by a waiter and is being delivered to your table.`
      await sendNotification({
        restaurantId: id,
        type: 'order_picked_up',
        title: existing.type === 'takeaway' ? 'Your takeaway is ready!' : 'Your order is on its way!',
        message: pickupMessage,
        data: { orderId, orderNumber: existing.orderNumber },
        channels: ['in_app'],
      }).catch((err) =>
        console.error('[NOTIFY_ORDER_PICKED_UP]', err)
      )
    }

    // Emit table_status_changed when table status actually changes (dine-in only)
    // Only emit if the table was actually freed (no other active orders remain)
    if ((newStatus === 'completed' || newStatus === 'cancelled') && existing.tableId) {
      // Check if there are other active orders for this table
      const activeOrders = await db.order.count({
        where: {
          tableId: existing.tableId,
          status: { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served', 'paid'] },
          id: { not: orderId },
        },
      })

      if (activeOrders === 0) {
        emitEvent({
          type: 'table_status_changed',
          restaurantId: id,
          tableId: existing.tableId,
          fromStatus: 'occupied',
          toStatus: 'available',
        })
      }
    }

    // Credit loyalty points when order is completed
    if (newStatus === 'completed') {
      creditLoyaltyPoints(orderId, id).catch((err) =>
        console.error('[LOYALTY_CREDIT_ERROR]', err)
      )
    }

    // Trigger async analytics re-aggregation for completed/cancelled/served orders
    // These statuses change analytics data, so the daily summary needs to be refreshed.
    if (newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'served') {
      triggerReaggregation(id)
    }

    // Fire-and-forget: notify external integrations of status change (incl. cancellation).
    dispatchPOSWebhook(id, 'order.status_changed', {
      orderId,
      previousStatus: currentStatus,
      newStatus,
      ...(newStatus === 'cancelled' && cancellationReason ? { cancellationReason } : {}),
      order: completeOrder,
    }).catch((err) => console.error('[POS_WEBHOOK_ORDER_STATUS]', err))

    return NextResponse.json({ data: completeOrder })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ORDER_UPDATE]', error)
    // Provide more specific error messages for debugging
    const message = error instanceof Error ? error.message : 'Failed to update order'
    return NextResponse.json(
      { error: message || 'Failed to update order' },
      { status: 500 }
    )
  }
}
