// ============================================================
// Yene QR — Platform Fee Invoice Detail API
// PATCH: Mark a platform-fee invoice as paid / cancel it.
// GET:  Fetch a single platform-fee invoice with its ledger entries.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { markPlatformFeeInvoicePaid } from '@/lib/billing'
import { fromCents } from '@/lib/money'

/**
 * GET /api/restaurants/[id]/billing/[invoiceId]
 * Fetch a single platform-fee invoice with its ledger entries.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const { id: restaurantId, invoiceId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'payment:view', restaurantId)
    if (permErr) return permErr

    const invoice = await db.platformFeeInvoice.findFirst({
      where: { id: invoiceId, restaurantId },
      include: {
        ledgerEntries: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
        restaurant: {
          select: { id: true, name: true, email: true, phone: true, address: true, city: true },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...invoice,
        totalFeeAmount: fromCents(invoice.totalFeeCents),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PLATFORM_FEE_INVOICE_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

/**
 * PATCH /api/restaurants/[id]/billing/[invoiceId]
 * Update a platform-fee invoice status.
 *
 * Body: { status: 'paid' | 'cancelled' | 'pending', notes? }
 *
 * - 'paid': marks the invoice paid + propagates to all linked ledger entries
 * - 'cancelled': marks the invoice cancelled (ledger entries revert to 'unbilled')
 * - 'pending': only allowed from 'overdue' (re-extends)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const { id: restaurantId, invoiceId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'payment:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { status, notes } = body as { status?: string; notes?: string }

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const validStatuses = ['paid', 'cancelled', 'pending']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const existing = await db.platformFeeInvoice.findFirst({
      where: { id: invoiceId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Guard: cannot modify already-paid or cancelled invoices
    if (existing.status === 'paid' && status !== 'paid') {
      return NextResponse.json(
        { error: 'Cannot modify a paid invoice' },
        { status: 400 }
      )
    }
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot modify a cancelled invoice' },
        { status: 400 }
      )
    }

    // Handle each status transition
    if (status === 'paid') {
      const result = await markPlatformFeeInvoicePaid(invoiceId)
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to mark as paid' }, { status: 400 })
      }
    } else if (status === 'cancelled') {
      // Revert ledger entries to 'unbilled' so they can be re-invoiced later
      await db.$transaction([
        db.platformFeeInvoice.update({
          where: { id: invoiceId },
          data: { status: 'cancelled', notes: notes || existing.notes },
        }),
        db.platformFeeLedger.updateMany({
          where: { invoiceId },
          data: { status: 'unbilled', invoiceId: null },
        }),
      ])
    } else if (status === 'pending') {
      // Re-extend (only from 'overdue')
      if (existing.status !== 'overdue') {
        return NextResponse.json(
          { error: 'Can only re-extend overdue invoices' },
          { status: 400 }
        )
      }
      await db.platformFeeInvoice.update({
        where: { id: invoiceId },
        data: { status: 'pending' },
      })
    }

    // Fetch fresh data
    const refreshed = await db.platformFeeInvoice.findFirst({
      where: { id: invoiceId, restaurantId },
      include: { _count: { select: { ledgerEntries: true } } },
    })

    return NextResponse.json({
      data: refreshed
        ? { ...refreshed, totalFeeAmount: fromCents(refreshed.totalFeeCents), entryCount: refreshed._count.ledgerEntries }
        : null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PLATFORM_FEE_INVOICE_PATCH]', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}
