// ============================================================
// Yene QR — Payment Verification API
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, getAuthContext } from '@/lib/api-auth'
import { getPaymentProvider } from '@/lib/payments'
import { recordPlatformFee } from '@/lib/platform-fee'

/**
 * POST /api/restaurants/[id]/payments/verify
 * Verify a payment by provider reference.
 * Body: { reference }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Customers can verify payments for their own orders; staff requires payment:manage
    if (auth.type === 'customer') {
      if (auth.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const permErr = requirePerm(auth, 'payment:manage', restaurantId)
      if (permErr) return permErr
    }

    const body = await request.json()
    const { reference } = body as { reference: string }

    if (!reference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      )
    }

    // Find the payment by reference
    const payment = await db.payment.findFirst({
      where: {
        reference,
        restaurantId,
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found for the given reference' },
        { status: 404 }
      )
    }

    // Already completed — record fee if not yet recorded (race condition fix:
    // the webhook may have completed the payment without recording the fee),
    // then return current state. recordPlatformFee is idempotent (paymentId @unique).
    if (payment.status === 'completed') {
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })
      return NextResponse.json({
        data: {
          payment,
          verified: true,
          status: 'completed',
          message: 'Payment already completed',
        },
      })
    }

    // Verify with provider
    const method = payment.method as 'telebirr' | 'chapa' | 'cbe_birr' | 'cash'
    const provider = getPaymentProvider(method)
    const verification = await provider.verifyPayment(reference)

    // Update payment status based on verification
    const updateData: Record<string, unknown> = {
      status: verification.status,
      providerResponse: verification.rawResponse
        ? JSON.stringify(verification.rawResponse)
        : payment.providerResponse,
    }

    if (verification.status === 'completed' && verification.paidAt) {
      updateData.paidAt = verification.paidAt
    } else if (verification.status === 'completed') {
      updateData.paidAt = new Date()
    } else if (verification.status === 'failed') {
      updateData.failedAt = new Date()
    }

    const updated = await db.payment.update({
      where: { id: payment.id },
      data: updateData,
    })

    // If verified and completed, update order status
    if (verification.verified && verification.status === 'completed') {
      await db.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          tipAmountCents: payment.tipAmountCents,
        },
      })

      // Record platform fee in ledger (idempotent — skips if already exists for this paymentId)
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })
    }

    return NextResponse.json({
      data: {
        payment: updated,
        verified: verification.verified,
        status: verification.status,
        message: verification.verified
          ? 'Payment verified successfully'
          : 'Payment verification pending',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PAYMENT_VERIFY]', error)
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    )
  }
}
