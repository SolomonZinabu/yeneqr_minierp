// ============================================================
// Yene QR — Admin: Restaurant Billing Config (Fee Rate + Subscription)
// ============================================================
// Allows super admins to:
//   1. Set the per-restaurant transaction fee rate (Restaurant.feeRate)
//      — decoupled from the subscription plan
//   2. Set a custom subscription price override (Subscription.customPriceCents)
//      — for negotiated deals on any plan
//   3. Change the subscription plan
//
// PUT /api/admin/restaurants/[restaurantId]/billing-config
// Body: {
//   feeRate?: number | null,          // decimal (0.015 = 1.5%), null = reset to 3% default
//   customPriceCents?: number | null, // monthly sub price in cents, null = use plan default
//   customNotes?: string | null,      // admin notes
//   planId?: string,                  // change the subscription plan
// }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const { restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        feeRate: true,
        subscription: {
          include: {
            plan: { select: { id: true, name: true, slug: true, priceCents: true, feeRatePercent: true } },
          },
        },
      },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const sub = restaurant.subscription
    const effectivePriceCents = sub?.customPriceCents != null
      ? sub.customPriceCents
      : sub?.plan?.priceCents ?? 0

    return NextResponse.json({
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          feeRate: restaurant.feeRate ?? 0.03,
          feeRatePercent: (restaurant.feeRate ?? 0.03) * 100,
        },
        subscription: sub ? {
          id: sub.id,
          status: sub.status,
          planId: sub.planId,
          planName: sub.plan?.name ?? null,
          planSlug: sub.plan?.slug ?? null,
          customPriceCents: sub.customPriceCents,
          customNotes: sub.customNotes,
          effectivePriceCents,
        } : null,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_BILLING_CONFIG_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch billing config' }, { status: 500 })
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
    const { feeRate, customPriceCents, customNotes, planId } = body as {
      feeRate?: number | null
      customPriceCents?: number | null
      customNotes?: string | null
      planId?: string
    }

    // Validate feeRate if provided (decimal, 0-0.50 = 0%-50%)
    if (feeRate !== undefined && feeRate !== null) {
      if (typeof feeRate !== 'number' || feeRate < 0 || feeRate > 0.50) {
        return NextResponse.json(
          { error: 'feeRate must be a decimal between 0 and 0.50 (0%-50%)' },
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

    // If planId is provided, validate it exists and is active
    if (planId) {
      const newPlan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
      if (!newPlan || !newPlan.isActive) {
        return NextResponse.json(
          { error: 'Plan not found or inactive' },
          { status: 400 }
        )
      }
    }

    // Update restaurant.feeRate if provided
    if (feeRate !== undefined) {
      await db.restaurant.update({
        where: { id: restaurantId },
        data: { feeRate: feeRate ?? 0.03 }, // null resets to 3% default
      })
    }

    // Update subscription if any sub-related fields are provided
    if (planId !== undefined || customPriceCents !== undefined || customNotes !== undefined) {
      const existing = await db.subscription.findUnique({
        where: { restaurantId },
      })

      if (!existing) {
        return NextResponse.json(
          { error: 'No subscription found for this restaurant' },
          { status: 404 }
        )
      }

      const subUpdate: Record<string, unknown> = {}
      if (customPriceCents !== undefined) subUpdate.customPriceCents = customPriceCents
      if (customNotes !== undefined) subUpdate.customNotes = customNotes || null
      if (planId) {
        subUpdate.planId = planId
        if (existing.status === 'cancelled') {
          subUpdate.status = 'active'
          subUpdate.cancelledAt = null
          subUpdate.cancellationReason = null
        }
      }

      await db.subscription.update({
        where: { restaurantId },
        data: subUpdate,
      })
    }

    // Fetch fresh data for the response
    const refreshed = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        feeRate: true,
        subscription: {
          include: {
            plan: { select: { id: true, name: true, slug: true, priceCents: true } },
          },
        },
      },
    })

    const sub = refreshed?.subscription
    const effectivePriceCents = sub?.customPriceCents != null
      ? sub.customPriceCents
      : sub?.plan?.priceCents ?? 0

    console.info('[ADMIN_BILLING_CONFIG_UPDATE]', {
      restaurantId,
      restaurantName: refreshed?.name,
      feeRate: refreshed?.feeRate,
      planName: sub?.plan?.name,
      customPriceCents: sub?.customPriceCents,
    })

    return NextResponse.json({
      data: {
        restaurant: {
          id: refreshed!.id,
          name: refreshed!.name,
          feeRate: refreshed!.feeRate ?? 0.03,
          feeRatePercent: (refreshed!.feeRate ?? 0.03) * 100,
        },
        subscription: sub ? {
          id: sub.id,
          status: sub.status,
          planId: sub.planId,
          planName: sub.plan?.name ?? null,
          planSlug: sub.plan?.slug ?? null,
          customPriceCents: sub.customPriceCents,
          customNotes: sub.customNotes,
          effectivePriceCents,
        } : null,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_BILLING_CONFIG_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update billing config' },
      { status: 500 }
    )
  }
}
