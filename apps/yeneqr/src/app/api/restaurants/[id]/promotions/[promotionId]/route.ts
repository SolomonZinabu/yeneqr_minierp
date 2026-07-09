// ============================================================
// Yene QR — Single Promotion API (PATCH for toggle, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { toCents, discountToCents } from '@/lib/money'

/**
 * PATCH /api/restaurants/[id]/promotions/[promotionId]
 * Update a promotion (e.g. toggle isActive).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id: restaurantId, promotionId } = await params
    const auth = requireAuth(request)

    // Require restaurant:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const {
      isActive,
      name,
      nameAm,
      description,
      descriptionAm,
      discountValue,
      validFrom,
      validUntil,
      usageLimit,
      maxDiscount,
      minimumOrder,
      perCustomerLimit,
    } = body as {
      isActive?: boolean
      name?: string
      nameAm?: string | null
      description?: string | null
      descriptionAm?: string | null
      discountValue?: number
      validFrom?: string
      validUntil?: string
      usageLimit?: number | null
      maxDiscount?: number | null
      minimumOrder?: number
      perCustomerLimit?: number | null
    }

    // Verify the promotion belongs to this restaurant
    const existing = await db.promotion.findFirst({
      where: { id: promotionId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // Validate date range if either date is being updated
    const newValidFrom = validFrom !== undefined ? new Date(validFrom) : existing.validFrom
    const newValidUntil = validUntil !== undefined ? new Date(validUntil) : existing.validUntil
    if (newValidUntil <= newValidFrom) {
      return NextResponse.json(
        { error: 'validUntil must be after validFrom' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (name !== undefined) updateData.name = name
    if (nameAm !== undefined) updateData.nameAm = nameAm || null
    if (description !== undefined) updateData.description = description || null
    if (descriptionAm !== undefined) updateData.descriptionAm = descriptionAm || null
    if (discountValue !== undefined) {
      if (discountValue <= 0) {
        return NextResponse.json(
          { error: 'discountValue must be greater than 0' },
          { status: 400 }
        )
      }
      if (existing.discountType === 'percentage' && discountValue > 100) {
        return NextResponse.json(
          { error: 'Percentage discount cannot exceed 100%' },
          { status: 400 }
        )
      }
      updateData.discountValueCents = discountToCents(discountValue, existing.discountType)
    }
    if (usageLimit !== undefined) updateData.usageLimit = usageLimit || null
    if (perCustomerLimit !== undefined) updateData.perCustomerLimit = perCustomerLimit || null
    if (maxDiscount !== undefined) updateData.maxDiscountCents = maxDiscount ? toCents(maxDiscount) : null
    if (minimumOrder !== undefined) updateData.minimumOrderCents = minimumOrder ? toCents(minimumOrder) : 0
    if (validFrom !== undefined) updateData.validFrom = newValidFrom
    if (validUntil !== undefined) updateData.validUntil = newValidUntil

    const promotion = await db.promotion.update({
      where: { id: promotionId },
      data: updateData,
    })

    return NextResponse.json({ data: promotion })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PROMOTION_PATCH]', error)
    return NextResponse.json(
      { error: 'Failed to update promotion' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/promotions/[promotionId]
 * Delete a promotion.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id: restaurantId, promotionId } = await params
    const auth = requireAuth(request)

    // Require restaurant:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    // Verify the promotion belongs to this restaurant
    const existing = await db.promotion.findFirst({
      where: { id: promotionId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    await db.promotion.delete({
      where: { id: promotionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PROMOTION_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete promotion' },
      { status: 500 }
    )
  }
}
