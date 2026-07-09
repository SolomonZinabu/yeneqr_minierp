// ============================================================
// Yene QR — Payment Webhook API
// Handles webhooks from Telebirr, Chapa, and CBE Birr.
// No auth required — webhooks come from external providers.
// Each provider's signature verification is handled inside
// their respective PaymentProvider.handleWebhook() method.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaymentProvider, getStarPayProvider, type PaymentMethod } from '@/lib/payments'
import { emitEvent } from '@/lib/realtime'
import { creditLoyaltyPoints } from '@/lib/loyalty'
import { fromCents } from '@/lib/money'
import { updateBillSplitAfterPayment, areAllSplitsPaid } from '@/lib/bill-split'
import { recordPlatformFee } from '@/lib/platform-fee'
import { isFreshCallback, verifySignature } from '@/lib/starpay/signature'
import type { StarPayCallbackPayload } from '@/lib/starpay/types'
import { dispatchPOSWebhook } from '@/lib/pos-webhook'

/**
 * POST /api/restaurants/[id]/payments/webhook/[provider]
 * Handle payment provider webhooks (POST callbacks).
 *
 * Provider-specific signature verification:
 * - Telebirr: RSA-SHA256 signature verified with Telebirr public key
 * - Chapa: HMAC-SHA256 signature via Chapa-Signature header
 * - CBE Birr: HMAC-SHA256 signature via X-CBE-Signature header
 *
 * All verification happens inside the provider's handleWebhook() method.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; provider: string }> }
) {
  try {
    const { id: restaurantId, provider: providerName } = await params

    const validProviders: PaymentMethod[] = ['telebirr', 'chapa', 'cbe_birr', 'cash', 'starpay']
    if (!validProviders.includes(providerName as PaymentMethod)) {
      return NextResponse.json(
        { error: `Unknown payment provider: ${providerName}` },
        { status: 400 }
      )
    }

    // Cash doesn't support webhooks
    if (providerName === 'cash') {
      return NextResponse.json(
        { error: 'Cash payments do not support webhooks' },
        { status: 400 }
      )
    }

    // ── StarPay Webhook Handling ──
    // StarPay requires per-restaurant webhook secret from DB,
    // so we handle it specially before the standard provider flow.
    if (providerName === 'starpay') {
      return await handleStarPayWebhook(request, restaurantId)
    }

    const provider = getPaymentProvider(providerName as PaymentMethod)

    // Parse the webhook payload
    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      payload = {}
    }

    // Collect headers for signature verification
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Log incoming webhook for debugging
    console.log(`[WEBHOOK_${providerName.toUpperCase()}]`, {
      provider: providerName,
      restaurantId,
      contentType: headers['content-type'],
      payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    })

    // Let the provider handle the webhook (includes signature verification)
    const verification = await provider.handleWebhook(payload, headers)

    if (!verification.verified) {
      // Log but still return 200 to avoid retries
      console.warn('[WEBHOOK_UNVERIFIED]', {
        provider: providerName,
        reference: verification.providerReference,
        status: verification.status,
      })
      return NextResponse.json({ received: true, verified: false })
    }

    // Find the payment by provider reference
    const payment = await db.payment.findFirst({
      where: {
        reference: verification.providerReference,
        restaurantId,
      },
    })

    if (!payment) {
      console.warn('[WEBHOOK_PAYMENT_NOT_FOUND]', {
        provider: providerName,
        reference: verification.providerReference,
      })
      return NextResponse.json({ received: true, warning: 'Payment not found' })
    }

    // Prevent duplicate processing — if already completed, record fee if not yet
    // recorded (race condition fix), then skip
    if (payment.status === 'completed') {
      console.info('[WEBHOOK_ALREADY_COMPLETED]', {
        provider: providerName,
        paymentId: payment.id,
        reference: verification.providerReference,
      })
      // Record fee if not yet recorded (idempotent — skips if already exists)
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })
      return NextResponse.json({ received: true, verified: true, status: 'already_completed' })
    }

    // Update payment status
    const updateData: Record<string, unknown> = {
      status: verification.status,
      providerResponse: verification.rawResponse
        ? JSON.stringify(verification.rawResponse)
        : payment.providerResponse,
    }

    if (verification.status === 'completed') {
      updateData.paidAt = verification.paidAt || new Date()
    } else if (verification.status === 'failed') {
      updateData.failedAt = new Date()
    } else if (verification.status === 'refunded') {
      updateData.refundedAt = new Date()
    }

    await db.payment.update({
      where: { id: payment.id },
      data: updateData,
    })

    // On successful payment, record platform fee + update order status
    if (verification.status === 'completed') {
      // Record platform fee (idempotent — fee computed on net revenue, excluding tip/tax/packaging)
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })
      // ── Split Payment Handling ──
      // If this payment is linked to a BillSplit, update the split's paidAmountCents and status.
      // Don't auto-complete the order until ALL splits are paid.
      if (payment.billSplitId) {
        const { fullyPaid } = await updateBillSplitAfterPayment(payment.billSplitId, payment.amountCents)

        console.info('[WEBHOOK_SPLIT_PAYMENT_COMPLETED]', {
          provider: providerName,
          paymentId: payment.id,
          orderId: payment.orderId,
          billSplitId: payment.billSplitId,
          amountCents: payment.amountCents,
          fullyPaid,
        })

        // Only complete the order when all splits for the order are fully paid
        const allSplitsPaid = await areAllSplitsPaid(payment.orderId)
        if (allSplitsPaid) {
          const orderUpdate = await db.order.updateMany({
            where: {
              id: payment.orderId,
              status: { not: 'completed' },
            },
            data: {
              status: 'completed',
              completedAt: new Date(),
              paidAt: new Date(),
              tipAmountCents: payment.tipAmountCents,
            },
          })

          if (orderUpdate.count > 0) {
            console.info('[WEBHOOK_SPLIT_ORDER_COMPLETED]', { orderId: payment.orderId })

            // Credit loyalty points only when the full order is completed
            creditLoyaltyPoints(payment.orderId, restaurantId).catch((err) =>
              console.error('[WEBHOOK_LOYALTY_CREDIT_ERROR]', err)
            )
          }
        }

        // Create notification for split payment success
        await db.notification.create({
          data: {
            restaurantId,
            branchId: payment.branchId,
            type: 'payment_success',
            channel: 'in_app',
            title: 'Split Payment Received',
            message: `Split payment of ${fromCents(payment.amountCents)} ETB for order has been completed via ${providerName}.${fullyPaid ? ' All splits are now paid.' : ''}`,
            data: JSON.stringify({
              paymentId: payment.id,
              orderId: payment.orderId,
              billSplitId: payment.billSplitId,
              amountCents: payment.amountCents,
              method: providerName,
              fullyPaid,
            }),
          },
        })

        // Emit real-time event for payment received
        emitEvent({
          type: 'payment_received',
          restaurantId,
          orderId: payment.orderId,
          amountCents: payment.amountCents,
          method: providerName,
        })

        // Fire-and-forget: notify external integrations (Mini ERP, etc.)
        dispatchPOSWebhook(restaurantId, 'payment.received', {
          paymentId: payment.id,
          orderId: payment.orderId,
          amountCents: payment.amountCents,
          method: providerName,
          provider: providerName,
        }).catch((err) => console.error('[POS_WEBHOOK_PAYMENT_RECEIVED]', err))

        return NextResponse.json({ received: true, verified: true })
      }

      // ── Non-Split Payment Handling (original logic) ──
      // Use updateMany with status check to prevent double-processing (race condition)
      // Only transition if order hasn't already been completed
      const orderUpdate = await db.order.updateMany({
        where: {
          id: payment.orderId,
          status: { not: 'completed' },
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
          paidAt: new Date(),
          tipAmountCents: payment.tipAmountCents,
        },
      })

      if (orderUpdate.count === 0) {
        // Order already completed — skip duplicate processing
        console.info('[WEBHOOK_ORDER_ALREADY_COMPLETED]', { orderId: payment.orderId })
        return NextResponse.json({ received: true, verified: true, status: 'already_completed' })
      }

      // Create notification for payment success
      await db.notification.create({
        data: {
          restaurantId,
          branchId: payment.branchId,
          type: 'payment_success',
          channel: 'in_app',
          title: 'Payment Received',
          message: `Payment of ${fromCents(payment.amountCents)} ETB for order has been completed via ${providerName}.`,
          data: JSON.stringify({
            paymentId: payment.id,
            orderId: payment.orderId,
            amountCents: payment.amountCents,
            method: providerName,
          }),
        },
      })

      // Emit real-time event for payment received
      emitEvent({
        type: 'payment_received',
        restaurantId,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
        method: providerName,
      })

      // Fire-and-forget: notify external integrations (Mini ERP, etc.)
      dispatchPOSWebhook(restaurantId, 'payment.received', {
        paymentId: payment.id,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
        method: providerName,
        provider: providerName,
      }).catch((err) => console.error('[POS_WEBHOOK_PAYMENT_RECEIVED]', err))

      console.info('[WEBHOOK_PAYMENT_COMPLETED]', {
        provider: providerName,
        paymentId: payment.id,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
      })

      // Credit loyalty points for the completed order
      creditLoyaltyPoints(payment.orderId, restaurantId).catch((err) =>
        console.error('[WEBHOOK_LOYALTY_CREDIT_ERROR]', err)
      )
    }

    return NextResponse.json({ received: true, verified: true })
  } catch (error) {
    console.error('[PAYMENT_WEBHOOK]', error)
    // Return 200 to prevent provider retries on our errors
    return NextResponse.json({ received: true, error: 'Internal processing error' })
  }
}

/**
 * GET /api/restaurants/[id]/payments/webhook/[provider]
 * Handle payment provider webhooks via GET (redirect callbacks).
 * Some providers (e.g., Chapa) may redirect the customer back
 * with query parameters after payment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; provider: string }> }
) {
  try {
    const { id: restaurantId, provider: providerName } = await params

    const validProviders: PaymentMethod[] = ['telebirr', 'chapa', 'cbe_birr', 'cash', 'starpay']
    if (!validProviders.includes(providerName as PaymentMethod)) {
      return NextResponse.json(
        { error: `Unknown payment provider: ${providerName}` },
        { status: 400 }
      )
    }

    if (providerName === 'cash') {
      return NextResponse.json(
        { error: 'Cash payments do not support webhooks' },
        { status: 400 }
      )
    }

    const provider = getPaymentProvider(providerName as PaymentMethod)

    // Extract query parameters as the webhook payload
    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    // Remove internal gateway params
    delete queryParams['XTransformPort']

    // Collect headers for signature verification
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Let the provider handle the webhook
    const verification = await provider.handleWebhook(queryParams, headers)

    // Find the payment by provider reference
    const payment = await db.payment.findFirst({
      where: {
        reference: verification.providerReference,
        restaurantId,
      },
    })

    if (!payment) {
      // Redirect to a generic result page
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      return NextResponse.redirect(
        `${baseUrl}/payment/callback?status=${verification.status}&provider=${providerName}`
      )
    }

    // If payment already completed, record fee if not yet (race condition fix), then redirect
    if (payment.status === 'completed') {
      // Record fee if not yet recorded (idempotent)
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      return NextResponse.redirect(
        `${baseUrl}/payment/callback?orderId=${payment.orderId}&status=completed&provider=${providerName}`
      )
    }

    // Update payment if verified
    if (verification.verified && verification.status === 'completed') {
      const updateData: Record<string, unknown> = {
        status: 'completed',
        paidAt: verification.paidAt || new Date(),
      }

      if (verification.rawResponse) {
        updateData.providerResponse = JSON.stringify(verification.rawResponse)
      }

      await db.payment.update({
        where: { id: payment.id },
        data: updateData,
      })

      // Record platform fee (idempotent — fee computed on net revenue, excluding tip/tax/packaging)
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })

      // ── Split Payment Handling ──
      // If this payment is linked to a BillSplit, update the split and don't
      // auto-complete the order until ALL splits are paid.
      if (payment.billSplitId) {
        const { fullyPaid } = await updateBillSplitAfterPayment(payment.billSplitId, payment.amountCents)

        console.info('[WEBHOOK_GET_SPLIT_PAYMENT_COMPLETED]', {
          provider: providerName,
          paymentId: payment.id,
          orderId: payment.orderId,
          billSplitId: payment.billSplitId,
          amountCents: payment.amountCents,
          fullyPaid,
        })

        // Only complete the order when all splits for the order are fully paid
        const allSplitsPaid = await areAllSplitsPaid(payment.orderId)
        if (allSplitsPaid) {
          await db.order.updateMany({
            where: {
              id: payment.orderId,
              status: { not: 'completed' },
            },
            data: {
              status: 'completed',
              completedAt: new Date(),
              paidAt: new Date(),
              tipAmountCents: payment.tipAmountCents,
            },
          })

          // Credit loyalty points only when the full order is completed
          creditLoyaltyPoints(payment.orderId, restaurantId).catch((err) =>
            console.error('[WEBHOOK_GET_LOYALTY_CREDIT_ERROR]', err)
          )
        }
      } else {
        // ── Non-Split Payment Handling (original logic) ──
        // Update order respecting state machine — use updateMany to prevent race
        await db.order.updateMany({
          where: {
            id: payment.orderId,
            status: { not: 'completed' },
          },
          data: {
            status: 'completed',
            completedAt: new Date(),
            paidAt: new Date(),
            tipAmountCents: payment.tipAmountCents,
          },
        })

        // Credit loyalty points for the completed order
        creditLoyaltyPoints(payment.orderId, restaurantId).catch((err) =>
          console.error('[WEBHOOK_GET_LOYALTY_CREDIT_ERROR]', err)
        )
      }

      // Emit real-time event
      emitEvent({
        type: 'payment_received',
        restaurantId,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
        method: providerName,
      })

      // Fire-and-forget: notify external integrations (Mini ERP, etc.)
      dispatchPOSWebhook(restaurantId, 'payment.received', {
        paymentId: payment.id,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
        method: providerName,
        provider: providerName,
      }).catch((err) => console.error('[POS_WEBHOOK_PAYMENT_RECEIVED]', err))

      console.info('[WEBHOOK_GET_PAYMENT_COMPLETED]', {
        provider: providerName,
        paymentId: payment.id,
        orderId: payment.orderId,
      })
    }

    // Redirect customer to callback page
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${baseUrl}/payment/callback?orderId=${payment.orderId}&status=${verification.status}&provider=${providerName}`
    )
  } catch (error) {
    console.error('[PAYMENT_WEBHOOK_GET]', error)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${baseUrl}/payment/callback?status=error&message=webhook_processing_failed`
    )
  }
}

// ============================================================
// StarPay Webhook Handler — Multi-Tenant
// ============================================================

/**
 * Handle StarPay webhook callback with per-restaurant signature verification.
 *
 * Flow:
 * 1. Read raw body + X-Signature + X-Timestamp headers
 * 2. Fetch restaurant's webhookSecret from DB
 * 3. Verify HMAC-SHA256 signature
 * 4. Check timestamp freshness (replay protection)
 * 5. Find matching Payment by starpayOrderId or starpayBillRefNo
 * 6. Update payment status + record platform fee ledger entry
 * 7. Update order status + emit events
 */
async function handleStarPayWebhook(
  request: NextRequest,
  restaurantId: string
): Promise<NextResponse> {
  try {
    // Read raw body as text for signature verification
    const rawBody = await request.text()
    let payload: StarPayCallbackPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.error('[STARPAY_WEBHOOK] Invalid JSON payload')
      return NextResponse.json({ received: true, error: 'Invalid JSON' })
    }

    // Extract signature headers
    const signature = request.headers.get('x-signature') || ''
    const timestamp = request.headers.get('x-timestamp') || ''

    console.log('[STARPAY_WEBHOOK]', {
      restaurantId,
      billRefNo: payload.billRefNo,
      status: payload.status,
      amount: payload.amount,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
    })

    // Fetch restaurant's StarPay config for signature verification
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        starPayEnabled: true,
        starPayWebhookSecret: true,
        starPayMerchantId: true,
        // Fee rate is now on the restaurant itself (decoupled from subscription plan)
        feeRate: true,
      },
    })

    if (!restaurant?.starPayEnabled) {
      console.warn('[STARPAY_WEBHOOK] StarPay not enabled for restaurant:', restaurantId)
      return NextResponse.json({ received: true, error: 'StarPay not enabled' })
    }

    // ── Signature Verification ──
    let callbackVerified = false

    if (signature && timestamp) {
      // Check timestamp freshness (5 min window)
      if (!isFreshCallback(timestamp)) {
        console.warn('[STARPAY_WEBHOOK] Stale callback:', timestamp)
        // Still return 200 to prevent retries
        return NextResponse.json({ received: true, error: 'Stale callback' })
      }

      // Verify HMAC-SHA256 signature
      if (restaurant.starPayWebhookSecret) {
        callbackVerified = verifySignature(
          payload,
          timestamp,
          signature,
          restaurant.starPayWebhookSecret
        )
        if (!callbackVerified) {
          console.error('[STARPAY_WEBHOOK] Signature verification FAILED')
          return NextResponse.json({ received: true, verified: false })
        }
      } else {
        // Sandbox mode: no webhook secret configured
        console.warn('[STARPAY_WEBHOOK] No webhook secret — accepting without signature verification')
        callbackVerified = true
      }
    } else {
      console.warn('[STARPAY_WEBHOOK] Missing X-Signature or X-Timestamp headers')
    }

    // ── Find matching Payment ──
    // Search by starpayOrderId, starpayBillRefNo, or reference (billRefNo)
    const payment = await db.payment.findFirst({
      where: {
        restaurantId,
        OR: [
          { starpayOrderId: payload.billRefNo },
          { starpayBillRefNo: payload.billRefNo },
          { reference: payload.billRefNo },
        ],
      },
    })

    if (!payment) {
      console.warn('[STARPAY_WEBHOOK] Payment not found:', {
        billRefNo: payload.billRefNo,
        restaurantId,
      })
      return NextResponse.json({ received: true, warning: 'Payment not found' })
    }

    // Prevent duplicate processing — record fee if not yet recorded (race condition fix)
    if (payment.status === 'completed') {
      console.info('[STARPAY_WEBHOOK] Already completed:', payment.id)
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })
      return NextResponse.json({ received: true, status: 'already_completed' })
    }

    // ── Update Payment Status ──
    const isPaid = payload.status === 'PAID' || payload.status === 'SETTLED'

    const updateData: Record<string, unknown> = {
      status: isPaid ? 'completed' : 'failed',
      callbackVerified,
      providerResponse: JSON.stringify(payload),
    }

    if (isPaid) {
      updateData.paidAt = new Date()
      updateData.starpayBillRefNo = payload.billRefNo
      updateData.starpayPaymentType = payload.payment_type || null
      updateData.starpayCustomerId = payload.customerId || null
      updateData.receiptUrl = payload.receipt_url || payment.receiptUrl
    } else {
      updateData.failedAt = new Date()
    }

    await db.payment.update({
      where: { id: payment.id },
      data: updateData,
    })

    // ── On successful payment: update order + record platform fee ──
    if (isPaid) {
      // Record platform fee via the centralized helper (computes fee on net revenue,
      // excluding tip/tax/packaging/delivery; idempotent via paymentId @unique)
      await recordPlatformFee({
        restaurantId,
        paymentId: payment.id,
        orderId: payment.orderId,
        branchId: payment.branchId,
        amountCents: payment.amountCents,
        tipAmountCents: payment.tipAmountCents,
      })

      // ── Split Payment Handling ──
      if (payment.billSplitId) {
        const { fullyPaid } = await updateBillSplitAfterPayment(payment.billSplitId, payment.amountCents)

        console.info('[STARPAY_WEBHOOK_SPLIT_PAYMENT_COMPLETED]', {
          paymentId: payment.id,
          orderId: payment.orderId,
          billSplitId: payment.billSplitId,
          amountCents: payment.amountCents,
          fullyPaid,
        })

        const allSplitsPaid = await areAllSplitsPaid(payment.orderId)
        if (allSplitsPaid) {
          const orderUpdate = await db.order.updateMany({
            where: { id: payment.orderId, status: { not: 'completed' } },
            data: {
              status: 'completed',
              completedAt: new Date(),
              paidAt: new Date(),
              tipAmountCents: payment.tipAmountCents,
            },
          })

          if (orderUpdate.count > 0) {
            creditLoyaltyPoints(payment.orderId, restaurantId).catch((err) =>
              console.error('[STARPAY_WEBHOOK_LOYALTY_ERROR]', err)
            )
          }
        }

        await db.notification.create({
          data: {
            restaurantId,
            branchId: payment.branchId,
            type: 'payment_success',
            channel: 'in_app',
            title: 'StarPay Split Payment Received',
            message: `Split payment of ${fromCents(payment.amountCents)} ETB completed via StarPay.${fullyPaid ? ' All splits are now paid.' : ''}`,
            data: JSON.stringify({
              paymentId: payment.id,
              orderId: payment.orderId,
              billSplitId: payment.billSplitId,
              amountCents: payment.amountCents,
              method: 'starpay',
              fullyPaid,
            }),
          },
        })

        emitEvent({
          type: 'payment_received',
          restaurantId,
          orderId: payment.orderId,
          amountCents: payment.amountCents,
          method: 'starpay',
        })

        // Fire-and-forget: notify external integrations (Mini ERP, etc.)
        dispatchPOSWebhook(restaurantId, 'payment.received', {
          paymentId: payment.id,
          orderId: payment.orderId,
          amountCents: payment.amountCents,
          method: 'starpay',
          provider: 'starpay',
        }).catch((err) => console.error('[POS_WEBHOOK_PAYMENT_RECEIVED]', err))

        return NextResponse.json({ received: true, verified: callbackVerified })
      }

      // ── Non-Split Payment ──
      const orderUpdate = await db.order.updateMany({
        where: { id: payment.orderId, status: { not: 'completed' } },
        data: {
          status: 'completed',
          completedAt: new Date(),
          paidAt: new Date(),
          tipAmountCents: payment.tipAmountCents,
        },
      })

      if (orderUpdate.count > 0) {
        await db.notification.create({
          data: {
            restaurantId,
            branchId: payment.branchId,
            type: 'payment_success',
            channel: 'in_app',
            title: 'StarPay Payment Received',
            message: `Payment of ${fromCents(payment.amountCents)} ETB completed via StarPay.`,
            data: JSON.stringify({
              paymentId: payment.id,
              orderId: payment.orderId,
              amountCents: payment.amountCents,
              method: 'starpay',
            }),
          },
        })

        emitEvent({
          type: 'payment_received',
          restaurantId,
          orderId: payment.orderId,
          amountCents: payment.amountCents,
          method: 'starpay',
        })

        // Fire-and-forget: notify external integrations (Mini ERP, etc.)
        dispatchPOSWebhook(restaurantId, 'payment.received', {
          paymentId: payment.id,
          orderId: payment.orderId,
          amountCents: payment.amountCents,
          method: 'starpay',
          provider: 'starpay',
        }).catch((err) => console.error('[POS_WEBHOOK_PAYMENT_RECEIVED]', err))

        creditLoyaltyPoints(payment.orderId, restaurantId).catch((err) =>
          console.error('[STARPAY_WEBHOOK_LOYALTY_ERROR]', err)
        )
      }

      console.info('[STARPAY_WEBHOOK_PAYMENT_COMPLETED]', {
        paymentId: payment.id,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
      })
    }

    return NextResponse.json({ received: true, verified: callbackVerified })
  } catch (error) {
    console.error('[STARPAY_WEBHOOK_ERROR]', error)
    // Return 200 to prevent StarPay retries on our errors
    return NextResponse.json({ received: true, error: 'Internal processing error' })
  }
}
