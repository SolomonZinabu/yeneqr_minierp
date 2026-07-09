// ============================================================
// Yene QR — Refund Detail API (Approve/Reject, Process)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { getPaymentProvider } from '@/lib/payments'
import { reversePlatformFee } from '@/lib/platform-fee'

/**
 * PUT /api/restaurants/[id]/refunds/[refundId]
 * Approve or reject a pending refund.
 * Body: { status: 'approved' | 'rejected' }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; refundId: string }> }
) {
  try {
    const { id: restaurantId, refundId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'payment:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { status } = body as { status: 'approved' | 'rejected' }

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be "approved" or "rejected"' },
        { status: 400 }
      )
    }

    // Find the refund
    const refund = await db.refund.findUnique({
      where: { id: refundId },
    })

    if (!refund) {
      return NextResponse.json(
        { error: 'Refund not found' },
        { status: 404 }
      )
    }

    if (refund.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (refund.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending refunds can be approved or rejected' },
        { status: 400 }
      )
    }

    // Update the refund
    const updated = await db.refund.update({
      where: { id: refundId },
      data: {
        status,
        processedBy: auth.userId,
        processedAt: new Date(),
      },
      include: {
        payment: {
          select: {
            id: true,
            amountCents: true,
            method: true,
            provider: true,
            status: true,
            reference: true,
            orderId: true,
            paidAt: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                totalAmountCents: true,
                status: true,
              },
            },
          },
        },
      },
    })

    // If rejected, update payment status back from refunded
    if (status === 'rejected') {
      await db.payment.update({
        where: { id: refund.paymentId },
        data: { status: 'completed' },
      })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[REFUND_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update refund' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/refunds/[refundId]
 * Process an approved refund (calls the payment provider's refund method).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; refundId: string }> }
) {
  try {
    const { id: restaurantId, refundId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'payment:manage', restaurantId)
    if (permErr) return permErr

    // Find the refund with payment details
    const refund = await db.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: true,
      },
    })

    if (!refund) {
      return NextResponse.json(
        { error: 'Refund not found' },
        { status: 404 }
      )
    }

    if (refund.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (refund.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved refunds can be processed' },
        { status: 400 }
      )
    }

    const payment = refund.payment

    // Call the payment provider's refund method
    const provider = getPaymentProvider(payment.method as 'telebirr' | 'chapa' | 'cbe_birr' | 'cash')
    const refundResult = await provider.processRefund({
      paymentReference: payment.reference || payment.id,
      amount: refund.amountCents / 100,
      reason: refund.reason,
    })

    if (refundResult.success) {
      // Update refund status to processed
      const updated = await db.refund.update({
        where: { id: refundId },
        data: {
          status: 'processed',
          processedBy: auth.userId,
          processedAt: new Date(),
        },
        include: {
          payment: {
            select: {
              id: true,
              amountCents: true,
              method: true,
              provider: true,
              status: true,
              reference: true,
              orderId: true,
              paidAt: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  totalAmountCents: true,
                  status: true,
                },
              },
            },
          },
        },
      })

      // Update payment status to refunded
      await db.payment.update({
        where: { id: refund.paymentId },
        data: {
          status: 'refunded',
          refundedAt: new Date(),
        },
      })

      // Reverse the platform fee ledger entry so the restaurant isn't
      // charged a fee on money they refunded to the customer
      await reversePlatformFee(refund.paymentId)

      return NextResponse.json({
        data: updated,
        message: refundResult.message,
      })
    } else {
      return NextResponse.json(
        {
          error: `Refund processing failed: ${refundResult.message}`,
          refundReference: refundResult.refundReference,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[REFUND_PROCESS]', error)
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    )
  }
}
