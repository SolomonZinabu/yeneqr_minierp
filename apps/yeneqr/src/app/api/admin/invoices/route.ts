// ============================================================
// Yene QR — Admin: Platform-wide Invoices API
// ============================================================
// Lists ALL invoices across the platform for super_admins.
// Used by the Admin Invoices view to track revenue,
// outstanding balances, and overdue accounts.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { syncBillingForAllSubscriptions } from '@/lib/billing'

/**
 * GET /api/admin/invoices
 * Query: status, planId, page, limit
 *
 * Returns invoices with restaurant + plan info, plus a
 * platform-wide summary (total billed, paid, outstanding).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const planId = searchParams.get('planId')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const skip = (page - 1) * limit

    // Build WHERE on the invoice + nested subscription/plan filters
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (planId) {
      where.subscription = { planId }
    }

    // Run billing maintenance first (best-effort)
    try {
      await syncBillingForAllSubscriptions()
    } catch (e) {
      console.error('[ADMIN_BILLING_SYNC]', e)
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          subscription: {
            select: {
              id: true,
              status: true,
              plan: {
                select: { id: true, name: true, slug: true, priceCents: true },
              },
              restaurant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  city: true,
                  cuisineType: true,
                  isSuspended: true,
                },
              },
            },
          },
        },
      }),
      db.invoice.count({ where }),
    ])

    // Platform-wide summary (all invoices, ignoring filters)
    const allInvoices = await db.invoice.findMany({
      select: { status: true, totalCents: true, amountCents: true, taxCents: true, dueDate: true },
    })
    const now = new Date()
    const summary = {
      count: allInvoices.length,
      totalBilledCents: allInvoices.reduce((s, i) => s + i.totalCents, 0),
      totalTaxCents: allInvoices.reduce((s, i) => s + i.taxCents, 0),
      paidCents: allInvoices
        .filter(i => i.status === 'paid')
        .reduce((s, i) => s + i.totalCents, 0),
      pendingCents: allInvoices
        .filter(i => i.status === 'pending' && i.dueDate >= now)
        .reduce((s, i) => s + i.totalCents, 0),
      overdueCents: allInvoices
        .filter(i => (i.status === 'pending' && i.dueDate < now) || i.status === 'overdue')
        .reduce((s, i) => s + i.totalCents, 0),
      cancelledCents: allInvoices
        .filter(i => i.status === 'cancelled')
        .reduce((s, i) => s + i.totalCents, 0),
    }

    // Group by plan for revenue breakdown
    const planBreakdownRaw = await db.invoice.groupBy({
      by: ['status'],
      _sum: { totalCents: true },
      _count: { id: true },
    })
    const byStatus = planBreakdownRaw.map((r) => ({
      status: r.status,
      count: r._count.id,
      totalCents: r._sum.totalCents || 0,
    }))

    return NextResponse.json({
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
      byStatus,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_INVOICES_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}
