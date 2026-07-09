// ============================================================
// Yene QR — Payments API (List, Initiate)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, getAuthContext, resolveBranchScope } from '@/lib/api-auth'
import { getPaymentProvider, getStarPayProvider, calculatePayment, type PaymentMethod } from '@/lib/payments'
import { emitEvent } from '@/lib/realtime'
import { notifyPaymentReceived } from '@/lib/notifications'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'
import { toCents } from '@/lib/money'
import { updateBillSplitAfterPayment, parseSplitData } from '@/lib/bill-split'

/**
 * GET /api/restaurants/[id]/payments
 * List payments for a restaurant with optional filters.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'payment:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const status = searchParams.get('status')
    const method = searchParams.get('method')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId }

    if (orderId) where.orderId = orderId
    if (branchId) where.branchId = branchId
    if (status) where.status = status
    if (method) where.method = method
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo)
      where.createdAt = createdAt
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmountCents: true,
              status: true,
            },
          },
        },
      }),
      db.payment.count({ where }),
    ])

    return NextResponse.json({
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PAYMENTS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/payments
 * Initiate a payment for an order.
 * Body: { orderId, method: PaymentMethod, tipAmount?, billSplitId?, splitIndex? }
 * tipAmount is in ETB (will be converted to cents for storage)
 * billSplitId + splitIndex: when paying a split portion, charge only that portion's amount
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // ── Rate Limiting ──
    const clientIp = getClientIp(request)
    const rateLimitKey = `payment:${clientIp}:${restaurantId}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.api)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many payment requests. Please try again later.', retryAfterMs: rateLimitResult.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const auth = getAuthContext(request)

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Customers can initiate payments for their own orders at this restaurant
    if (auth.type === 'customer') {
      if (auth.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Staff/admin must have payment:manage permission for this restaurant
      const permErr = requirePerm(auth, 'payment:manage', restaurantId)
      if (permErr) return permErr
    }

    const body = await request.json()
    const { orderId, method, tipAmount = 0, billSplitId, splitIndex } = body as {
      orderId: string
      method: PaymentMethod
      tipAmount?: number // ETB
      billSplitId?: string
      splitIndex?: number
    }

    const isSplitPayment = !!(billSplitId && splitIndex !== undefined)

    if (!orderId || !method) {
      return NextResponse.json(
        { error: 'orderId and method are required' },
        { status: 400 }
      )
    }

    const validMethods: PaymentMethod[] = ['telebirr', 'chapa', 'cbe_birr', 'cash', 'starpay']
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid payment method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      )
    }

    if (tipAmount < 0) {
      return NextResponse.json(
        { error: 'Tip amount cannot be negative' },
        { status: 400 }
      )
    }

    // Convert tip from ETB to cents
    const tipAmountCents = toCents(tipAmount)

    // Verify order exists and belongs to this restaurant
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        table: { select: { id: true, number: true } },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // For customer tokens, verify the order belongs to their table/session
    if (auth.type === 'customer') {
      const customerAuth = auth as { type: 'customer'; tableId?: string; sessionId?: string; restaurantId: string }
      if (order.tableId !== customerAuth.tableId) {
        return NextResponse.json({ error: 'Forbidden — you can only pay for orders at your table' }, { status: 403 })
      }
    }

    // Check if order is ALREADY FULLY PAID (not just has any completed payment)
    // This allows multi-round ordering: customer pays round 1, adds round 2,
    // then pays the difference. Only reject if total paid >= order total.
    // For split payments, multiple partial payments are expected — skip this check
    if (!isSplitPayment) {
      const completedPayments = order.payments.filter((p) => p.status === 'completed')
      if (completedPayments.length > 0) {
        const totalPaidCents = completedPayments.reduce((sum, p) => sum + p.amountCents, 0)
        if (totalPaidCents >= order.totalAmountCents) {
          return NextResponse.json(
            { error: 'This order has already been fully paid.' },
            { status: 400 }
          )
        }
        // Order has partial payment but isn't fully paid — allow another payment
        // for the remaining balance (calculated below)
      }
    }

    // Check if order already has a pending/processing payment with the same method
    // For split payments, allow multiple pending payments (different split portions)
    if (!isSplitPayment) {
      const existingPendingPayment = order.payments.find(
        (p) => (p.status === 'pending' || p.status === 'processing') && p.method === method
      )
      if (existingPendingPayment) {
        return NextResponse.json(
          { error: 'A pending payment already exists for this order with the same method' },
          { status: 400 }
        )
      }
    }

    // Determine payment amount
    let baseAmountCents: number

    if (isSplitPayment) {
      // Fetch the BillSplit and get the amount for this splitIndex
      const billSplit = await db.billSplit.findUnique({
        where: { id: billSplitId! },
      })

      if (!billSplit) {
        return NextResponse.json(
          { error: 'Bill split not found' },
          { status: 404 }
        )
      }

      if (billSplit.orderId !== orderId) {
        return NextResponse.json(
          { error: 'Bill split does not belong to this order' },
          { status: 400 }
        )
      }

      if (billSplit.status === 'paid') {
        return NextResponse.json(
          { error: 'Bill split is already fully paid' },
          { status: 400 }
        )
      }

      const splitData = parseSplitData(billSplit.splitData)
      const splitEntry = splitData[splitIndex!]

      if (!splitEntry) {
        return NextResponse.json(
          { error: `Invalid split index ${splitIndex}. Split has ${splitData.length} portions.` },
          { status: 400 }
        )
      }

      baseAmountCents = splitEntry.amountCents
    } else {
      // ── Charge only the REMAINING balance, not the full order total ──
      // This supports multi-round ordering: customer pays for round 1, adds
      // round 2, then pays just the difference (not the full new total).
      // Sum all existing completed payments and subtract from order total.
      const existingPayments = await db.payment.findMany({
        where: { orderId: order.id, status: 'completed' },
        select: { amountCents: true },
      })
      const alreadyPaidCents = existingPayments.reduce((sum, p) => sum + p.amountCents, 0)
      baseAmountCents = Math.max(0, order.totalAmountCents - alreadyPaidCents)

      // If already fully paid, reject (prevents double-charging)
      if (baseAmountCents === 0) {
        return NextResponse.json(
          { error: 'This order has already been fully paid.' },
          { status: 400 }
        )
      }
    }

    // Calculate payment amount including tip (all in cents)
    const totalAmountCents = baseAmountCents + tipAmountCents

    // Get restaurant details for payment context
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        currency: true,
        taxRate: true,
        serviceCharge: true,
        starPayEnabled: true,
        starPayApiUrl: true,
        starPayApiSecret: true,
        starPayMerchantId: true,
        starPayWebhookSecret: true,
      },
    })

    // ── StarPay-specific validation ──
    if (method === 'starpay') {
      if (!restaurant?.starPayEnabled) {
        return NextResponse.json(
          { error: 'StarPay is not enabled for this restaurant. Please configure it in Settings.' },
          { status: 400 }
        )
      }
      if (!restaurant.starPayApiSecret || !restaurant.starPayMerchantId) {
        return NextResponse.json(
          { error: 'StarPay credentials are not configured for this restaurant.' },
          { status: 400 }
        )
      }
    }

    // Initiate payment with provider
    let paymentResult
    if (method === 'starpay') {
      // StarPay requires per-restaurant config
      const provider = getStarPayProvider({
        apiUrl: restaurant!.starPayApiUrl || 'https://starpayqa.starpayethiopia.com/v1/starpay-api',
        apiSecret: restaurant!.starPayApiSecret!,
        merchantId: restaurant!.starPayMerchantId!,
        webhookSecret: restaurant!.starPayWebhookSecret || '',
      })
      paymentResult = await provider.initiatePayment({
        orderId,
        amount: totalAmountCents / 100,
        tipAmount,
        currency: restaurant?.currency || 'ETB',
        method,
        returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/callback?orderId=${orderId}&provider=starpay`,
        webhookUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/restaurants/${restaurantId}/payments/webhook/starpay`,
      })
    } else {
      // Standard providers (telebirr, chapa, cbe_birr, cash)
      const provider = getPaymentProvider(method)
      paymentResult = await provider.initiatePayment({
        orderId,
        amount: totalAmountCents / 100,
        tipAmount,
        currency: restaurant?.currency || 'ETB',
        method,
        returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/callback?orderId=${orderId}`,
        webhookUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/restaurants/${restaurantId}/payments/webhook/${method}`,
      })
    }

    // Create payment record (store in cents)
    const paymentData: Record<string, unknown> = {
      orderId,
      restaurantId,
      branchId: order.branchId,
      amountCents: totalAmountCents,
      tipAmountCents,
      method,
      provider: method,
      status: paymentResult.status,
      reference: paymentResult.providerReference,
      providerResponse: paymentResult.rawResponse
        ? JSON.stringify(paymentResult.rawResponse)
        : null,
      receiptUrl: paymentResult.checkoutUrl || null,
      ...(isSplitPayment ? { billSplitId: billSplitId! } : {}),
    }

    // StarPay-specific fields: extract order_id and payment_url from raw response
    if (method === 'starpay' && paymentResult.rawResponse) {
      const rawData = paymentResult.rawResponse as { data?: { order_id?: string; payment_url?: string } }
      if (rawData.data) {
        paymentData.starpayOrderId = rawData.data.order_id || null
        paymentData.starpayPaymentUrl = rawData.data.payment_url || null
      }
      paymentData.receiptUrl = rawData.data?.payment_url || null
    }

    const payment = await db.payment.create({
      data: paymentData,
    })

    // Emit real-time events for payment initiation
    if (method === 'cash' && paymentResult.status === 'completed') {
      // Staff-initiated cash payment (instantly completed) — emit payment_received
      emitEvent({
        type: 'payment_received',
        restaurantId,
        orderId,
        amountCents: totalAmountCents,
        method,
      } as any)

      // Send push/in-app notification for payment received
      notifyPaymentReceived(restaurantId, order.orderNumber, totalAmountCents / 100, method).catch((err) =>
        console.error('[NOTIFY_PAYMENT_RECEIVED]', err)
      )
    } else if (method === 'cash' && paymentResult.status === 'pending') {
      // Customer-initiated cash payment — needs staff confirmation.
      // Emit cash_payment_pending to notify cashier/manager in real-time.
      emitEvent({
        type: 'cash_payment_pending',
        restaurantId,
        branchId: order.branchId,
        orderId,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
        tableId: order.tableId || undefined,
        tableNumber: order.table?.number?.toString() || undefined,
        amountCents: totalAmountCents,
      } as any)
    }

    // For split payments, update BillSplit paidAmountCents and status
    if (isSplitPayment) {
      const { fullyPaid } = await updateBillSplitAfterPayment(billSplitId!, totalAmountCents)

      if (fullyPaid) {
        // All splits are paid — mark the order as completed
        await db.order.updateMany({
          where: {
            id: orderId,
            status: { not: 'completed' },
          },
          data: {
            status: 'completed',
            completedAt: new Date(),
            paidAt: new Date(),
            tipAmountCents: payment.tipAmountCents,
          },
        })

        console.info('[SPLIT_PAYMENT_ORDER_COMPLETED]', { orderId, billSplitId })
      }
    }

    return NextResponse.json(
      {
        data: {
          payment,
          checkoutUrl: paymentResult.checkoutUrl,
          providerReference: paymentResult.providerReference,
          message: paymentResult.message,
          amountCents: totalAmountCents,
          orderTotalCents: order.totalAmountCents,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PAYMENT_INITIATE]', error)
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    )
  }
}
