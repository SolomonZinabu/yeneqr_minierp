// ============================================================
// Yene QR — Loyalty API (Get Points, Redeem Points)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'
import {
  calculatePointsEarned,
  calculateRedemptionValue,
  canRedeemPoints,
  getMaxRedeemablePoints,
  DEFAULT_LOYALTY_CONFIG,
} from '@/lib/loyalty'

/**
 * GET /api/restaurants/[id]/loyalty
 * Get the customer's loyalty points balance and recent history.
 * Query params: ?customerId=xxx (optional, falls back to session-based)
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

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    // Try to find or create a customer record
    let customer = null

    if (customerId) {
      customer = await db.customer.findFirst({ where: { id: customerId, restaurantId } })
    }

    // If we have a session-based customer (phone from session), look up by session
    if (!customer && auth.type === 'customer' && auth.sessionId) {
      const session = await db.customerSession.findUnique({
        where: { token: request.headers.get('authorization')?.replace('Bearer ', '') || '' },
        include: { customer: true },
      })
      if (session?.customer) {
        customer = session.customer
      }
    }

    // If still no customer, return 0 points
    if (!customer) {
      return NextResponse.json({
        data: {
          loyaltyPoints: 0,
          pointValueETB: DEFAULT_LOYALTY_CONFIG.pointValueETB,
          minimumRedemption: DEFAULT_LOYALTY_CONFIG.minimumRedemption,
          canRedeem: false,
          redemptionValue: 0,
          recentEarnings: [],
        },
      })
    }

    // Get recent orders for earning history
    const recentOrders = await db.order.findMany({
      where: {
        customerId: customer.id,
        restaurantId,
        status: { in: ['completed', 'served'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        totalAmountCents: true,
        createdAt: true,
        status: true,
      },
    })

    const earnings = recentOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      pointsEarned: calculatePointsEarned(order.totalAmountCents / 100),
      totalAmount: order.totalAmountCents,
      date: order.createdAt,
    }))

    return NextResponse.json({
      data: {
        loyaltyPoints: customer.loyaltyPoints,
        pointValueETB: DEFAULT_LOYALTY_CONFIG.pointValueETB,
        minimumRedemption: DEFAULT_LOYALTY_CONFIG.minimumRedemption,
        canRedeem: canRedeemPoints(customer.loyaltyPoints),
        redemptionValue: calculateRedemptionValue(customer.loyaltyPoints),
        maxRedeemableValue: calculateRedemptionValue(
          Math.floor(customer.loyaltyPoints / DEFAULT_LOYALTY_CONFIG.minimumRedemption) *
            DEFAULT_LOYALTY_CONFIG.minimumRedemption
        ),
        recentEarnings: earnings,
      },
    })
  } catch (error) {
    console.error('[LOYALTY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch loyalty data' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/loyalty
 * Redeem loyalty points for a discount on an order.
 * Body: { customerId, orderId, pointsToRedeem }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerId, pointsToRedeem } = body as {
      customerId?: string
      pointsToRedeem: number
    }

    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return NextResponse.json(
        { error: 'pointsToRedeem must be a positive number' },
        { status: 400 }
      )
    }

    // Find or get the customer
    let customer = null

    if (customerId) {
      customer = await db.customer.findFirst({ where: { id: customerId, restaurantId } })
    }

    if (!customer && auth.type === 'customer' && auth.sessionId) {
      const session = await db.customerSession.findUnique({
        where: { token: request.headers.get('authorization')?.replace('Bearer ', '') || '' },
        include: { customer: true },
      })
      if (session?.customer) {
        customer = session.customer
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (!canRedeemPoints(customer.loyaltyPoints)) {
      return NextResponse.json(
        { error: `Minimum ${DEFAULT_LOYALTY_CONFIG.minimumRedemption} points required for redemption` },
        { status: 400 }
      )
    }

    if (pointsToRedeem > customer.loyaltyPoints) {
      return NextResponse.json(
        { error: 'Insufficient points' },
        { status: 400 }
      )
    }

    const discountAmount = calculateRedemptionValue(pointsToRedeem)

    // Deduct points from customer
    const updatedCustomer = await db.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: { decrement: pointsToRedeem } },
    })

    return NextResponse.json({
      data: {
        pointsRedeemed: pointsToRedeem,
        discountAmount,
        remainingPoints: updatedCustomer.loyaltyPoints,
      },
    })
  } catch (error) {
    console.error('[LOYALTY_REDEEM]', error)
    return NextResponse.json(
      { error: 'Failed to redeem loyalty points' },
      { status: 500 }
    )
  }
}
