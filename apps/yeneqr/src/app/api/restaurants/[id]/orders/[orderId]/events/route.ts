// ============================================================
// Yene QR — Order Events API (GET)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/orders/[orderId]/events
 * Get order event history (audit trail).
 * Query params: page, limit
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

    // Staff: require order:view permission + restaurant scope
    const permErr = requirePerm(auth, 'order:view', id)
    if (permErr) return permErr

    // Verify order exists and belongs to this restaurant
    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: id },
      select: { id: true, orderNumber: true, status: true },
    })
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const [events, total] = await Promise.all([
      db.orderEvent.findMany({
        where: { orderId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.orderEvent.count({ where: { orderId } }),
    ])

    // Parse JSON data fields for convenience
    const parsedEvents = events.map((event) => ({
      ...event,
      data: event.data ? JSON.parse(event.data) : null,
    }))

    return NextResponse.json({
      data: parsedEvents,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[ORDER_EVENTS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch order events' },
      { status: 500 }
    )
  }
}
