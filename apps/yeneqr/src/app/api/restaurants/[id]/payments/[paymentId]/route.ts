// ============================================================
// Yene QR — Payment Detail API (GET, PUT)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'
import { recordPlatformFee } from '@/lib/platform-fee'

/**
 * GET /api/restaurants/[id]/payments/[paymentId]
 * Get payment details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: restaurantId, paymentId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'payment:view', restaurantId)
    if (permErr) return permErr

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmountCents: true,
            status: true,
            tableId: true,
          },
        },
        refunds: true,
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    if (payment.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ data: payment })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PAYMENT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/payments/[paymentId]
 * Update payment status (e.g., confirm cash payment).
 * Body: { status: 'completed' | 'failed' | 'refunded' }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: restaurantId, paymentId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'payment:manage', restaurantId)
    if (permErr) return permErr

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    if (payment.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body as { status: string }

    const validStatuses = ['completed', 'failed', 'refunded']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Cannot update already completed payments
    if (payment.status === 'completed' && status !== 'refunded') {
      return NextResponse.json(
        { error: 'Cannot modify a completed payment (except to refund)' },
        { status: 400 }
      )
    }

    if (payment.status === 'refunded') {
      return NextResponse.json(
        { error: 'Cannot modify a refunded payment' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = { status }

    if (status === 'completed') {
      updateData.paidAt = new Date()
    } else if (status === 'failed') {
      updateData.failedAt = new Date()
    } else if (status === 'refunded') {
      updateData.refundedAt = new Date()
    }

    const updated = await db.payment.update({
      where: { id: paymentId },
      data: updateData,
    })

    // If payment is completed, update order status to 'completed' + emit realtime event
    if (status === 'completed') {
      await db.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          tipAmountCents: payment.tipAmountCents,
        },
      })

      // Record platform fee in ledger (idempotent — skips if already exists for this paymentId).
      // This covers cash payments confirmed by staff and any other payment that reaches
      // 'completed' via this endpoint. The helper computes the fee on net revenue
      // (excluding tip, tax, packaging, delivery).
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })

      // Emit payment_received event so the customer's screen updates in real-time
      // (they see "Payment Complete" without needing to refresh)
      emitEvent({
        type: 'payment_received',
        restaurantId,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
        method: payment.method,
      } as any)
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PAYMENT_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    )
  }
}
