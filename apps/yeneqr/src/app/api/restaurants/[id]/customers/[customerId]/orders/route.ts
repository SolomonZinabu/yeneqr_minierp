// ============================================================
// Yene QR — Customer Order History API
// GET /api/restaurants/[id]/customers/[customerId]/orders
// Returns a customer's order history for a restaurant.
// Requires customer auth (JWT session token).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: restaurantId, customerId } = await params

    // Verify customer auth
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (auth.type !== 'customer') {
      return NextResponse.json({ error: 'Only customers can access order history' }, { status: 403 })
    }

    if (auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify the customer exists and belongs to this restaurant
    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        restaurantId,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify the authenticated session is linked to this customer
    // The session can access order history if:
    // 1. The session's customer matches the requested customerId, OR
    // 2. The session has the same phone number as the customer
    const session = await db.customerSession.findUnique({
      where: { id: auth.sessionId },
      select: { customerId: true },
    })

    let isAuthorized = session?.customerId === customerId

    // If not directly linked, check phone match
    if (!isAuthorized && customer.phone) {
      const linkedCustomer = await db.customer.findFirst({
        where: {
          id: session?.customerId || '',
          restaurantId,
          phone: customer.phone,
        },
      })
      if (linkedCustomer) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'You can only view your own order history' }, { status: 403 })
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const skip = (page - 1) * limit

    // Fetch orders for this customer
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: {
          customerId,
          restaurantId,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  priceCents: true,
                  isAvailable: true,
                },
              },
              modifierSelections: {
                select: {
                  modifierGroupId: true,
                  modifierOptionId: true,
                  name: true,
                  priceDeltaCents: true,
                  quantity: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      db.order.count({
        where: {
          customerId,
          restaurantId,
        },
      }),
    ])

    // Format orders for the customer app
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      type: order.type,
      subtotalCents: order.subtotalCents,
      taxAmountCents: order.taxAmountCents,
      serviceChargeCents: order.serviceChargeCents,
      discountAmountCents: order.discountAmountCents,
      totalAmountCents: order.totalAmountCents,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        nameAm: item.nameAm,
        priceCents: item.priceCents,
        quantity: item.quantity,
        image: item.menuItem?.image || null,
        isAvailable: item.menuItem?.isAvailable ?? true,
        modifierSelections: item.modifierSelections,
        removedIngredients: item.removedIngredients ? (() => { try { return JSON.parse(item.removedIngredients) } catch { return [] } })() : [],
      })),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }))

    return NextResponse.json({
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        totalSpentCents: customer.totalSpentCents,
        visitCount: customer.visitCount,
        loyaltyPoints: customer.loyaltyPoints,
      },
    })
  } catch (error) {
    console.error('[CUSTOMER_ORDER_HISTORY]', error)
    return NextResponse.json(
      { error: 'Failed to fetch order history' },
      { status: 500 }
    )
  }
}
