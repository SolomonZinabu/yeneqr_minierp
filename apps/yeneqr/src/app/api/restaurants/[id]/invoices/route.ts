// ============================================================
// Yene QR — Invoices API (List, Generate)
// ============================================================
// Lists subscription invoices for a restaurant, with optional
// status filter + pagination. Also supports POST to manually
// generate an invoice (e.g. for one-off charges).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { createInvoice, syncBillingForSubscription } from '@/lib/billing'

/**
 * GET /api/restaurants/[id]/invoices
 * List invoices for a restaurant.
 * Query: status (pending|paid|overdue|cancelled), page, limit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'subscription:manage', restaurantId)
    if (permErr) return permErr

    // Find the subscription
    const subscription = await db.subscription.findUnique({
      where: { restaurantId },
      select: { id: true },
    })

    if (!subscription) {
      return NextResponse.json({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        summary: { totalCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0, count: 0 },
      })
    }

    // Run billing maintenance: mark overdue, generate next period, sync status
    // Wrapped in try/catch so a failure here doesn't break the listing.
    try {
      await syncBillingForSubscription(subscription.id)
    } catch (e) {
      console.error('[BILLING_SYNC]', e)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { subscriptionId: subscription.id }
    if (status) where.status = status

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
              plan: {
                select: { id: true, name: true, slug: true, priceCents: true, yearlyPriceCents: true },
              },
            },
          },
        },
      }),
      db.invoice.count({ where }),
    ])

    // Compute summary across ALL invoices (not just the current page)
    const allInvoices = await db.invoice.findMany({
      where: { subscriptionId: subscription.id },
      select: { status: true, totalCents: true, dueDate: true },
    })

    const now = new Date()
    const summary = {
      count: allInvoices.length,
      totalCents: allInvoices.reduce((s, i) => s + i.totalCents, 0),
      paidCents: allInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalCents, 0),
      pendingCents: allInvoices
        .filter(i => i.status === 'pending' && i.dueDate >= now)
        .reduce((s, i) => s + i.totalCents, 0),
      overdueCents: allInvoices
        .filter(i => (i.status === 'pending' && i.dueDate < now) || i.status === 'overdue')
        .reduce((s, i) => s + i.totalCents, 0),
    }

    return NextResponse.json({
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVOICES_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/invoices
 * Manually create an invoice for the restaurant's subscription.
 * Body: { amountCents, description?, dueInDays? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'subscription:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { amountCents, description, dueInDays = 7 } = body as {
      amountCents: number
      description?: string
      dueInDays?: number
    }

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: 'amountCents must be greater than 0' },
        { status: 400 }
      )
    }

    const subscription = await db.subscription.findUnique({
      where: { restaurantId },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this restaurant' },
        { status: 404 }
      )
    }

    const invoice = await createInvoice({
      subscriptionId: subscription.id,
      restaurantId,
      amountCents,
      dueInDays,
      description,
      userId: auth.userId,
      performedByType: auth.type,
    })

    return NextResponse.json({ data: invoice, description }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVOICE_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
