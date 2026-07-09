// ============================================================
// Yene QR — Reviews API (List, Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/restaurants/[id]/reviews
 * List reviews for a restaurant.
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
    const customerId = searchParams.get('customerId')
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const minRating = searchParams.get('minRating')
    const maxRating = searchParams.get('maxRating')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId }

    if (customerId) where.customerId = customerId
    if (branchId) where.branchId = branchId
    if (minRating || maxRating) {
      const rating: Record<string, number> = {}
      if (minRating) rating.gte = parseInt(minRating, 10)
      if (maxRating) rating.lte = parseInt(maxRating, 10)
      where.rating = rating
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      }),
      db.review.count({ where }),
    ])

    // Compute average rating (respect branchId filter)
    const ratingAggWhere: Record<string, unknown> = { restaurantId }
    if (branchId) ratingAggWhere.branchId = branchId
    const ratingAgg = await db.review.aggregate({
      where: ratingAggWhere,
      _avg: { rating: true },
      _count: { rating: true },
    })

    return NextResponse.json({
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        averageRating: ratingAgg._avg.rating
          ? Math.round(ratingAgg._avg.rating * 10) / 10
          : 0,
        totalReviews: ratingAgg._count.rating,
      },
    })
  } catch (error) {
    console.error('[REVIEWS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/reviews
 * Create a review from a customer.
 * Body: { orderId, customerId, rating, comment? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // ── Rate Limiting ──
    const clientIp = getClientIp(request)
    const rateLimitKey = `review:${clientIp}:${restaurantId}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.api)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many review requests. Please try again later.', retryAfterMs: rateLimitResult.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const body = await request.json()
    const { orderId, customerId, rating, comment, sessionId } = body as {
      orderId: string
      customerId?: string
      rating: number
      comment?: string
      sessionId?: string
    }

    if (!orderId || !rating) {
      return NextResponse.json(
        { error: 'orderId and rating are required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      )
    }

    // Verify order exists and belongs to this restaurant
    const order = await db.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Allow reviews for any non-cancelled order
    // Customers may want to review their experience immediately after paying,
    // even if the backend order status hasn't transitioned to completed/served yet
    // (e.g., cash payments, local state mismatches)
    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cancelled orders cannot be reviewed' },
        { status: 400 }
      )
    }

    // Find or create customer — support both authenticated customers and anonymous sessions
    let customer: Awaited<ReturnType<typeof db.customer.findUnique>> = null

    if (customerId) {
      customer = await db.customer.findUnique({ where: { id: customerId } })
    }

    // If no explicit customerId, try to find customer via auth session
    if (!customer) {
      const auth = getAuthContext(request)
      if (auth?.sessionId) {
        const session = await db.customerSession.findUnique({
          where: { id: auth.sessionId },
          include: { customer: true },
        })
        if (session?.customer) {
          customer = session.customer
        } else if (session) {
          // Auto-create an anonymous customer linked to this session
          customer = await db.customer.create({
            data: { restaurantId, language: session.language || 'en' },
          })
          await db.customerSession.update({
            where: { id: session.id },
            data: { customerId: customer.id },
          })
        }
      }
    }

    // If still no customer, try sessionId from the request body
    if (!customer && sessionId) {
      const bodySession = await db.customerSession.findUnique({
        where: { id: sessionId },
        include: { customer: true },
      })
      if (bodySession?.customer) {
        customer = bodySession.customer
      } else if (bodySession) {
        customer = await db.customer.create({
          data: { restaurantId, language: bodySession.language || 'en' },
        })
        await db.customerSession.update({
          where: { id: bodySession.id },
          data: { customerId: customer.id },
        })
      }
    }

    // If still no customer, try from the order's linked session
    if (!customer && order.sessionId) {
      const orderSession = await db.customerSession.findUnique({
        where: { id: order.sessionId },
        include: { customer: true },
      })
      if (orderSession?.customer) {
        customer = orderSession.customer
      } else if (orderSession) {
        customer = await db.customer.create({
          data: { restaurantId, language: orderSession.language || 'en' },
        })
        await db.customerSession.update({
          where: { id: orderSession.id },
          data: { customerId: customer.id },
        })
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Could not identify customer for review. Please try again.' },
        { status: 400 }
      )
    }

    // Check if this order already has a review from this customer
    const existingReview = await db.review.findFirst({
      where: { orderId, customerId: customer.id },
    })

    if (existingReview) {
      return NextResponse.json(
        { error: 'This order has already been reviewed by this customer' },
        { status: 409 }
      )
    }

    const review = await db.review.create({
      data: {
        orderId,
        customerId: customer.id,
        restaurantId,
        branchId: order.branchId,
        rating,
        comment: comment || null,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ data: review }, { status: 201 })
  } catch (error) {
    console.error('[REVIEW_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    )
  }
}
