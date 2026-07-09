// ============================================================
// Yene QR — Orders API (List & Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, requireAnyPerm, resolveBranchScope } from '@/lib/api-auth'
import { generateOrderNumber, canTransitionOrder, type OrderStatus } from '@/lib/orders'
import { emitEvent } from '@/lib/realtime'
import { notifyNewOrder } from '@/lib/notifications'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'
import { calculatePointsEarned, calculatePointsWithTierBonus, DEFAULT_LOYALTY_CONFIG } from '@/lib/loyalty'
import { toCents, fromCents, calculateDiscountAmountCents, calculateOrderTotalsCents } from '@/lib/money'
import { getLeastBusyWaiterForTableWithAudit, type WaiterAssignmentDecision } from '@/lib/waiter-assignment'
import { resolveOrderRoutingMode } from '@/lib/order-routing'
import { dispatchPOSWebhook } from '@/lib/pos-webhook'

/**
 * GET /api/restaurants/[id]/orders
 * List orders for a restaurant.
 * Query params: status, branchId, tableId, dateFrom, dateTo, page, limit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse searchParams BEFORE using them (fixes ReferenceError in customer branch)
    const { searchParams } = new URL(request.url)

    // Customer tokens can only view orders for their own table
    if (auth.type === 'customer') {
      // Customer can only see orders for their table (tableId filter is required)
      if (!searchParams.has('tableId') || auth.restaurantId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // Only allow viewing active/pending orders (not completed/cancelled historical data)
      const requestedStatus = searchParams.get('status')
      if (requestedStatus && requestedStatus !== 'active' && !['pending', 'accepted', 'preparing', 'ready', 'served'].includes(requestedStatus)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Staff: require order:view permission + restaurant scope
      const permErr = requirePerm(auth, 'order:view', id)
      if (permErr) return permErr
    }

    // Verify restaurant exists
    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }
    const status = searchParams.get('status') || undefined
    // SECURITY (Phase 2.3): Use resolveBranchScope instead of raw searchParams.
    // For branch-scoped roles (waiter, kitchen_staff, cashier) and customers,
    // this ignores the client-supplied branchId and forces auth.branchId,
    // closing the all-branch data leak when ?branchId= is omitted.
    // For owners/managers (branch:view_all) and platform admins, the client-
    // supplied branchId is respected (or undefined = all branches).
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const tableId = searchParams.get('tableId') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId: id }
    if (status) {
      // "active" is a special pseudo-status meaning any non-completed, non-cancelled order
      if (status === 'active') {
        where.status = { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served', 'paid'] }
      } else {
        where.status = status
      }
    }
    if (branchId) {
      where.branchId = branchId
    }
    if (tableId) {
      where.tableId = tableId
    }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, unknown> = {}
      if (dateFrom) {
        createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        createdAt.lte = new Date(dateTo)
      }
      where.createdAt = createdAt
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          table: {
            select: { id: true, number: true, status: true },
          },
          customer: {
            select: { id: true, name: true, phone: true },
          },
          items: {
            include: {
              menuItem: {
                select: { id: true, name: true, image: true, category: { select: { id: true, name: true } } },
              },
              modifierSelections: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          payments: {
            select: { id: true, amountCents: true, status: true, method: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { items: true, payments: true },
          },
        },
      }),
      db.order.count({ where }),
    ])

    return NextResponse.json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[ORDERS_LIST]', error)
    const errorDetail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
        detail: process.env.NODE_ENV === 'development' ? errorDetail : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/orders
 * Create a new order (from customer session or staff).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ── Rate Limiting ──
    const clientIp = getClientIp(request)
    const rateLimitKey = `orderCreate:${clientIp}:${id}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.orderCreate)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many order requests. Please try again later.', retryAfterMs: rateLimitResult.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const auth = requireAuth(request)

    // Check access — customers use 'customer:order', staff uses 'order:create'
    const permErr = requireAnyPerm(auth, ['order:create', 'customer:order'], id)
    if (permErr) return permErr

    // Verify restaurant exists and is active
    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }
    if (!restaurant.isActive) {
      return NextResponse.json(
        { error: 'Cannot create orders for an inactive restaurant' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      branchId,
      tableId,
      sessionId,
      customerId,
      customerName,
      customerPhone,
      type: orderType,
      guestCount,
      items,
      specialInstructions,
      scheduledFor,
      promotionCode,
    } = body

    // Validate and normalize order type
    const effectiveOrderType = orderType || 'dine_in'
    if (!['dine_in', 'takeaway', 'scheduled'].includes(effectiveOrderType)) {
      return NextResponse.json(
        { error: 'Invalid order type. Must be dine_in, takeaway, or scheduled.' },
        { status: 400 }
      )
    }

    // ── Validate order type against restaurant settings ──
    let restaurantSettings: Record<string, unknown> | null = null
    try {
      restaurantSettings = restaurant.settings ? JSON.parse(restaurant.settings) : null
    } catch { /* ignore parse errors */ }
    const orderTypeSettings = restaurantSettings?.orderTypes as Record<string, boolean> | undefined
    if (orderTypeSettings) {
      if (effectiveOrderType === 'dine_in' && orderTypeSettings.dineIn === false) {
        return NextResponse.json(
          { error: 'Dine-in ordering is not available for this restaurant.' },
          { status: 400 }
        )
      }
      if (effectiveOrderType === 'takeaway' && orderTypeSettings.takeaway === false) {
        return NextResponse.json(
          { error: 'Takeaway ordering is not available for this restaurant.' },
          { status: 400 }
        )
      }
    }

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }

    // ── Customer session ↔ body branch cross-check ──
    // SECURITY: A customer holding a JWT for Branch A could previously swap
    // `branchId` in the POST body to land an order at Branch B of the same
    // restaurant. The branch-exists check below would pass (Branch B is a
    // real branch), and the order would be created at Branch B. This block
    // closes that hole by rejecting any mismatch between the customer's
    // session branch/table and the requested branch/table.
    if (auth.type === 'customer') {
      if (auth.branchId && auth.branchId !== branchId) {
        return NextResponse.json(
          { error: 'Forbidden — branch mismatch with customer session' },
          { status: 403 }
        )
      }
      if (tableId && auth.tableId && auth.tableId !== tableId) {
        return NextResponse.json(
          { error: 'Forbidden — table mismatch with customer session' },
          { status: 403 }
        )
      }
    }

    // tableId is required for dine_in, optional for takeaway
    if (effectiveOrderType === 'dine_in' && !tableId) {
      return NextResponse.json(
        { error: 'tableId is required for dine-in orders' },
        { status: 400 }
      )
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      )
    }

    // Verify branch belongs to this restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId: id, isActive: true },
    })
    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found or inactive' },
        { status: 404 }
      )
    }

    // ── Resolve order routing mode (restaurant- or branch-controlled) ──
    // 'waiter_first'      → order stays in 'pending' until a waiter/manager accepts it
    // 'direct_to_kitchen' → order auto-accepts to 'accepted' so kitchen can start cooking
    const routingMode = await resolveOrderRoutingMode(id, branchId)
    const directToKitchen = routingMode === 'direct_to_kitchen'

    // Verify table exists and belongs to the branch (required for dine-in, optional for takeaway)
    let table: { id: string; number: string; status: string } | null = null
    if (tableId) {
      const foundTable = await db.table.findFirst({
        where: { id: tableId, branchId, isActive: true },
      })
      if (!foundTable) {
        return NextResponse.json(
          { error: 'Table not found or inactive' },
          { status: 404 }
        )
      }
      table = foundTable
    }

    // ── Duplicate Order Prevention ──
    // Prevent rapid-fire duplicate orders from the same table/session
    const duplicateWhere: Record<string, unknown> = {
      restaurantId: id,
      sessionId: sessionId || undefined,
      status: { in: ['pending', 'accepted', 'preparing'] },
      createdAt: { gte: new Date(Date.now() - 30_000) },
    }
    if (tableId) {
      duplicateWhere.tableId = tableId
    }
    const recentDuplicate = await db.order.findFirst({ where: duplicateWhere })
    if (recentDuplicate) {
      return NextResponse.json(
        { error: 'An order was just placed for this table. Please wait a moment.', orderId: recentDuplicate.id },
        { status: 409 }
      )
    }

    // ── Auto-assign waiter using least-busy algorithm (dine-in only) ──
    // Uses workload balancing: considers assigned tables + active orders.
    // Returns the decision context (candidates + their loads) so we can
    // log an audit trail in OrderEvent explaining WHY this waiter was chosen.
    let assignedWaiter: { userId: string } | null = null
    let waiterAssignmentDecision: WaiterAssignmentDecision | null = null
    if (tableId) {
      waiterAssignmentDecision = await getLeastBusyWaiterForTableWithAudit(id, tableId)
      assignedWaiter = waiterAssignmentDecision.waiter
        ? { userId: waiterAssignmentDecision.waiter.userId }
        : null
    }

    // Validate all items and fetch menu item details
    const menuItemIds = items.map((item: { menuItemId: string }) => item.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId: id,
        isAvailable: true,
      },
      include: {
        category: {
          select: { menuId: true },
        },
      },
    })

    // Validate all items exist and are available
    for (const item of items) {
      const menuItem = menuItems.find((mi) => mi.id === item.menuItemId)
      if (!menuItem) {
        return NextResponse.json(
          { error: `Menu item ${item.menuItemId} not found or unavailable` },
          { status: 400 }
        )
      }
    }

    // Calculate totals
    let subtotalCents = 0
    const orderItemsData: Array<{
      menuItemId: string
      name: string
      nameAm: string | null
      priceCents: number
      quantity: number
      specialInstructions: string | null
      removedIngredients: string | null
      kitchenStatus: string
      modifierSelections: Array<{
        modifierGroupId: string
        modifierOptionId: string
        name: string
        priceDeltaCents: number
        quantity: number
      }>
    }> = []

    for (const item of items) {
      const menuItem = menuItems.find((mi) => mi.id === item.menuItemId)!

      // Calculate modifier price deltas (in cents)
      let modifierTotalCents = 0
      const modifierSelections: Array<{
        modifierGroupId: string
        modifierOptionId: string
        name: string
        priceDeltaCents: number
        quantity: number
      }> = []

      if (item.modifiers && Array.isArray(item.modifiers)) {
        // Fetch the actual modifier options from the DB to validate prices
        const modifierOptionIds = item.modifiers
          .map((mod: { modifierOptionId: string }) => mod.modifierOptionId)
          .filter(Boolean)

        const dbModifierOptions = modifierOptionIds.length > 0
          ? await db.modifierOption.findMany({
              where: { id: { in: modifierOptionIds } },
              select: { id: true, priceDeltaCents: true, name: true, modifierGroupId: true, isActive: true },
            })
          : []

        for (const mod of item.modifiers) {
          // Validate against server-side data
          const dbOption = dbModifierOptions.find((o) => o.id === mod.modifierOptionId)
          if (dbOption) {
            if (!dbOption.isActive) {
              return NextResponse.json(
                { error: `Modifier option ${mod.modifierOptionId} is no longer available` },
                { status: 400 }
              )
            }
            // Use server-side price (cents), not client-supplied
            modifierTotalCents += dbOption.priceDeltaCents * (mod.quantity || 1)
            modifierSelections.push({
              modifierGroupId: dbOption.modifierGroupId,
              modifierOptionId: mod.modifierOptionId,
              name: dbOption.name,
              priceDeltaCents: dbOption.priceDeltaCents,
              quantity: Math.max(1, Math.min(99, Math.floor(mod.quantity || 1))),
            })
          } else {
            // Modifier option not found in DB — reject
            return NextResponse.json(
              { error: `Invalid modifier option: ${mod.modifierOptionId}` },
              { status: 400 }
            )
          }
        }
      }

      const itemPriceCents = menuItem.priceCents + modifierTotalCents
      const rawQuantity = item.quantity || 1
      if (typeof rawQuantity !== 'number' || rawQuantity < 1 || rawQuantity > 99 || !Number.isInteger(rawQuantity)) {
        return NextResponse.json(
          { error: `Invalid quantity for item ${item.menuItemId}. Must be an integer between 1 and 99.` },
          { status: 400 }
        )
      }
      const quantity = rawQuantity
      subtotalCents += itemPriceCents * quantity

      // Snapshot removed ingredients for kitchen display
      let removedIngredientsJson: string | null = null
      if (item.removedIngredients && Array.isArray(item.removedIngredients) && item.removedIngredients.length > 0) {
        removedIngredientsJson = JSON.stringify(item.removedIngredients)
      }

      orderItemsData.push({
        menuItemId: item.menuItemId,
        name: menuItem.name,
        nameAm: menuItem.nameAm,
        priceCents: menuItem.priceCents,
        quantity,
        specialInstructions: item.specialInstructions || null,
        removedIngredients: removedIngredientsJson,
        kitchenStatus: 'pending',
        modifierSelections,
      })
    }

    // Tax and service charge will be calculated after discount using calculateOrderTotalsCents

    // ── Promotion Validation & Discount Calculation ──
    let discountAmountCents = 0
    let promotionId: string | null = null

    if (promotionCode) {
      const promotion = await db.promotion.findFirst({
        where: {
          restaurantId: id,
          code: promotionCode.toUpperCase(),
          isActive: true,
        },
      })

      if (promotion) {
        const now = new Date()
        const validFrom = new Date(promotion.validFrom)
        const validUntil = new Date(promotion.validUntil)

        if (now < validFrom || now > validUntil) {
          return NextResponse.json(
            { error: 'Promotion code has expired or is not yet active' },
            { status: 400 }
          )
        }

        if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
          return NextResponse.json(
            { error: 'Promotion code has reached its usage limit' },
            { status: 400 }
          )
        }

        if (promotion.minimumOrderCents && subtotalCents < promotion.minimumOrderCents) {
          return NextResponse.json(
            { error: `Minimum order amount for this promotion is ${fromCents(promotion.minimumOrderCents)} ETB` },
            { status: 400 }
          )
        }

        // Per-customer limit check
        if (promotion.perCustomerLimit && customerId) {
          const customerUsageCount = await db.order.count({
            where: {
              restaurantId: id,
              customerId,
              discountAmountCents: { gt: 0 },
            },
          })
          // More accurate: count orders where the promotion was applied
          // For now, we use a pragmatic approach: if perCustomerLimit exists,
          // count orders for this customer with discounts
          if (customerUsageCount >= promotion.perCustomerLimit) {
            return NextResponse.json(
              { error: 'You have reached the usage limit for this promotion' },
              { status: 400 }
            )
          }
        }

        // Check applicable items if specified
        if (promotion.applicableItems) {
          let applicableItemIds: string[] = []
          try {
            applicableItemIds = JSON.parse(promotion.applicableItems)
          } catch {
            applicableItemIds = []
          }
          if (applicableItemIds.length > 0) {
            const orderedItemIds = items.map((item: { menuItemId: string }) => item.menuItemId)
            const hasApplicableItem = orderedItemIds.some((iid: string) => applicableItemIds.includes(iid))
            if (!hasApplicableItem) {
              return NextResponse.json(
                { error: 'This promotion is not applicable to items in your order' },
                { status: 400 }
              )
            }
          }
        }

        // Calculate discount using cents-aware helper
        discountAmountCents = calculateDiscountAmountCents(
          subtotalCents,
          promotion.discountValueCents,
          promotion.discountType,
          promotion.maxDiscountCents
        )

        promotionId = promotion.id
      } else {
        return NextResponse.json(
          { error: 'Invalid promotion code' },
          { status: 400 }
        )
      }
    }

    // ── Calculate Packaging Charge for Takeaway ──
    let packagingChargeCents = 0
    if (effectiveOrderType === 'takeaway') {
      // Read packaging fee from restaurant settings
      const packagingSettings = restaurantSettings?.packaging as Record<string, unknown> | undefined
      if (packagingSettings?.enabled !== false) {
        // Packaging fee can be per-order or per-item
        const feeType = (packagingSettings?.feeType as string) || 'per_order'
        const feeCents = typeof packagingSettings?.feeCents === 'number'
          ? packagingSettings.feeCents
          : 0 // Default: no packaging fee unless configured
        if (feeType === 'per_item') {
          const totalItems = orderItemsData.reduce((sum, i) => sum + i.quantity, 0)
          packagingChargeCents = feeCents * totalItems
        } else {
          packagingChargeCents = feeCents
        }
      }
    }

    // Calculate order totals in cents (includes packaging charge)
    const { taxAmountCents, serviceChargeCents, totalAmountCents } = calculateOrderTotalsCents({
      subtotalCents,
      taxRate: restaurant.taxRate,
      serviceChargeRate: restaurant.serviceCharge,
      discountAmountCents,
      tipAmountCents: 0,
      packagingChargeCents,
    })

    // Create order with items in a transaction (order number generated atomically inside)
    // Retry up to 3 times on order number collision (handles concurrent orders gracefully)
    let order: Awaited<ReturnType<typeof db.order.create>> | null = null
    let lastOrderError: unknown = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await db.$transaction(async (tx) => {
          // Generate order number atomically inside transaction
          const lastOrder = await tx.order.findFirst({
            where: { restaurantId: id },
            orderBy: { createdAt: 'desc' },
            select: { orderNumber: true },
          })

          let orderNumber: string
          if (lastOrder?.orderNumber) {
            const lastNum = parseInt(lastOrder.orderNumber.replace('#', ''), 10)
            orderNumber = `#${String(lastNum + 1 + attempt).padStart(4, '0')}`
          } else {
            orderNumber = '#0001'
          }

          const newOrder = await tx.order.create({
        data: {
          restaurantId: id,
          branchId,
          tableId: tableId || null,
          sessionId: sessionId || null,
          customerId: customerId || null,
          orderNumber,
          tableNumber: table?.number || null,
          type: effectiveOrderType,
          // Order routing flag: 'direct_to_kitchen' skips the waiter-accept step
          // by creating the order directly in 'accepted' state. The transition
          // pending → accepted is normally gated by order:manage, but when the
          // restaurant has configured direct-to-kitchen routing, the system
          // performs the transition atomically inside this transaction
          // (see OrderEvent below). The state-machine guard in
          // src/lib/orders.ts is NOT bypassed at runtime — the system itself
          // is the actor, and the audit trail captures both steps.
          status: directToKitchen ? 'accepted' : 'pending',
          guestCount: guestCount && guestCount > 0 ? guestCount : 1,
          waiterId: assignedWaiter?.userId || null,
          priority: table?.isVip ? 'vip' : (body.priority || 'normal'),
          subtotalCents,
          taxAmountCents,
          serviceChargeCents,
          packagingChargeCents,
          discountAmountCents,
          tipAmountCents: 0,
          totalAmountCents,
          specialInstructions: specialInstructions || null,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          promotionId: promotionId || null,
          promotionCode: promotionCode ? promotionCode.toUpperCase() : null,
          roundNumber: 1,
        },
      })

      // Create order items
      for (const itemData of orderItemsData) {
        const { modifierSelections: mods, ...itemFields } = itemData
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            restaurantId: id,
            branchId: branchId,  // Denormalized from Order for branch-scoped queries
            menuItemId: itemFields.menuItemId,
            name: itemFields.name,
            nameAm: itemFields.nameAm,
            priceCents: itemFields.priceCents,
            quantity: itemFields.quantity,
            specialInstructions: itemFields.specialInstructions,
            removedIngredients: itemFields.removedIngredients,
            kitchenStatus: itemFields.kitchenStatus,
          },
        })

        // Create modifier selections
        if (mods && mods.length > 0) {
          await tx.orderItemModifier.createMany({
            data: mods.map((mod) => ({
              orderItemId: orderItem.id,
              ...mod,
            })),
          })
        }
      }

      // Create initial order event
      await tx.orderEvent.create({
        data: {
          orderId: newOrder.id,
          restaurantId: id,
          branchId: newOrder.branchId,
          event: 'status_change',
          fromStatus: null,
          toStatus: 'pending',
          data: JSON.stringify({
            orderNumber,
            itemCount: items.length,
            totalAmountCents,
            source: auth.type === 'staff' ? 'staff_on_behalf' : 'customer',
            customerName: customerName || null,
            customerPhone: customerPhone || null,
          }),
          performedBy: auth.userId,
          performedByType: 'staff',
        },
      })

      // ── Log waiter auto-assignment decision (audit trail) ──
      // Records WHY this waiter was chosen — the candidates considered,
      // their loads at decision time, and the selection reason. Makes the
      // load-balancing decision visible in the Order Events Timeline so
      // managers can answer "why did this order go to Sara instead of Abebe?"
      if (waiterAssignmentDecision && waiterAssignmentDecision.waiter) {
        await tx.orderEvent.create({
          data: {
            orderId: newOrder.id,
            restaurantId: id,
            branchId: newOrder.branchId,
            event: 'waiter_assigned',
            fromStatus: null,
            toStatus: null,
            data: JSON.stringify({
              waiterId: waiterAssignmentDecision.waiter.userId,
              waiterName: waiterAssignmentDecision.waiter.name,
              reason: waiterAssignmentDecision.reason,
              candidates: waiterAssignmentDecision.candidates,
              algorithm: 'least_busy',
            }),
            performedBy: null,           // System decision, not a human action
            performedByType: 'system',
          },
        })
      } else if (waiterAssignmentDecision && waiterAssignmentDecision.reason === 'no_waiters_available') {
        // Log when no waiter could be assigned (all deactivated, or no waiters in branch)
        await tx.orderEvent.create({
          data: {
            orderId: newOrder.id,
            restaurantId: id,
            branchId: newOrder.branchId,
            event: 'waiter_assignment_failed',
            fromStatus: null,
            toStatus: null,
            data: JSON.stringify({
              reason: 'no_waiters_available',
              message: 'No active waiters available for this table/branch',
            }),
            performedBy: null,
            performedByType: 'system',
          },
        })
      }

      // ── Direct-to-kitchen routing: system auto-accepts the order ──
      // Instead of waiting for a waiter/manager to click "Accept", the system
      // performs the pending → accepted transition atomically. This is logged
      // as a separate OrderEvent so the audit trail is unambiguous — you can
      // always tell which orders went through a human acceptance step vs
      // which were auto-fired by the routing policy.
      if (directToKitchen) {
        await tx.orderEvent.create({
          data: {
            orderId: newOrder.id,
            restaurantId: id,
            branchId: newOrder.branchId,
            event: 'status_change',
            fromStatus: 'pending',
            toStatus: 'accepted',
            data: JSON.stringify({
              reason: 'direct_to_kitchen_routing',
              routingMode: 'direct_to_kitchen',
              autoAccept: true,
            }),
            performedBy: null,           // No human actor — system transition
            performedByType: 'system',
          },
        })
      }

      // Update table status to occupied (dine-in only)
      if (tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: 'occupied' },
        })
      }

      // Increment promotion usage count
      if (promotionId) {
        await tx.promotion.update({
          where: { id: promotionId },
          data: { usageCount: { increment: 1 } },
        })
      }

      return newOrder
    })
        break // Success — exit retry loop
      } catch (err: unknown) {
        lastOrderError = err
        // Check if this is a unique constraint violation on orderNumber
        const isPrismaUniqueError = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002'
        if (isPrismaUniqueError && attempt < 2) {
          // Retry with a different order number
          continue
        }
        // Not a unique constraint error, or exhausted retries — throw
        throw err
      }
    }

    if (!order) {
      throw lastOrderError || new Error('Failed to create order after retries')
    }

    // Fetch the complete order with items
    const completeOrder = await db.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, image: true, priceCents: true },
            },
            modifierSelections: true,
          },
        },
        table: {
          select: { id: true, number: true },
        },
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
    })

    // Emit real-time event for new order
    emitEvent({
      type: 'new_order',
      restaurantId: id,
      branchId: branchId || undefined,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: tableId || null,
      tableNumber: table?.number || null,
      orderType: effectiveOrderType,
      // Include routing mode so the dashboard can show a "direct to kitchen"
      // badge on the order card without an extra round-trip.
      routingMode,
      // Final status after routing-mode resolution (pending or accepted).
      // Waiter-view filters on status; this lets it correctly hide the
      // "Accept" button for already-accepted orders.
      status: directToKitchen ? 'accepted' : 'pending',
    })

    // When direct-to-kitchen routing is enabled, also fire a dedicated
    // kitchen_new_order event. This lets the kitchen-view play its new-order
    // chime + highlight animation for orders that bypassed the waiter step,
    // without requiring kitchen-view to also subscribe to 'new_order'.
    if (directToKitchen) {
      emitEvent({
        type: 'kitchen_new_order',
        restaurantId: id,
        branchId: branchId || undefined,
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableId: tableId || null,
        tableNumber: table?.number || null,
        orderType: effectiveOrderType,
        autoAccepted: true,
      })
    }

    // Emit table_status_changed event (dine-in only — table became occupied)
    if (tableId && table) {
      emitEvent({
        type: 'table_status_changed',
        restaurantId: id,
        branchId: branchId || undefined,
        tableId: tableId,
        fromStatus: 'available',
        toStatus: 'occupied',
      })
    }

    // Send push/in-app notification for new order
    // BUG FIX: previously called without branchId, so the notification was
    // broadcast restaurant-wide and staff at Branch B would get paged for
    // an order at Branch A. Now correctly scoped to the originating branch.
    const tableLabel = table ? `Table ${table.number}` : (effectiveOrderType === 'takeaway' ? 'Takeaway' : 'N/A')
    notifyNewOrder(id, order.orderNumber, tableLabel, branchId).catch((err) =>
      console.error('[NOTIFY_NEW_ORDER]', err)
    )

    // ── Auto-deduct inventory stock for this order ──
    // Run asynchronously — deduction failure should not affect order creation
    import('@/lib/inventory-watchdog').then(({ deductStockForOrder }) => {
      deductStockForOrder(id, order.id).catch((err) =>
        console.error('[STOCK_DEDUCTION_ERROR]', err)
      )
    })

    // ── Auto-create/link customer and credit loyalty points ──
    let resolvedCustomerId = customerId || null
    let loyaltyPointsEarned = 0

    // Determine the effective session ID: prefer auth.sessionId, fall back to body sessionId
    const effectiveSessionId = auth.sessionId || sessionId || null

    try {
      // If no explicit customerId, try to find or create one from the session or staff-provided info
      if (!resolvedCustomerId && effectiveSessionId) {
        const session = await db.customerSession.findUnique({
          where: { id: effectiveSessionId },
          include: { customer: true },
        })

        if (session?.customer) {
          resolvedCustomerId = session.customer.id
        } else if (session) {
          // Auto-create an anonymous customer linked to this session
          const newCustomer = await db.customer.create({
            data: {
              restaurantId: id,
              language: session.language || 'en',
              name: customerName || null,
              phone: customerPhone || null,
            },
          })
          await db.customerSession.update({
            where: { id: session.id },
            data: { customerId: newCustomer.id },
          })
          resolvedCustomerId = newCustomer.id
        }
      }

      // Staff-initiated order: create/find customer by name/phone if provided
      if (!resolvedCustomerId && auth.type === 'staff' && (customerName || customerPhone)) {
        // Try to find existing customer by phone first
        if (customerPhone) {
          const existingCustomer = await db.customer.findFirst({
            where: { restaurantId: id, phone: customerPhone },
          })
          if (existingCustomer) {
            // Update name if provided and different
            if (customerName && existingCustomer.name !== customerName) {
              await db.customer.update({
                where: { id: existingCustomer.id },
                data: { name: customerName },
              })
            }
            resolvedCustomerId = existingCustomer.id
          }
        }

        // If not found, create a new customer
        if (!resolvedCustomerId) {
          const newCustomer = await db.customer.create({
            data: {
              restaurantId: id,
              name: customerName || null,
              phone: customerPhone || null,
              language: 'en',
            },
          })
          resolvedCustomerId = newCustomer.id
        }
      }

      // Credit loyalty points if we have a customer
      if (resolvedCustomerId) {
        const customer = await db.customer.findFirst({
          where: { id: resolvedCustomerId, restaurantId: id },
        })

        if (customer) {
          // Calculate points with tier bonus
          // calculatePointsWithTierBonus expects ETB amount, convert from cents
          loyaltyPointsEarned = calculatePointsWithTierBonus(
            fromCents(totalAmountCents),
            customer.loyaltyPoints
          )

          // Check for welcome bonus (first order)
          const previousOrders = await db.order.count({
            where: { customerId: resolvedCustomerId },
          })

          const welcomeBonus = previousOrders === 0
            ? DEFAULT_LOYALTY_CONFIG.welcomeBonus
            : 0

          const totalPointsToCredit = loyaltyPointsEarned + welcomeBonus

          if (totalPointsToCredit > 0) {
            await db.customer.update({
              where: { id: resolvedCustomerId },
              data: { loyaltyPoints: { increment: totalPointsToCredit } },
            })
          }

          // Link customer to the order if not already linked
          if (!order.customerId) {
            await db.order.update({
              where: { id: order.id },
              data: { customerId: resolvedCustomerId },
            })
          }
        }
      }
    } catch (loyaltyError) {
      // Don't fail the order if loyalty crediting fails
      console.error('[LOYALTY_CREDIT_ERROR]', loyaltyError)
    }

    // Phase R4: Calculate estimated wait time based on current kitchen load
    // Formula: (items ahead in queue × avg prep time) / num stations + max item prep time
    // This is a rough estimate — not exact, but gives customers a reasonable expectation
    let estimatedWaitMinutes: number | undefined
    try {
      // Count currently active items (pending + preparing) at this branch
      const activeItemsCount = await db.orderItem.count({
        where: {
          restaurantId: id,
          branchId,
          kitchenStatus: { in: ['pending', 'preparing'] },
        },
      })

      // Count kitchen stations at this branch (parallel cooking capacity)
      const stationCount = await db.kitchenStation.count({
        where: { branchId, isActive: true },
      })
      const effectiveStations = Math.max(1, stationCount)

      // Get the max preparationTime of items in THIS order (they cook in parallel)
      const menuItemIds = completeOrder.items
        ?.map((oi: { menuItemId?: string | null }) => oi.menuItemId)
        .filter(Boolean) as string[] || []

      let maxItemPrepTime = 15 // default 15 min
      if (menuItemIds.length > 0) {
        const menuItems = await db.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: { preparationTime: true },
        })
        maxItemPrepTime = Math.max(...menuItems.map((m) => m.preparationTime), 15)
      }

      // Items ahead in queue (the items already in the kitchen before this order)
      const itemsAhead = Math.max(0, activeItemsCount)
      // Average prep time per item (use 10 min as a reasonable average)
      const avgPrepTimePerItem = 10
      // Queue delay = items ahead × avg prep time / stations (parallel cooking)
      const queueDelay = Math.ceil((itemsAhead * avgPrepTimePerItem) / effectiveStations)
      // Total estimated wait = queue delay + this order's max item prep time
      estimatedWaitMinutes = queueDelay + maxItemPrepTime
    } catch (waitTimeError) {
      // Don't fail the order if wait time calculation fails
      console.error('[WAIT_TIME_CALC_ERROR]', waitTimeError)
    }

    // Fire-and-forget: notify external integrations (Mini ERP, POS, etc.)
    // Not awaited so it doesn't block the order response.
    dispatchPOSWebhook(id, 'order.created', completeOrder).catch((err) =>
      console.error('[POS_WEBHOOK_ORDER_CREATED]', err)
    )

    return NextResponse.json({
      data: completeOrder,
      meta: {
        loyaltyPointsEarned,
        routingMode,
        // Tell the client what status the order landed in so the UI can
        // show "Your order is being prepared" instead of "Waiting for
        // waiter to accept" when direct_to_kitchen is on.
        directToKitchen,
        ...(estimatedWaitMinutes !== undefined ? { estimatedWaitMinutes } : {}),
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ORDER_CREATE]', error)
    // Include error details in development for easier debugging
    const errorDetail = error instanceof Error ? error.message : String(error)
    const prismaMeta = error && typeof error === 'object' && 'meta' in error ? (error as { meta: unknown }).meta : undefined
    return NextResponse.json(
      {
        error: 'Failed to create order',
        detail: process.env.NODE_ENV === 'development' ? errorDetail : undefined,
        meta: process.env.NODE_ENV === 'development' ? prismaMeta : undefined,
      },
      { status: 500 }
    )
  }
}
