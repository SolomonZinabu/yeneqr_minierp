// ============================================================
// Yene QR — Subscription API (GET, PUT)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { createInvoice, syncBillingForSubscription } from '@/lib/billing'

/**
 * GET /api/restaurants/[id]/subscription
 * Get current subscription for a restaurant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require subscription:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'subscription:manage', restaurantId)
    if (permErr) return permErr

    const subscription = await db.subscription.findUnique({
      where: { restaurantId },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this restaurant' },
        { status: 404 }
      )
    }

    // Run billing maintenance (auto-overdue, recurring invoice, status sync)
    try {
      await syncBillingForSubscription(subscription.id)
    } catch (e) {
      console.error('[SUBSCRIPTION_BILLING_SYNC]', e)
    }

    // Re-fetch after maintenance to include any newly-generated invoice
    const refreshed = await db.subscription.findUnique({
      where: { restaurantId },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json({ data: refreshed })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[SUBSCRIPTION_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/subscription
 * Update subscription (change plan).
 * Body: { planId, cancellationReason? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require subscription:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'subscription:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { planId, cancellationReason } = body as {
      planId?: string
      cancellationReason?: string
    }

    const subscription = await db.subscription.findUnique({
      where: { restaurantId },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this restaurant' },
        { status: 404 }
      )
    }

    // Handle cancellation
    if (cancellationReason) {
      if (subscription.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Subscription is already cancelled' },
          { status: 400 }
        )
      }

      const updated = await db.subscription.update({
        where: { restaurantId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason,
        },
        include: { plan: true },
      })

      return NextResponse.json({
        data: updated,
        message: 'Subscription cancelled successfully',
      })
    }

    // Handle plan change
    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required to change the subscription plan' },
        { status: 400 }
      )
    }

    // Verify the new plan exists
    const newPlan = await db.subscriptionPlan.findUnique({
      where: { id: planId },
    })

    if (!newPlan || !newPlan.isActive) {
      return NextResponse.json(
        { error: 'Invalid or inactive plan' },
        { status: 400 }
      )
    }

    // Cannot change to the same plan
    if (subscription.planId === planId) {
      return NextResponse.json(
        { error: 'Already on this plan' },
        { status: 400 }
      )
    }

    // If subscription was cancelled, reactivate it
    const updateData: Record<string, unknown> = { planId }

    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      updateData.status = 'active'
      updateData.cancelledAt = null
      updateData.cancellationReason = null
    }

    // Reset billing period
    const now = new Date()
    updateData.currentPeriodStart = now
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    updateData.currentPeriodEnd = periodEnd

    const updated = await db.subscription.update({
      where: { restaurantId },
      data: updateData,
      include: { plan: true },
    })

    // Create an invoice for the plan change using the centralized helper
    await createInvoice({
      subscriptionId: subscription.id,
      restaurantId,
      amountCents: newPlan.priceCents,
      dueInDays: 7,
      description: `Plan change to ${newPlan.name}`,
      userId: auth.userId,
      performedByType: auth.type,
    }).catch((e) => console.error('[INVOICE_CREATE_PLAN_CHANGE]', e))

    return NextResponse.json({
      data: updated,
      message: 'Subscription plan updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[SUBSCRIPTION_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    )
  }
}
