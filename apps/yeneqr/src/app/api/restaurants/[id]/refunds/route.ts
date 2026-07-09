// ============================================================
// Yene QR — Refunds API (List, Initiate)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { logRefund } from '@/lib/audit-log'
import { toCents } from '@/lib/money'
import { dispatchPOSWebhook } from '@/lib/pos-webhook'

/**
 * GET /api/restaurants/[id]/refunds
 * List refunds for a restaurant with optional filters.
 * Query params: status, page, limit
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
    const status = searchParams.get('status')
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId }
    if (status) where.status = status
    if (branchId) where.branchId = branchId

    const [refunds, total] = await Promise.all([
      db.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
      }),
      db.refund.count({ where }),
    ])

    return NextResponse.json({
      data: refunds,
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
    console.error('[REFUNDS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch refunds' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/refunds
 * Initiate a refund for a payment.
 * Body: { paymentId, amount, reason }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'payment:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { paymentId, amount, reason } = body as {
      paymentId: string
      amount: number
      reason: string
    }

    if (!paymentId || !amount || !reason) {
      return NextResponse.json(
        { error: 'paymentId, amount, and reason are required' },
        { status: 400 }
      )
    }

    // amount is received in ETB from the client, convert to cents for comparison/storage
    const amountCents = toCents(amount)

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: 'Refund amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Verify payment exists and belongs to this restaurant
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

    if (payment.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed payments can be refunded' },
        { status: 400 }
      )
    }

    // Check if a refund already exists for this payment
    const existingRefund = await db.refund.findFirst({
      where: { paymentId },
    })

    if (existingRefund) {
      return NextResponse.json(
        { error: 'A refund already exists for this payment' },
        { status: 400 }
      )
    }

    // Validate refund amount doesn't exceed payment amount (both in cents)
    if (amountCents > payment.amountCents) {
      return NextResponse.json(
        { error: 'Refund amount cannot exceed payment amount' },
        { status: 400 }
      )
    }

    // Create the refund record (store amount in cents)
    const refund = await db.refund.create({
      data: {
        paymentId,
        restaurantId,
        branchId: payment.branchId || '',
        amountCents,
        reason,
        status: 'pending',
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

    // ── Audit Log ──
    logRefund({
      restaurantId,
      userId: auth.userId,
      performedByType: auth.type,
      refundId: refund.id,
      paymentId,
      amount: amountCents,
      reason,
      orderId: payment.orderId ?? undefined,
    }).catch((err) => console.error('[AUDIT_REFUND]', err))

    // Fire-and-forget: notify external integrations (Mini ERP, etc.)
    dispatchPOSWebhook(restaurantId, 'refund.issued', {
      refundId: refund.id,
      paymentId,
      orderId: payment.orderId,
      amountCents: refund.amountCents,
      reason,
      status: refund.status,
    }).catch((err) => console.error('[POS_WEBHOOK_REFUND_ISSUED]', err))

    return NextResponse.json({ data: refund }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[REFUND_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create refund' },
      { status: 500 }
    )
  }
}
