// ============================================================
// Yene QR — Export Reports API (CSV/PDF)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function generateCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = rows.map((row) => row.map(escapeCSV).join(','))
  return [headerLine, ...dataLines].join('\n')
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * GET /api/restaurants/[id]/export?type=orders|revenue|items|customers&format=csv|pdf
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require restaurant:view permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const type = request.nextUrl.searchParams.get('type') || 'orders'
    const format = request.nextUrl.searchParams.get('format') || 'csv'
    const branchId = resolveBranchScope(auth, request.nextUrl.searchParams.get('branchId'))
    // Phase R10: date range filtering for exports
    const dateFrom = request.nextUrl.searchParams.get('dateFrom') || undefined
    const dateTo = request.nextUrl.searchParams.get('dateTo') || undefined

    // Build date range filter (applied to createdAt on all export types)
    const dateFilter: Record<string, unknown> = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) {
      const endOfDay = new Date(dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      dateFilter.lte = endOfDay
    }
    const dateRangeWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, currency: true },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    let csvHeaders: string[] = []
    let csvRows: string[][] = []
    let filename = ''

    switch (type) {
      case 'orders': {
        const ordersWhere: Record<string, unknown> = { restaurantId, ...dateRangeWhere }
        if (branchId) ordersWhere.branchId = branchId
        const orders = await db.order.findMany({
          where: ordersWhere,
          orderBy: { createdAt: 'desc' },
          include: {
            table: { select: { number: true } },
            customer: { select: { name: true, phone: true } },
            _count: { select: { items: true } },
          },
          take: 5000,
        })

        csvHeaders = [
          'Order Number',
          'Status',
          'Type',
          'Table',
          'Customer',
          'Items Count',
          'Subtotal',
          'Tax',
          'Service Charge',
          'Discount',
          'Tip',
          'Total',
          'Created At',
        ]

        csvRows = orders.map((o) => [
          o.orderNumber,
          o.status,
          o.type,
          o.table?.number || '-',
          o.customer?.name || 'Walk-in',
          String(o._count.items),
          String(o.subtotalCents),
          String(o.taxAmountCents),
          String(o.serviceChargeCents),
          String(o.discountAmountCents),
          String(o.tipAmountCents),
          String(o.totalAmountCents),
          formatDate(o.createdAt),
        ])

        filename = `orders-export-${Date.now()}`
        break
      }

      case 'revenue': {
        const revenueWhere: Record<string, unknown> = {
          restaurantId,
          ...dateRangeWhere,
          status: { in: ['completed', 'served'] },
        }
        if (branchId) revenueWhere.branchId = branchId
        const orders = await db.order.findMany({
          where: revenueWhere,
          orderBy: { createdAt: 'desc' },
          select: {
            totalAmountCents: true,
            subtotalCents: true,
            taxAmountCents: true,
            serviceChargeCents: true,
            discountAmountCents: true,
            tipAmountCents: true,
            createdAt: true,
          },
          take: 5000,
        })

        // Group by date
        const dateMap = new Map<string, {
          revenue: number
          tax: number
          service: number
          discount: number
          tip: number
          orderCount: number
        }>()

        for (const o of orders) {
          const date = formatDate(o.createdAt)
          const existing = dateMap.get(date) || { revenue: 0, tax: 0, service: 0, discount: 0, tip: 0, orderCount: 0 }
          existing.revenue += o.totalAmountCents
          existing.tax += o.taxAmountCents
          existing.service += o.serviceChargeCents
          existing.discount += o.discountAmountCents
          existing.tip += o.tipAmountCents
          existing.orderCount += 1
          dateMap.set(date, existing)
        }

        csvHeaders = [
          'Date',
          'Orders',
          'Revenue',
          'Tax',
          'Service Charge',
          'Discounts',
          'Tips',
          'Net Revenue',
        ]

        const sortedDates = Array.from(dateMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))

        csvRows = sortedDates.map(([date, data]) => [
          date,
          String(data.orderCount),
          String(data.revenue),
          String(data.tax),
          String(data.service),
          String(data.discount),
          String(data.tip),
          String(data.revenue - data.discount),
        ])

        filename = `revenue-export-${Date.now()}`
        break
      }

      case 'items': {
        const items = await db.menuItem.findMany({
          where: { restaurantId },
          include: {
            category: { select: { name: true } },
            comboItems: {
              include: {
                menuItem: { select: { name: true } },
              },
            },
          },
          orderBy: { name: 'asc' },
          take: 5000,
        })

        csvHeaders = [
          'Name',
          'Category',
          'Price',
          'Original Price',
          'Available',
          'Popular',
          'Vegetarian',
          'Spicy',
          'Prep Time (min)',
          'Is Combo',
          'Combo Items',
        ]

        csvRows = items.map((item) => [
          item.name,
          item.category.name,
          String(item.priceCents),
          item.originalPriceCents ? String(item.originalPriceCents) : '',
          item.isAvailable ? 'Yes' : 'No',
          item.isPopular ? 'Yes' : 'No',
          item.isVegetarian ? 'Yes' : 'No',
          item.isSpicy ? 'Yes' : 'No',
          String(item.preparationTime),
          item.comboItems.length > 0 ? 'Yes' : 'No',
          item.comboItems.length > 0
            ? item.comboItems.map((ci) => `${ci.menuItem.name} x${ci.quantity}`).join('; ')
            : '',
        ])

        filename = `items-export-${Date.now()}`
        break
      }

      case 'customers': {
        const customers = await db.customer.findMany({
          where: { restaurantId },
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { orders: true } },
          },
          take: 5000,
        })

        csvHeaders = [
          'Name',
          'Phone',
          'Email',
          'Language',
          'Loyalty Points',
          'Total Orders',
          'Joined At',
        ]

        csvRows = customers.map((c) => [
          c.name || '-',
          c.phone || '-',
          c.email || '-',
          c.language,
          String(c.loyaltyPoints),
          String(c._count.orders),
          formatDate(c.createdAt),
        ])

        filename = `customers-export-${Date.now()}`
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }

    if (format === 'csv') {
      const csv = generateCSV(csvHeaders, csvRows)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      })
    }

    // PDF format — generate simple HTML report that can be printed as PDF
    if (format === 'pdf') {
      const title = type.charAt(0).toUpperCase() + type.slice(1)
      const tableRows = csvRows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td style="border:1px solid #ddd;padding:6px 10px;">${cell}</td>`).join('')}</tr>`
        )
        .join('')
      const tableHeaders = csvHeaders
        .map((h) => `<th style="border:1px solid #ddd;padding:6px 10px;background:#039D55;color:white;text-align:left;">${h}</th>`)
        .join('')

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} Report — ${restaurant.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1a1a1a; }
    h1 { color: #039D55; margin-bottom: 4px; }
    p.subtitle { color: #666; margin-top: 0; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    tr:nth-child(even) { background: #f9f9f9; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${restaurant.name} — ${title} Report</h1>
  <p class="subtitle">Generated on ${new Date().toLocaleString()} | Total records: ${csvRows.length}</p>
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.html"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[EXPORT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    )
  }
}
