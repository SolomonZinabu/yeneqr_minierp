// ============================================================
// Daily Sales Report API (Z-Report for Gebioch/Tax Compliance)
// ============================================================
// GET /api/restaurants/[id]/analytics/daily-sales?date=YYYY-MM-DD
//
// Returns a comprehensive daily sales summary:
//   - Total sales, VAT, service charges, discounts, tips, refunds
//   - Breakdown by payment method
//   - Receipt audit trail (sequential numbers)
//   - Tax-exempt sales
//
// Used by the Z-Report dashboard panel for end-of-day tax filing.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permErr = requirePerm(auth, 'analytics:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Parse date and set bounds (full day in server timezone)
    const date = new Date(dateStr + 'T00:00:00')
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Fetch all orders for the day
    const orders = await db.order.findMany({
      where: {
        restaurantId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { not: 'cancelled' },
      },
      include: {
        payments: {
          select: {
            id: true,
            amountCents: true,
            status: true,
            method: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch restaurant info
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        name: true,
        taxRate: true,
        serviceCharge: true,
        settings: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Parse restaurant settings for TIN/VAT
    let tin: string | undefined
    let vat: string | undefined
    if (restaurant.settings) {
      try {
        const settings = typeof restaurant.settings === 'string'
          ? JSON.parse(restaurant.settings)
          : restaurant.settings
        tin = settings?.fiscal?.tin
        vat = settings?.fiscal?.vat
      } catch {}
    }

    // Calculate totals
    let totalSalesCents = 0
    let totalVatCents = 0
    let totalServiceChargeCents = 0
    let totalDiscountsCents = 0
    let totalTipsCents = 0
    let taxExemptSalesCents = 0

    const paymentMethodMap = new Map<string, { count: number; amountCents: number }>()

    for (const order of orders) {
      totalSalesCents += order.totalAmountCents
      totalVatCents += order.taxAmountCents
      totalServiceChargeCents += order.serviceChargeCents
      totalDiscountsCents += order.discountAmountCents
      totalTipsCents += order.tipAmountCents

      // Check for tax-exempt items (if taxRate is 0 on the order or items)
      // For simplicity, we treat orders with taxAmountCents=0 as tax-exempt
      if (order.taxAmountCents === 0) {
        taxExemptSalesCents += order.totalAmountCents
      }

      // Aggregate payments by method (only completed payments)
      for (const payment of order.payments) {
        if (payment.status === 'completed') {
          const existing = paymentMethodMap.get(payment.method) || { count: 0, amountCents: 0 }
          existing.count++
          existing.amountCents += payment.amountCents
          paymentMethodMap.set(payment.method, existing)
        }
      }
    }

    // Fetch refunds for the day
    const refunds = await db.refund.findMany({
      where: {
        restaurantId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'completed',
      },
      select: { amountCents: true },
    })
    const totalRefundsCents = refunds.reduce((sum, r) => sum + r.amountCents, 0)

    // Calculate net sales
    const netSalesCents = totalSalesCents - totalDiscountsCents - totalRefundsCents

    // Get receipt audit info
    // Use order numbers as receipt numbers (they're sequential per restaurant)
    const receiptCount = orders.length
    const firstReceiptNumber = orders[0]?.orderNumber || ''
    const lastReceiptNumber = orders[orders.length - 1]?.orderNumber || ''

    // Build byPaymentMethod array
    const byPaymentMethod = Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amountCents: data.amountCents,
    }))

    // Build orders array for detailed view
    const ordersArray = orders.map(o => ({
      orderNumber: o.orderNumber,
      totalAmountCents: o.totalAmountCents,
      taxAmountCents: o.taxAmountCents,
      paymentMethod: o.payments.find(p => p.status === 'completed')?.method || 'unpaid',
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    }))

    const report = {
      date: dateStr,
      restaurant: {
        name: restaurant.name,
        tin,
        vat,
      },
      summary: {
        totalSalesCents,
        totalVatCents,
        totalServiceChargeCents,
        totalDiscountsCents,
        totalTipsCents,
        totalRefundsCents,
        taxExemptSalesCents,
        netSalesCents,
      },
      byPaymentMethod,
      orderCount: orders.length,
      receiptCount,
      firstReceiptNumber,
      lastReceiptNumber,
      orders: ordersArray,
    }

    return NextResponse.json({ data: report })
  } catch (error) {
    console.error('[DAILY_SALES_REPORT]', error)
    return NextResponse.json(
      { error: 'Failed to generate daily sales report' },
      { status: 500 }
    )
  }
}
