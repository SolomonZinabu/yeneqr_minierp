// ============================================================
// Yene QR — Invoice Detail API (Get, Update status)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import {
  syncBillingForSubscription,
  logInvoicePaid,
  logInvoiceCancelled,
} from '@/lib/billing'
import {
  sendInvoicePaidNotification,
  sendInvoiceOverdueNotification,
} from '@/lib/notifications'

/**
 * GET /api/restaurants/[id]/invoices/[invoiceId]
 * Fetch a single invoice with full subscription/plan info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const { id: restaurantId, invoiceId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'subscription:manage', restaurantId)
    if (permErr) return permErr

    const subscription = await db.subscription.findUnique({
      where: { restaurantId },
      select: { id: true },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this restaurant' },
        { status: 404 }
      )
    }

    // Sync billing (cheap; idempotent)
    try {
      await syncBillingForSubscription(subscription.id)
    } catch (e) {
      console.error('[BILLING_SYNC_DETAIL]', e)
    }

    const invoice = await db.invoice.findFirst({
      where: {
        id: invoiceId,
        subscriptionId: subscription.id,
      },
      include: {
        subscription: {
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
                priceCents: true,
                yearlyPriceCents: true,
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({ data: invoice })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVOICE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/restaurants/[id]/invoices/[invoiceId]
 * Update invoice status (mark as paid or cancel).
 * Body: { status: 'paid' | 'cancelled', reason? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const { id: restaurantId, invoiceId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'subscription:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { status, reason } = body as {
      status: 'paid' | 'cancelled' | 'pending' | 'overdue'
      reason?: string
    }

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const subscription = await db.subscription.findUnique({
      where: { restaurantId },
      select: { id: true },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this restaurant' },
        { status: 404 }
      )
    }

    const existing = await db.invoice.findFirst({
      where: {
        id: invoiceId,
        subscriptionId: subscription.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Guard: cannot change status of cancelled invoices (must create a new one)
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot modify a cancelled invoice' },
        { status: 400 }
      )
    }

    // Guard: cannot re-open a paid invoice (must create a credit note instead)
    if (existing.status === 'paid' && status !== 'paid') {
      return NextResponse.json(
        { error: 'Cannot modify a paid invoice' },
        { status: 400 }
      )
    }

    // No-op if already in the requested status
    if (existing.status === status) {
      return NextResponse.json({
        data: existing,
        message: 'Invoice already in requested status',
      })
    }

    const updateData: Record<string, unknown> = { status }
    if (status === 'paid') {
      updateData.paidAt = new Date()
    } else {
      updateData.paidAt = null
    }

    const updated = await db.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        subscription: {
          select: {
            id: true,
            plan: {
              select: { id: true, name: true, slug: true, priceCents: true, yearlyPriceCents: true },
            },
          },
        },
      },
    })

    // Audit log + notification based on the transition
    if (status === 'paid') {
      logInvoicePaid({
        restaurantId,
        userId: auth.userId,
        performedByType: auth.type,
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        amountCents: updated.amountCents,
        totalCents: updated.totalCents,
        status: 'paid',
      }).catch((e) => console.error('[AUDIT_INVOICE_PAID]', e))

      sendInvoicePaidNotification(restaurantId, {
        invoiceNumber: updated.invoiceNumber,
        amountCents: updated.totalCents,
        dueDate: updated.dueDate.toISOString(),
      }).catch((e) => console.error('[NOTIFY_INVOICE_PAID]', e))
    } else if (status === 'cancelled') {
      logInvoiceCancelled({
        restaurantId,
        userId: auth.userId,
        performedByType: auth.type,
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        amountCents: updated.amountCents,
        totalCents: updated.totalCents,
        status: 'cancelled',
        reason,
      }).catch((e) => console.error('[AUDIT_INVOICE_CANCELLED]', e))
    } else if (status === 'overdue') {
      sendInvoiceOverdueNotification(restaurantId, {
        invoiceNumber: updated.invoiceNumber,
        amountCents: updated.totalCents,
        dueDate: updated.dueDate.toISOString(),
      }).catch((e) => console.error('[NOTIFY_INVOICE_OVERDUE]', e))
    }

    // After a status change, re-sync subscription status (may lift past_due)
    try {
      await syncBillingForSubscription(subscription.id)
    } catch (e) {
      console.error('[BILLING_SYNC_AFTER_PATCH]', e)
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVOICE_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
