// ============================================================
// Yene QR — Waiter Calls API (List, Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requireAnyPerm, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'
import { notifyWaiterCall } from '@/lib/notifications'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'
import { getWaitersForTable } from '@/lib/waiter-assignment'

/**
 * GET /api/restaurants/[id]/waiter-calls
 * List pending waiter calls for a restaurant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require restaurant:view permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') || 'pending'
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Record<string, unknown> = { restaurantId }

    // Parse status filter — support comma-separated values for Prisma `in` clause
    if (statusParam) {
      const statusValues = statusParam.split(',').map((s) => s.trim()).filter(Boolean)
      if (statusValues.length === 1) {
        where.status = statusValues[0]
      } else if (statusValues.length > 1) {
        where.status = { in: statusValues }
      }
    }
    if (branchId) where.branchId = branchId

    const calls = await db.waiterCall.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        table: {
          select: { id: true, number: true },
        },
      },
    })

    // Count pending — respect branchId filter if provided
    const pendingWhere: Record<string, unknown> = { restaurantId, status: 'pending' }
    if (branchId) pendingWhere.branchId = branchId
    const pendingCount = await db.waiterCall.count({
      where: pendingWhere,
    })

    return NextResponse.json({
      data: calls,
      pendingCount,
    })
  } catch (error) {
    console.error('[WAITER_CALLS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch waiter calls' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/waiter-calls
 * Create a waiter call (from customer session).
 * Body: { branchId, tableId, sessionId?, requestType, message? }
 *
 * SECURITY: This endpoint previously had NO authentication — only an IP
 * rate limit. Anyone on the internet who knew a (restaurantId, branchId,
 * tableId) triple could trigger fraudulent waiter-call notifications.
 *
 * Now requires:
 *   - Valid Bearer token (customer or staff)
 *   - For customer tokens: auth.branchId === body.branchId AND
 *     auth.tableId === body.tableId AND auth.restaurantId === restaurantId
 *     (prevents a customer at Branch A from calling waiters at Branch B)
 *   - For staff tokens: 'customer:call_waiter' OR 'customer:request_bill'
 *     permission (waiters/managers can trigger calls on behalf of customers)
 *     plus restaurant scope.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // ── Rate Limiting (kept first to preserve DDoS protection) ──
    const clientIp = getClientIp(request)
    const rateLimitKey = `waiterCall:${clientIp}:${restaurantId}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.api)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many waiter call requests. Please try again later.', retryAfterMs: rateLimitResult.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)) } }
      )
    }

    // ── Auth (was previously MISSING — critical security fix) ──
    const auth = requireAuth(request)

    const body = await request.json()
    const { branchId, tableId, sessionId, requestType = 'call_waiter', message } = body as {
      branchId: string
      tableId: string
      sessionId?: string
      requestType?: string
      message?: string
    }

    if (!branchId || !tableId) {
      return NextResponse.json(
        { error: 'branchId and tableId are required' },
        { status: 400 }
      )
    }

    // ── Branch + table cross-check against the customer's session token ──
    // A customer at Branch A cannot trigger waiter calls for Branch B.
    if (auth.type === 'customer') {
      if (auth.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (auth.branchId && auth.branchId !== branchId) {
        return NextResponse.json(
          { error: 'Forbidden — branch mismatch with customer session' },
          { status: 403 }
        )
      }
      if (auth.tableId && auth.tableId !== tableId) {
        return NextResponse.json(
          { error: 'Forbidden — table mismatch with customer session' },
          { status: 403 }
        )
      }
    } else {
      // Staff: must have permission to act on behalf of customers and
      // belong to this restaurant. Staff can trigger calls at any branch
      // of their restaurant (e.g., a manager re-triggering a missed call).
      const permErr = requireAnyPerm(auth, ['customer:call_waiter', 'customer:request_bill', 'restaurant:manage'], restaurantId)
      if (permErr) return permErr
    }

    const validRequestTypes = ['call_waiter', 'request_bill', 'request_menu', 'custom']
    if (!validRequestTypes.includes(requestType)) {
      return NextResponse.json(
        { error: `Invalid request type. Must be one of: ${validRequestTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify table belongs to branch/restaurant
    const table = await db.table.findFirst({
      where: { id: tableId, branchId, isActive: true },
      include: { branch: true },
    })

    if (!table || table.branch.restaurantId !== restaurantId) {
      return NextResponse.json(
        { error: 'Table not found in this restaurant/branch' },
        { status: 404 }
      )
    }

    // Rate limit: check if there's a recent pending call from the same table
    const recentPending = await db.waiterCall.findFirst({
      where: {
        tableId,
        status: 'pending',
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes
        },
      },
    })

    if (recentPending) {
      return NextResponse.json(
        { error: 'A pending call already exists for this table. Please wait.' },
        { status: 429 }
      )
    }

    const call = await db.waiterCall.create({
      data: {
        restaurantId,
        branchId,
        tableId,
        sessionId: sessionId || null,
        requestType,
        message: message || null,
      },
    })

    // ── Look up assigned waiter(s) for this table ──
    const assignedWaiters = await getWaitersForTable(restaurantId, tableId)
    const primaryWaiter = assignedWaiters.length > 0 ? assignedWaiters[0] : null

    // Create notification — target assigned waiter(s) if available
    const notificationData = JSON.stringify({
      callId: call.id,
      tableId,
      tableNumber: table.number,
      branchId,
      requestType,
      assignedWaiterIds: assignedWaiters.map(w => w.userId),
    })

    await db.notification.create({
      data: {
        restaurantId,
        branchId,
        type: 'waiter_call',
        channel: 'in_app',
        userId: primaryWaiter?.userId || null, // Target assigned waiter directly
        title: requestType === 'call_waiter'
          ? 'Waiter Called'
          : requestType === 'request_bill'
            ? 'Bill Requested'
            : requestType === 'request_menu'
              ? 'Menu Requested'
              : 'Customer Request',
        message: message || `Table ${table.number} requested: ${requestType.replace('_', ' ')}`,
        data: notificationData,
      },
    })

    // Also create in_app notifications for all other assigned waiters
    for (const waiter of assignedWaiters.slice(1)) {
      await db.notification.create({
        data: {
          restaurantId,
          branchId,
          type: 'waiter_call',
          channel: 'in_app',
          userId: waiter.userId,
          title: requestType === 'call_waiter'
            ? 'Waiter Called'
            : requestType === 'request_bill'
              ? 'Bill Requested'
              : requestType === 'request_menu'
                ? 'Menu Requested'
                : 'Customer Request',
          message: message || `Table ${table.number} requested: ${requestType.replace('_', ' ')}`,
          data: notificationData,
        },
      })
    }

    // Emit real-time event for waiter call (includes assigned waiter IDs)
    emitEvent({
      type: 'waiter_call',
      restaurantId,
      callId: call.id,
      tableId,
      tableNumber: table.number,
      requestType,
      message,
      assignedWaiterIds: assignedWaiters.map(w => w.userId),
    })

    // Send push notification — target assigned waiter(s) specifically
    notifyWaiterCall(restaurantId, String(table.number), requestType, assignedWaiters.map(w => w.userId)).catch((err) =>
      console.error('[NOTIFY_WAITER_CALL]', err)
    )

    // Return call data WITH waiter info for the customer
    return NextResponse.json({
      data: call,
      waiter: primaryWaiter ? {
        name: primaryWaiter.name,
        phone: primaryWaiter.phone,
      } : null,
    }, { status: 201 })
  } catch (error) {
    // requireAuth throws Error('Unauthorized') on missing/invalid token
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[WAITER_CALL_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create waiter call' },
      { status: 500 }
    )
  }
}
