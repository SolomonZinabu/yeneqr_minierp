// ============================================================
// Yene QR — Platform Fee Billing API
// Generate invoices from unbilled PlatformFeeLedger entries
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { fromCents } from '@/lib/money'

/**
 * GET /api/restaurants/[id]/billing
 * Get billing overview: unbilled fees, recent invoices, summary stats.
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
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Get unbilled ledger entries
    const unbilledEntries = await db.platformFeeLedger.findMany({
      where: { restaurantId, status: 'unbilled' },
      orderBy: { createdAt: 'desc' },
    })

    const totalUnbilledCents = unbilledEntries.reduce((sum, e) => sum + e.feeAmountCents, 0)
    const unbilledCount = unbilledEntries.length

    // Get recent invoices
    const [invoices, invoiceTotal] = await Promise.all([
      db.platformFeeInvoice.findMany({
        where: { restaurantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { ledgerEntries: true } },
        },
      }),
      db.platformFeeInvoice.count({ where: { restaurantId } }),
    ])

    // Get total fees (all time, excluding reversed entries from refunded payments)
    const totalFeesAllTime = await db.platformFeeLedger.aggregate({
      where: { restaurantId, status: { not: 'reversed' } },
      _sum: { feeAmountCents: true },
    })

    // Get total paid (excludes reversed — reversed entries are neither paid nor unbilled)
    const totalPaid = await db.platformFeeLedger.aggregate({
      where: { restaurantId, status: 'paid' },
      _sum: { feeAmountCents: true },
    })

    return NextResponse.json({
      data: {
        summary: {
          unbilledCents: totalUnbilledCents,
          unbilledAmount: fromCents(totalUnbilledCents),
          unbilledCount,
          totalFeesAllTimeCents: totalFeesAllTime._sum.feeAmountCents || 0,
          totalPaidCents: totalPaid._sum.feeAmountCents || 0,
          outstandingCents: (totalFeesAllTime._sum.feeAmountCents || 0) - (totalPaid._sum.feeAmountCents || 0),
        },
        unbilledEntries,
        invoices: invoices.map(inv => ({
          ...inv,
          totalFeeAmount: fromCents(inv.totalFeeCents),
          entryCount: inv._count.ledgerEntries,
        })),
        pagination: {
          page,
          limit,
          total: invoiceTotal,
          totalPages: Math.ceil(invoiceTotal / limit),
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BILLING_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 })
  }
}

/**
 * POST /api/restaurants/[id]/billing
 * Generate an invoice from all unbilled platform fee ledger entries.
 *
 * Body: {
 *   periodStart?: string (ISO date),
 *   periodEnd?: string (ISO date),
 *   dueInDays?: number (default 30)
 * }
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
    const { periodStart, periodEnd, dueInDays = 30 } = body as {
      periodStart?: string
      periodEnd?: string
      dueInDays?: number
    }

    // Get unbilled entries
    const unbilledEntries = await db.platformFeeLedger.findMany({
      where: {
        restaurantId,
        status: 'unbilled',
        ...(periodStart || periodEnd
          ? {
              createdAt: {
                ...(periodStart ? { gte: new Date(periodStart) } : {}),
                ...(periodEnd ? { lte: new Date(periodEnd) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    })

    if (unbilledEntries.length === 0) {
      return NextResponse.json(
        { error: 'No unbilled entries to invoice' },
        { status: 400 }
      )
    }

    const totalFeeCents = unbilledEntries.reduce((sum, e) => sum + e.feeAmountCents, 0)

    // Determine billing period
    const actualPeriodStart = periodStart
      ? new Date(periodStart)
      : unbilledEntries[0].createdAt
    const actualPeriodEnd = periodEnd
      ? new Date(periodEnd)
      : unbilledEntries[unbilledEntries.length - 1].createdAt

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueInDays)

    // Create invoice and link ledger entries in a transaction
    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.platformFeeInvoice.create({
        data: {
          restaurantId,
          invoiceNumber: `PFI-${Date.now()}`,
          periodStart: actualPeriodStart,
          periodEnd: actualPeriodEnd,
          totalFeeCents,
          transactionCount: unbilledEntries.length,
          status: 'pending',
          dueDate,
        },
      })

      // Link all unbilled entries to this invoice
      await tx.platformFeeLedger.updateMany({
        where: {
          id: { in: unbilledEntries.map(e => e.id) },
        },
        data: {
          invoiceId: inv.id,
          status: 'invoiced',
        },
      })

      return inv
    })

    console.info('[BILLING_INVOICE_CREATED]', {
      restaurantId,
      invoiceId: invoice.id,
      totalFeeCents,
      transactionCount: unbilledEntries.length,
    })

    return NextResponse.json({
      data: {
        invoice: {
          ...invoice,
          totalFeeAmount: fromCents(totalFeeCents),
        },
        transactionCount: unbilledEntries.length,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BILLING_INVOICE_CREATE]', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
