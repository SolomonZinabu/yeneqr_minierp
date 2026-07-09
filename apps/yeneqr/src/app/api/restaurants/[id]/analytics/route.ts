// ============================================================
// Yene QR — Analytics API (Enhanced)
// ============================================================
// Supports: date range picker, branch comparison, COGS/profit,
// loss tracking, customer ratios, heatmap data, reviews

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { getAnalyticsRange } from '@/lib/analytics'

interface AnalyticsPeriod {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  topItems: { itemId: string; name: string; quantity: number; revenue: number; costCents: number; profitMargin: number }[]
  ordersByHour: { hour: number; orderCount: number }[]
  salesTrend: { date: string; revenue: number; orders: number }[]
  totalTax?: number
  totalTips?: number
  uniqueCustomers?: number
  repeatCustomers?: number
  cancelledOrders?: number
  avgPrepTime?: number
  tableTurnover?: number
  totalCOGS?: number
  grossProfit?: number
  grossMargin?: number
  voidAmountCents?: number
  refundAmountCents?: number
  complimentAmountCents?: number
  totalLossCents?: number
}

interface HeatmapData {
  day: string
  dayIndex: number
  hours: { hour: number; orders: number }[]
}

interface ReviewSummary {
  avgRating: number
  totalReviews: number
  recentReviews: { id: string; rating: number; comment: string | null; customerName: string; createdAt: string }[]
  ratingDistribution: { rating: number; count: number }[]
}

interface BranchComparison {
  branchId: string
  branchName: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  uniqueCustomers: number
}

/**
 * GET /api/restaurants/[id]/analytics
 *
 * Query params:
 *   branchId          — filter by branch
 *   period            — today | yesterday | thisWeek | lastWeek | thisMonth | custom
 *   dateFrom          — start date (YYYY-MM-DD) for custom period
 *   dateTo            — end date (YYYY-MM-DD) for custom period
 *   compare           — if "branches", returns branch comparison data
 *   includeReviews    — if "true", includes review summary
 *   includeHeatmap    — if "true", includes 7-day heatmap data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'analytics:view', restaurantId)
    if (permErr) return permErr

    // Verify restaurant exists before running expensive aggregation queries
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    })
    if (!restaurant) {
      // Return empty analytics instead of 500 for non-existent restaurant
      return NextResponse.json({
        data: {
          today: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, topItems: [], ordersByHour: [], salesTrend: [], totalTax: 0, totalTips: 0, uniqueCustomers: 0, repeatCustomers: 0, cancelledOrders: 0, avgPrepTime: 0, tableTurnover: 0, totalCOGS: 0, grossProfit: 0, grossMargin: 0, voidAmountCents: 0, refundAmountCents: 0, complimentAmountCents: 0, totalLossCents: 0 },
          thisWeek: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, topItems: [], ordersByHour: [], salesTrend: [], totalTax: 0, totalTips: 0, uniqueCustomers: 0, repeatCustomers: 0, cancelledOrders: 0, avgPrepTime: 0, tableTurnover: 0, totalCOGS: 0, grossProfit: 0, grossMargin: 0, voidAmountCents: 0, refundAmountCents: 0, complimentAmountCents: 0, totalLossCents: 0 },
          thisMonth: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, topItems: [], ordersByHour: [], salesTrend: [], totalTax: 0, totalTips: 0, uniqueCustomers: 0, repeatCustomers: 0, cancelledOrders: 0, avgPrepTime: 0, tableTurnover: 0, totalCOGS: 0, grossProfit: 0, grossMargin: 0, voidAmountCents: 0, refundAmountCents: 0, complimentAmountCents: 0, totalLossCents: 0 },
          period: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, topItems: [], ordersByHour: [], salesTrend: [], totalTax: 0, totalTips: 0, uniqueCustomers: 0, repeatCustomers: 0, cancelledOrders: 0, avgPrepTime: 0, tableTurnover: 0, totalCOGS: 0, grossProfit: 0, grossMargin: 0, voidAmountCents: 0, refundAmountCents: 0, complimentAmountCents: 0, totalLossCents: 0 },
          liveStats: { pendingOrders: 0, activeTables: 0 },
          branches: [],
        },
      })
    }

    const { searchParams } = new URL(request.url)
    // SECURITY (Phase 2.3): resolveBranchScope forces auth.branchId for
    // branch-scoped roles and customers. Owners/managers can pass a branchId
    // to filter, or omit it to aggregate across all branches.
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const effectiveBranchId = branchId || null
    const period = searchParams.get('period') || 'thisWeek'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const includeBranchComparison = searchParams.get('compare') === 'branches'
    const includeReviews = searchParams.get('includeReviews') === 'true'
    const includeHeatmap = searchParams.get('includeHeatmap') === 'true'

    // ── Compute date range based on period ──
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    let rangeStart: Date
    let rangeEnd: Date = now

    switch (period) {
      case 'today':
        rangeStart = todayStart
        break
      case 'yesterday': {
        rangeStart = new Date(todayStart)
        rangeStart.setDate(rangeStart.getDate() - 1)
        rangeEnd = todayStart
        break
      }
      case 'thisWeek': {
        rangeStart = new Date(todayStart)
        rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay()) // Sunday
        break
      }
      case 'lastWeek': {
        rangeStart = new Date(todayStart)
        rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay() - 7)
        rangeEnd = new Date(todayStart)
        rangeEnd.setDate(rangeEnd.getDate() - rangeEnd.getDay())
        break
      }
      case 'thisMonth':
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'custom':
        if (dateFrom) {
          const [y, m, d] = dateFrom.split('-').map(Number)
          rangeStart = new Date(y, (m || 1) - 1, d || 1)
        } else {
          rangeStart = new Date(todayStart)
          rangeStart.setDate(rangeStart.getDate() - 7)
        }
        if (dateTo) {
          const [y, m, d] = dateTo.split('-').map(Number)
          rangeEnd = new Date(y, (m || 1) - 1, (d || 28) + 1) // +1 to include the day
        }
        break
      default:
        rangeStart = new Date(todayStart)
        rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay())
    }

    // ── Helper: compute period from aggregated data ──
    async function computePeriodFromAggregated(
      start: Date,
      end?: Date
    ): Promise<AnalyticsPeriod> {
      const dailyRows = await getAnalyticsRange(restaurantId, start, end || now, effectiveBranchId)

      let totalRevenue = 0
      let totalOrders = 0
      let totalTax = 0
      let totalTips = 0
      let uniqueCustomers = 0
      let repeatCustomers = 0
      let cancelledOrders = 0
      let prepTimeSum = 0
      let prepTimeCount = 0

      // itemMap uses revenueCents from AggregationResult.topItems
      const itemMap = new Map<string, { itemId: string; name: string; quantity: number; revenueCents: number }>()
      const hourMap = new Map<number, number>()
      for (let h = 0; h < 24; h++) hourMap.set(h, 0)

      const salesTrend: { date: string; revenue: number; orders: number }[] = []

      for (const day of dailyRows) {
        totalRevenue += day.totalRevenueCents
        totalOrders += day.totalOrders
        totalTax += day.totalTaxCents
        totalTips += day.totalTipsCents
        uniqueCustomers += day.uniqueCustomers
        repeatCustomers += day.repeatCustomers
        cancelledOrders += day.cancelledOrders

        if (day.avgPrepTime > 0) {
          prepTimeSum += day.avgPrepTime
          prepTimeCount++
        }

        for (const item of day.topItems) {
          const key = item.itemId || item.name
          const existing = itemMap.get(key)
          if (existing) {
            existing.quantity += item.quantity
            existing.revenueCents += item.revenueCents
          } else {
            itemMap.set(key, { itemId: item.itemId, name: item.name, quantity: item.quantity, revenueCents: item.revenueCents })
          }
        }

        for (const ph of day.peakHours) {
          hourMap.set(ph.hour, (hourMap.get(ph.hour) || 0) + ph.orderCount)
        }

        salesTrend.push({
          date: day.date,
          revenue: day.totalRevenueCents,
          orders: day.totalOrders,
        })
      }

      const avgOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0

      // ── COGS & Profit: fetch menu item costs for top items ──
      const topItemEntries = Array.from(itemMap.values())
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 10)

      // Fetch cost data for these items
      const menuItemIds = topItemEntries.map(i => i.itemId).filter(Boolean)
      const menuItems = menuItemIds.length > 0
        ? await db.menuItem.findMany({
            where: { id: { in: menuItemIds } },
            select: { id: true, costCents: true, priceCents: true },
          })
        : []

      const menuItemCostMap = new Map(menuItems.map(mi => [mi.id, mi.costCents || 0]))

      let totalCOGS = 0
      const topItemsWithProfit = topItemEntries.map(item => {
        const itemCostPer = menuItemCostMap.get(item.itemId) || 0
        const totalItemCost = itemCostPer * item.quantity
        totalCOGS += totalItemCost
        const itemRevenue = item.revenueCents
        const profit = itemRevenue - totalItemCost
        const profitMargin = itemRevenue > 0 ? Math.round((profit / itemRevenue) * 10000) / 100 : 0
        return {
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          revenue: Math.round(item.revenueCents * 100) / 100,
          costCents: totalItemCost,
          profitMargin,
        }
      })

      const grossProfit = totalRevenue - totalCOGS
      const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0

      const ordersByHour = Array.from(hourMap.entries())
        .map(([hour, orderCount]) => ({ hour, orderCount }))
        .sort((a, b) => a.hour - b.hour)

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        avgOrderValue,
        topItems: topItemsWithProfit,
        ordersByHour,
        salesTrend,
        totalTax: Math.round(totalTax * 100) / 100,
        totalTips: Math.round(totalTips * 100) / 100,
        uniqueCustomers,
        repeatCustomers,
        cancelledOrders,
        avgPrepTime: prepTimeCount > 0 ? Math.round((prepTimeSum / prepTimeCount) * 100) / 100 : 0,
        tableTurnover: 0,
        totalCOGS,
        grossProfit,
        grossMargin,
      }
    }

    // ── Compute loss tracking (voids/refunds) ──
    async function computeLossTracking(start: Date, end: Date) {
      const cancelledOrdersData = await db.order.findMany({
        where: {
          restaurantId,
          status: 'cancelled',
          cancelledAt: { gte: start, lt: end },
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        select: { totalAmountCents: true, cancellationReason: true },
      })

      // Complimentary / voided items from order events
      // SECURITY (Phase 2.5): apply effectiveBranchId filter — was previously
      // missing, so void amounts leaked across branches when a manager filtered
      // by branch.
      const voidEvents = await db.orderEvent.findMany({
        where: {
          restaurantId,
          event: { in: ['item_voided', 'order_voided'] },
          createdAt: { gte: start, lt: end },
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        select: { data: true },
      })

      let voidAmountCents = 0
      for (const ev of voidEvents) {
        try {
          const d = ev.data ? JSON.parse(ev.data) as Record<string, unknown> : null
          if (d && typeof d.amountCents === 'number') voidAmountCents += d.amountCents
        } catch {
          // Skip malformed JSON data
        }
      }

      const refundAmountCents = cancelledOrdersData.reduce((sum, o) => sum + o.totalAmountCents, 0)

      // Compliment items (kitchen errors etc) — estimate from order items with cancelled status
      const complimentItems = await db.orderItem.findMany({
        where: {
          restaurantId,
          kitchenStatus: 'cancelled',
          order: {
            createdAt: { gte: start, lt: end },
            status: { not: 'cancelled' }, // order wasn't cancelled, but item was voided
            ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
          },
        },
        select: { priceCents: true, quantity: true },
      })
      const complimentAmountCents = complimentItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)

      const totalLossCents = voidAmountCents + refundAmountCents + complimentAmountCents

      return { voidAmountCents, refundAmountCents, complimentAmountCents, totalLossCents }
    }

    // ── Compute 7-day heatmap ──
    async function computeHeatmap(start: Date, end: Date): Promise<HeatmapData[]> {
      const orders = await db.order.findMany({
        where: {
          restaurantId,
          status: { in: ['completed', 'served'] },
          createdAt: { gte: start, lt: end },
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        select: { createdAt: true },
      })

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayMap = new Map<number, Map<number, number>>()
      for (let d = 0; d < 7; d++) {
        dayMap.set(d, new Map())
        for (let h = 0; h < 24; h++) {
          dayMap.get(d)!.set(h, 0)
        }
      }

      for (const order of orders) {
        const date = new Date(order.createdAt)
        const dayOfWeek = date.getDay()
        const hour = date.getHours()
        const current = dayMap.get(dayOfWeek)!.get(hour) || 0
        dayMap.get(dayOfWeek)!.set(hour, current + 1)
      }

      return Array.from(dayMap.entries()).map(([dayIndex, hours]) => ({
        day: dayNames[dayIndex],
        dayIndex,
        hours: Array.from(hours.entries())
          .map(([hour, orders]) => ({ hour, orders }))
          .sort((a, b) => a.hour - b.hour),
      }))
    }

    // ── Compute reviews summary ──
    async function computeReviews(): Promise<ReviewSummary> {
      // SECURITY (Phase 2.5): apply effectiveBranchId filter — was previously
      // missing, so review summaries always aggregated across ALL branches
      // even when the user filtered by branch.
      const reviews = await db.review.findMany({
        where: {
          restaurantId,
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      })

      const totalReviews = reviews.length
      const avgRating = totalReviews > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 100) / 100
        : 0

      const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: reviews.filter(r => r.rating === rating).length,
      }))

      const recentReviews = reviews.slice(0, 5).map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        customerName: r.customer?.name || 'Anonymous',
        createdAt: r.createdAt.toISOString(),
      }))

      return { avgRating, totalReviews, recentReviews, ratingDistribution }
    }

    // ── Compute branch comparison ──
    async function computeBranchComparison(start: Date, end: Date): Promise<BranchComparison[]> {
      const branches = await db.branch.findMany({
        where: { restaurantId, isActive: true },
        select: { id: true, name: true },
      })

      const results: BranchComparison[] = []

      for (const branch of branches) {
        const orders = await db.order.findMany({
          where: {
            restaurantId,
            branchId: branch.id,
            status: { in: ['completed', 'served'] },
            createdAt: { gte: start, lt: end },
          },
          select: {
            totalAmountCents: true,
            customerId: true,
          },
        })

        const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmountCents, 0)
        const totalOrders = orders.length
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
        const uniqueCustomers = new Set(orders.map(o => o.customerId).filter(Boolean)).size

        results.push({
          branchId: branch.id,
          branchName: branch.name,
          totalRevenue,
          totalOrders,
          avgOrderValue,
          uniqueCustomers,
        })
      }

      return results.sort((a, b) => b.totalRevenue - a.totalRevenue)
    }

    // ── Execute all computations ──
    const [periodData, lossData] = await Promise.all([
      computePeriodFromAggregated(rangeStart, rangeEnd),
      computeLossTracking(rangeStart, rangeEnd),
    ])

    // Merge loss data into period
    periodData.voidAmountCents = lossData.voidAmountCents
    periodData.refundAmountCents = lossData.refundAmountCents
    periodData.complimentAmountCents = lossData.complimentAmountCents
    periodData.totalLossCents = lossData.totalLossCents

    // Optional: compute today/week/month for quick cards
    const todayStart2 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart2 = new Date(todayStart2)
    weekStart2.setDate(weekStart2.getDate() - weekStart2.getDay())
    const monthStart2 = new Date(now.getFullYear(), now.getMonth(), 1)

    const [today, thisWeek, thisMonth] = await Promise.all([
      computePeriodFromAggregated(todayStart2),
      computePeriodFromAggregated(weekStart2),
      computePeriodFromAggregated(monthStart2),
    ])

    // Live stats
    const pendingOrders = await db.order.count({
      where: {
        restaurantId,
        status: { in: ['pending', 'accepted', 'preparing'] },
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
    })

    const activeTables = await db.order.groupBy({
      by: ['tableId'],
      where: {
        restaurantId,
        status: { in: ['pending', 'accepted', 'preparing', 'ready', 'served'] },
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
      _count: true,
    }).then(result => result.length)

    // Optional data
    const [heatmap, reviews, branchComparison] = await Promise.all([
      includeHeatmap ? computeHeatmap(rangeStart, rangeEnd) : null,
      includeReviews ? computeReviews() : null,
      includeBranchComparison ? computeBranchComparison(rangeStart, rangeEnd) : null,
    ])

    // Branch list for filter dropdown
    const branches = await db.branch.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, name: true },
    })

    return NextResponse.json({
      data: {
        today,
        thisWeek,
        thisMonth,
        period: periodData,
        liveStats: { pendingOrders, activeTables },
        branches,
        ...(heatmap ? { heatmap } : {}),
        ...(reviews ? { reviews } : {}),
        ...(branchComparison ? { branchComparison } : {}),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ANALYTICS_GET]', error instanceof Error ? error.message : error, error instanceof Error ? error.stack : '')
    return NextResponse.json(
      { error: 'Failed to fetch analytics', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
