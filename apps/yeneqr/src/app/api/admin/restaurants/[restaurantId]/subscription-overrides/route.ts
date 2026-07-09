// ============================================================
// Yene QR — Admin Subscription Override API
// ============================================================
// Allows super admins to set per-restaurant custom fee rates and
// custom subscription prices — for the "Configurable" plan or
// special deals on any plan.
//
// PUT /api/admin/restaurants/[restaurantId]/subscription-overrides
// Body: {
//   customFeeRate?: number | null,    // decimal (0.015 = 1.5%), null = use plan default
//   customPriceCents?: number | null, // monthly price in cents, null = use plan default
//   customNotes?: string | null,      // admin-visible notes about the deal
//   planId?: string,                  // optionally change the plan at the same time
// }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/admin/restaurants/[restaurantId]/subscription-overrides
 * Fetch the current subscription + custom overrides for a restaurant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const subscription = await db.subscription.findUnique({
      where: { restaurantId },
      include: {
        plan: true,
        restaurant: { select: { id: true, name: true } },
      },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this restaurant' },
        { status: 404 }
      )
    }

    const effectiveFeeRate = subscription.customFeeRate != null
      ? subscription.customFeeRate
      : (subscription.plan.feeRatePercent ?? 3.0) / 100
    const effectivePriceCents = subscription.customPriceCents != null
      ? subscription.customPriceCents
      : subscription.plan.priceCents

    return NextResponse.json({
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          planName: subscription.plan.name,
          planSlug: subscription.plan.slug,
          customFeeRate: subscription.customFeeRate,
          customPriceCents: subscription.customPriceCents,
          customNotes: subscription.customNotes,
          effectiveFeeRate,
          effectiveFeeRatePercent: effectiveFeeRate * 100,
          effectivePriceCents,
        },
        restaurant: {
          id: subscription.restaurant.id,
          name: subscription.restaurant.name,
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTION_OVERRIDE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription overrides' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const body = await request.json()
    const { customFeeRate, customPriceCents, customNotes, planId } = body as {
      customFeeRate?: number | null
      customPriceCents?: number | null
      customNotes?: string | null
      planId?: string
    }

    // Validate customFeeRate if provided (decimal, 0-0.50 = 0%-50%)
    if (customFeeRate !== undefined && customFeeRate !== null) {
      if (typeof customFeeRate !== 'number' || customFeeRate < 0 || customFeeRate > 0.50) {
        return NextResponse.json(
          { error: 'customFeeRate must be a decimal between 0 and 0.50 (0%-50%)' },
          { status: 400 }
        )
      }
    }

    // Validate customPriceCents if provided
    if (customPriceCents !== undefined && customPriceCents !== null) {
      if (typeof customPriceCents !== 'number' || customPriceCents < 0) {
        return NextResponse.json(
          { error: 'customPriceCents must be a non-negative integer' },
          { status: 400 }
        )
      }
    }

    // Find the restaurant's subscription
    const existing = await db.subscription.findUnique({
      where: { restaurantId },
      include: { plan: true, restaurant: { select: { name: true } } },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'No subscription found for this restaurant' },
        { status: 404 }
      )
    }

    // If planId is provided, validate it exists and is active
    if (planId && planId !== existing.planId) {
      const newPlan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
      if (!newPlan || !newPlan.isActive) {
        return NextResponse.json(
          { error: 'Plan not found or inactive' },
          { status: 400 }
        )
      }
    }

    // Build update data — only include fields that are explicitly provided
    // (use null to clear an override, undefined to leave it unchanged)
    const updateData: Record<string, unknown> = {}
    if (customFeeRate !== undefined) updateData.customFeeRate = customFeeRate
    if (customPriceCents !== undefined) updateData.customPriceCents = customPriceCents
    if (customNotes !== undefined) updateData.customNotes = customNotes || null
    if (planId) updateData.planId = planId

    // If switching to a new plan, reactivate the subscription if it was cancelled
    if (planId && existing.status === 'cancelled') {
      updateData.status = 'active'
      updateData.cancelledAt = null
      updateData.cancellationReason = null
    }

    const updated = await db.subscription.update({
      where: { restaurantId },
      data: updateData,
      include: {
        plan: true,
        restaurant: { select: { id: true, name: true } },
      },
    })

    // Compute the effective fee rate + price for the response
    const effectiveFeeRate = updated.customFeeRate != null
      ? updated.customFeeRate
      : (updated.plan.feeRatePercent ?? 3.0) / 100
    const effectivePriceCents = updated.customPriceCents != null
      ? updated.customPriceCents
      : updated.plan.priceCents

    console.info('[ADMIN_SUBSCRIPTION_OVERRIDE]', {
      restaurantId,
      restaurantName: updated.restaurant.name,
      planName: updated.plan.name,
      customFeeRate: updated.customFeeRate,
      customPriceCents: updated.customPriceCents,
      effectiveFeeRate,
      effectivePriceCents,
    })

    return NextResponse.json({
      data: {
        subscription: {
          id: updated.id,
          status: updated.status,
          planId: updated.planId,
          planName: updated.plan.name,
          planSlug: updated.plan.slug,
          customFeeRate: updated.customFeeRate,
          customPriceCents: updated.customPriceCents,
          customNotes: updated.customNotes,
          effectiveFeeRate,
          effectiveFeeRatePercent: effectiveFeeRate * 100,
          effectivePriceCents,
        },
        restaurant: {
          id: updated.restaurant.id,
          name: updated.restaurant.name,
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTION_OVERRIDE]', error)
    return NextResponse.json(
      { error: 'Failed to update subscription overrides' },
      { status: 500 }
    )
  }
}
