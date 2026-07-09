// ============================================================
// Yene QR — Promotions API (List, Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, getAuthContext, requirePerm } from '@/lib/api-auth'
import { toCents, discountToCents } from '@/lib/money'

/**
 * GET /api/restaurants/[id]/promotions
 * List promotions for a restaurant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isActiveParam = searchParams.get('isActive')
    const isCustomerView = isActiveParam === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    // Allow customer/unauthenticated access for active promotions (customer menu display)
    // Only require auth for full admin listing
    if (!isCustomerView) {
      // Admin listing: require restaurant:view permission + restaurant scope
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
      if (permErr) return permErr
    } else if (auth && auth.type !== 'customer') {
      // Authenticated staff viewing customer page: require permission + scope
      const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
      if (permErr) return permErr
    }

    const where: Record<string, unknown> = { restaurantId }

    if (type) where.type = type
    if (isActiveParam !== null && isActiveParam !== undefined) where.isActive = isActiveParam === 'true'

    // For customer view, only show currently valid promotions
    if (isCustomerView) {
      where.isActive = true
      const now = new Date()
      where.validFrom = { lte: now }
      where.validUntil = { gte: now }
    }

    const [promotions, total] = await Promise.all([
      db.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.promotion.count({ where }),
    ])

    return NextResponse.json({
      data: promotions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[PROMOTIONS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch promotions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/promotions
 * Create a promotion.
 * Body: { name, nameAm?, description?, descriptionAm?, type, code?,
 *         discountType, discountValue, minimumOrder?, maxDiscount?,
 *         validFrom, validUntil, isActive?, usageLimit?, perCustomerLimit?,
 *         applicableItems?, schedule? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require restaurant:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const {
      name,
      nameAm,
      description,
      descriptionAm,
      type,
      code,
      discountType,
      discountValue,
      minimumOrder = 0,
      maxDiscount,
      validFrom,
      validUntil,
      isActive = true,
      usageLimit,
      perCustomerLimit,
      applicableItems,
      schedule,
    } = body as {
      name: string
      nameAm?: string
      description?: string
      descriptionAm?: string
      type: string
      code?: string
      discountType: string
      discountValue: number
      minimumOrder?: number
      maxDiscount?: number
      validFrom: string
      validUntil: string
      isActive?: boolean
      usageLimit?: number
      perCustomerLimit?: number
      applicableItems?: unknown
      schedule?: unknown
    }

    if (!name || !type || !discountType || discountValue === undefined || !validFrom || !validUntil) {
      return NextResponse.json(
        { error: 'name, type, discountType, discountValue, validFrom, and validUntil are required' },
        { status: 400 }
      )
    }

    const validTypes = ['discount', 'coupon', 'combo_offer', 'happy_hour']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validDiscountTypes = ['percentage', 'fixed']
    if (!validDiscountTypes.includes(discountType)) {
      return NextResponse.json(
        { error: `Invalid discountType. Must be one of: ${validDiscountTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (discountValue <= 0) {
      return NextResponse.json(
        { error: 'discountValue must be greater than 0' },
        { status: 400 }
      )
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return NextResponse.json(
        { error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      )
    }

    const validFromDate = new Date(validFrom)
    const validUntilDate = new Date(validUntil)

    if (validUntilDate <= validFromDate) {
      return NextResponse.json(
        { error: 'validUntil must be after validFrom' },
        { status: 400 }
      )
    }

    // Check coupon code uniqueness if provided
    if (code) {
      const existingCode = await db.promotion.findFirst({
        where: { code, restaurantId },
      })
      if (existingCode) {
        return NextResponse.json(
          { error: 'A promotion with this code already exists' },
          { status: 409 }
        )
      }
    }

    // Coupon type requires a code
    if (type === 'coupon' && !code) {
      return NextResponse.json(
        { error: 'Coupon type requires a code' },
        { status: 400 }
      )
    }

    const promotion = await db.promotion.create({
      data: {
        restaurantId,
        name,
        nameAm: nameAm || null,
        description: description || null,
        descriptionAm: descriptionAm || null,
        type,
        code: code || null,
        discountType,
        discountValueCents: discountToCents(discountValue, discountType),
        minimumOrderCents: toCents(minimumOrder),
        maxDiscountCents: maxDiscount ? toCents(maxDiscount) : null,
        validFrom: validFromDate,
        validUntil: validUntilDate,
        isActive,
        usageLimit: usageLimit || null,
        perCustomerLimit: perCustomerLimit || null,
        applicableItems: applicableItems ? JSON.stringify(applicableItems) : null,
        schedule: schedule ? JSON.stringify(schedule) : null,
      },
    })

    return NextResponse.json({ data: promotion }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PROMOTION_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create promotion' },
      { status: 500 }
    )
  }
}
