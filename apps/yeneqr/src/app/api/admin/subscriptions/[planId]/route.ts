// ============================================================
// Yene QR — Admin Subscription Plan Detail API
// PUT: Update a specific plan (super admin only)
// DELETE: Delete a plan (super admin only, only if no subscriptions)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { toCents } from '@/lib/money'

/**
 * PUT /api/admin/subscriptions/[planId]
 * Update a specific subscription plan (super admin only).
 *
 * Body: {
 *   name?, slug?, description?, price?, yearlyPrice?,
 *   features?, limits?, isActive?, sortOrder?, isPopular?
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const existing = await db.subscriptionPlan.findUnique({
      where: { id: planId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscription plan not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      name,
      slug,
      description,
      price,
      yearlyPrice,
      feeRatePercent,
      features,
      limits,
      isActive,
      sortOrder,
      isPopular,
    } = body as {
      name?: string
      slug?: string
      description?: string | null
      price?: number
      yearlyPrice?: number | null
      feeRatePercent?: number
      features?: string[]
      limits?: Record<string, unknown>
      isActive?: boolean
      sortOrder?: number
      isPopular?: boolean
    }

    // Validate slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const slugExists = await db.subscriptionPlan.findUnique({
        where: { slug },
      })
      if (slugExists) {
        return NextResponse.json(
          { error: 'Slug already exists' },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (description !== undefined) updateData.description = description || null
    if (price !== undefined) updateData.priceCents = toCents(price)
    if (yearlyPrice !== undefined) updateData.yearlyPriceCents = yearlyPrice ? toCents(yearlyPrice) : null
    if (feeRatePercent !== undefined && typeof feeRatePercent === 'number' && feeRatePercent >= 0 && feeRatePercent <= 100) {
      updateData.feeRatePercent = feeRatePercent
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (features !== undefined) updateData.features = JSON.stringify(features)
    if (limits !== undefined) updateData.limits = JSON.stringify(limits)

    // Handle isPopular stored in limits JSON
    if (isPopular !== undefined) {
      const currentLimits = existing.limits
        ? (() => { try { return JSON.parse(existing.limits); } catch { return {}; } })()
        : {}
      currentLimits.isPopular = isPopular
      updateData.limits = JSON.stringify({ ...currentLimits, ...(limits || {}) })
    }

    const updated = await db.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
      include: {
        _count: {
          select: { subscriptions: true },
        },
        subscriptions: {
          where: { status: 'active' },
          select: { id: true },
        },
      },
    })

    const parsedFeatures = (() => {
      try { const p = JSON.parse(updated.features); return Array.isArray(p) ? p : []; } catch { return []; }
    })()
    const parsedLimits = (() => {
      try { return JSON.parse(updated.limits); } catch { return {}; }
    })()

    return NextResponse.json({
      data: {
        id: updated.id,
        slug: updated.slug,
        name: updated.name,
        description: updated.description,
        price: updated.priceCents,
        yearlyPrice: updated.yearlyPriceCents,
        feeRatePercent: updated.feeRatePercent ?? 3.0,
        features: parsedFeatures,
        limits: parsedLimits,
        isActive: updated.isActive,
        sortOrder: updated.sortOrder,
        totalSubscriptions: updated._count.subscriptions,
        activeSubscriptions: updated.subscriptions.length,
        revenue: updated.priceCents * updated.subscriptions.length,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTION_PLAN_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update subscription plan' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/subscriptions/[planId]
 * Delete a subscription plan (super admin only).
 * Only allowed if the plan has no active subscriptions.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const existing = await db.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscription plan not found' },
        { status: 404 }
      )
    }

    // Prevent deletion if plan has subscriptions
    if (existing._count.subscriptions > 0) {
      return NextResponse.json(
        { error: `Cannot delete plan with ${existing._count.subscriptions} existing subscription(s). Deactivate the plan instead.` },
        { status: 400 }
      )
    }

    await db.subscriptionPlan.delete({
      where: { id: planId },
    })

    return NextResponse.json({
      data: { id: planId },
      message: 'Subscription plan deleted successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTION_PLAN_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete subscription plan' },
      { status: 500 }
    )
  }
}
