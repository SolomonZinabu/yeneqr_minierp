// ============================================================
// Yene QR — Validate Promotion Code
// POST /api/restaurants/[id]/promotions/validate
// ============================================================
// Phase 6.2: respects PromotionBranchAssignment. A promotion with ZERO
// assignments is active at all branches (default). A promotion with
// assignments is active ONLY at those branches. Customers at unassigned
// branches get 'not valid at this branch'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateDiscountAmountCents, fromCents } from '@/lib/money'
import { getAuthContext } from '@/lib/api-auth'

/**
 * POST /api/restaurants/[id]/promotions/validate
 * Validate a promotion code before placing the order.
 * Body: { code, subtotal, itemIds, customerId?, branchId? }
 * Returns: { valid, promotion, discountAmount, message }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const body = await request.json()
    const { code, subtotal, itemIds, customerId, branchId: bodyBranchId } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: 'Promotion code is required' },
        { status: 400 }
      )
    }

    if (typeof subtotal !== 'number' || subtotal < 0) {
      return NextResponse.json(
        { valid: false, message: 'Valid subtotal is required' },
        { status: 400 }
      )
    }

    // Phase 6.2: resolve the customer's branchId from the token (preferred)
    // or the request body (fallback for non-customer callers).
    const auth = getAuthContext(request)
    if (auth && auth.restaurantId !== id) {
      return NextResponse.json({ valid: false, message: 'Forbidden' }, { status: 403 })
    }
    const customerBranchId = auth?.type === 'customer' ? auth.branchId : (bodyBranchId || null)

    // Find the promotion by code
    const promotion = await db.promotion.findFirst({
      where: {
        restaurantId: id,
        code: code.toUpperCase(),
        isActive: true,
      },
      include: {
        branchAssignments: {
          where: { isActive: true },
          select: { branchId: true },
        },
      },
    })

    if (!promotion) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid promotion code',
      })
    }

    // Phase 6.2: branch assignment check
    // If the promotion has ANY branch assignments, it's only valid at those branches.
    // A promotion with ZERO assignments = active everywhere (default).
    if (promotion.branchAssignments.length > 0 && customerBranchId) {
      const isAssignedToThisBranch = promotion.branchAssignments.some(
        (a: { branchId: string }) => a.branchId === customerBranchId
      )
      if (!isAssignedToThisBranch) {
        return NextResponse.json({
          valid: false,
          message: 'This promotion is not valid at your branch',
        })
      }
    }

    // Check date range
    const now = new Date()
    const validFrom = new Date(promotion.validFrom)
    const validUntil = new Date(promotion.validUntil)

    if (now < validFrom) {
      return NextResponse.json({
        valid: false,
        message: 'This promotion is not yet active',
      })
    }

    if (now > validUntil) {
      return NextResponse.json({
        valid: false,
        message: 'This promotion has expired',
      })
    }

    // Check total usage limit
    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      return NextResponse.json({
        valid: false,
        message: 'This promotion has reached its usage limit',
      })
    }

    // Check per-customer limit
    if (promotion.perCustomerLimit && customerId) {
      const customerUsageCount = await db.order.count({
        where: {
          restaurantId: id,
          customerId,
          discountAmountCents: { gt: 0 },
        },
      })
      if (customerUsageCount >= promotion.perCustomerLimit) {
        return NextResponse.json({
          valid: false,
          message: 'You have reached the usage limit for this promotion',
        })
      }
    }

    // Check minimum order amount (subtotal is expected in cents from client)
    if (promotion.minimumOrderCents && subtotal < promotion.minimumOrderCents) {
      return NextResponse.json({
        valid: false,
        message: `Minimum order amount is ${fromCents(promotion.minimumOrderCents)} ETB`,
      })
    }

    // Check applicable items if specified
    if (promotion.applicableItems && Array.isArray(itemIds) && itemIds.length > 0) {
      let applicableItemIds: string[] = []
      try {
        applicableItemIds = JSON.parse(promotion.applicableItems)
      } catch {
        applicableItemIds = []
      }
      if (applicableItemIds.length > 0) {
        const hasApplicableItem = itemIds.some((iid: string) => applicableItemIds.includes(iid))
        if (!hasApplicableItem) {
          return NextResponse.json({
            valid: false,
            message: 'This promotion is not applicable to items in your cart',
          })
        }
      }
    }

    // Calculate discount amount in cents using the money utility
    let discountAmountCents = calculateDiscountAmountCents(
      subtotal, // subtotal is in cents from client
      promotion.discountValueCents,
      promotion.discountType,
      promotion.maxDiscountCents
    )

    return NextResponse.json({
      valid: true,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        nameAm: promotion.nameAm,
        code: promotion.code,
        type: promotion.type,
        discountType: promotion.discountType,
        discountValueCents: promotion.discountValueCents,
        maxDiscountCents: promotion.maxDiscountCents,
        minimumOrderCents: promotion.minimumOrderCents,
      },
      discountAmountCents,
      message: 'Promotion applied successfully',
    })
  } catch (error) {
    console.error('[PROMOTION_VALIDATE]', error)
    return NextResponse.json(
      { valid: false, message: 'Failed to validate promotion code' },
      { status: 500 }
    )
  }
}
