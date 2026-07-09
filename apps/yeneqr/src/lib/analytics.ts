// ============================================================
// Yene QR — Analytics Aggregation Pipeline
// ============================================================
// Event-driven analytics aggregation that populates the
// AnalyticsDaily model. Supports:
//   - Per-restaurant daily aggregation
//   - Bulk aggregation for all active restaurants
//   - On-demand aggregation when data is missing
//   - Real-time re-aggregation triggered by order events

import { db } from '@/lib/db'

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface TopItem {
  itemId: string
  name: string
  quantity: number
  revenueCents: number
}

interface PeakHour {
  hour: number
  orderCount: number
}

interface AggregationResult {
  totalOrders: number
  totalRevenueCents: number
  totalTaxCents: number
  totalTipsCents: number
  avgOrderValueCents: number
  uniqueCustomers: number
  repeatCustomers: number
  cancelledOrders: number
  avgPrepTime: number
  tableTurnover: number
  topItems: TopItem[]
  peakHours: PeakHour[]
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

/**
 * Normalise a Date to the start of its day (midnight UTC-compatible).
 * SQLite stores dates as strings, so we compare date strings.
 */
function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Format a Date as YYYY-MM-DD for consistent comparisons.
 */
function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// -------------------------------------------------------
// Core Aggregation
// -------------------------------------------------------

/**
 * Aggregate order data for a given restaurant and date into AnalyticsDaily.
 * Uses raw order data — no pre-aggregated data is relied upon.
 *
 * If a record already exists for the same restaurant + branchId + date it
 * will be **upserted** (updated in place).
 *
 * @param restaurantId  The restaurant to aggregate
 * @param date          The calendar date (time component is ignored)
 * @param branchId      Optional branch scope (null = restaurant-level rollup)
 */
export async function aggregateDailyAnalytics(
  restaurantId: string,
  date: Date,
  branchId?: string | null
): Promise<AggregationResult | null> {
  const dayStart = toDateOnly(date)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  // ------------------------------------------------------------------
  // 1. Fetch completed / served orders for the day
  // ------------------------------------------------------------------
  const completedOrders = await db.order.findMany({
    where: {
      restaurantId,
      status: { in: ['completed', 'served'] },
      createdAt: { gte: dayStart, lt: dayEnd },
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      totalAmountCents: true,
      taxAmountCents: true,
      tipAmountCents: true,
      customerId: true,
      tableId: true,
      preparingAt: true,
      readyAt: true,
      createdAt: true,
      items: {
        select: {
          menuItemId: true,
          name: true,
          priceCents: true,
          quantity: true,
        },
      },
    },
  })

  // ------------------------------------------------------------------
  // 2. Fetch cancelled orders for the day
  // ------------------------------------------------------------------
  const cancelledOrdersData = await db.order.findMany({
    where: {
      restaurantId,
      status: 'cancelled',
      createdAt: { gte: dayStart, lt: dayEnd },
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true },
  })

  // ------------------------------------------------------------------
  // 3. Compute metrics
  // ------------------------------------------------------------------

  // Revenue & counts
  const totalOrders = completedOrders.length
  const totalRevenueCents = completedOrders.reduce((sum, o) => sum + o.totalAmountCents, 0)
  const totalTaxCents = completedOrders.reduce((sum, o) => sum + o.taxAmountCents, 0)
  const totalTipsCents = completedOrders.reduce((sum, o) => sum + o.tipAmountCents, 0)
  const avgOrderValueCents = totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0
  const cancelledOrders = cancelledOrdersData.length

  // Unique & repeat customers
  const customerOrderCounts = new Map<string, number>()
  for (const order of completedOrders) {
    if (order.customerId) {
      customerOrderCounts.set(
        order.customerId,
        (customerOrderCounts.get(order.customerId) || 0) + 1
      )
    }
  }
  const uniqueCustomers = customerOrderCounts.size
  let repeatCustomers = 0
  for (const count of customerOrderCounts.values()) {
    if (count > 1) repeatCustomers++
  }

  // Average prep time (preparingAt → readyAt, in minutes)
  let prepTimeSum = 0
  let prepTimeCount = 0
  for (const order of completedOrders) {
    if (order.preparingAt && order.readyAt) {
      const diffMs = new Date(order.readyAt).getTime() - new Date(order.preparingAt).getTime()
      if (diffMs > 0) {
        prepTimeSum += diffMs / (1000 * 60) // minutes
        prepTimeCount++
      }
    }
  }
  const avgPrepTime = prepTimeCount > 0 ? Math.round((prepTimeSum / prepTimeCount) * 100) / 100 : 0

  // Table turnover (completed orders / unique tables)
  const uniqueTables = new Set(completedOrders.map((o) => o.tableId))
  const tableTurnover =
    uniqueTables.size > 0
      ? Math.round((totalOrders / uniqueTables.size) * 100) / 100
      : 0

  // Top items by quantity
  const itemMap = new Map<string, TopItem>()
  for (const order of completedOrders) {
    for (const item of order.items) {
      const key = item.menuItemId || item.name
      const existing = itemMap.get(key)
      if (existing) {
        existing.quantity += item.quantity
        existing.revenue += item.priceCents * item.quantity
      } else {
        itemMap.set(key, {
          itemId: item.menuItemId || '',
          name: item.name,
          quantity: item.quantity,
          revenueCents: item.priceCents * item.quantity,
        })
      }
    }
  }
  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      revenueCents: item.revenueCents,
    }))

  // Peak hours (0-23)
  const hourMap = new Map<number, number>()
  for (let h = 0; h < 24; h++) hourMap.set(h, 0)
  for (const order of completedOrders) {
    const hour = new Date(order.createdAt).getHours()
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
  }
  const peakHours = Array.from(hourMap.entries())
    .map(([hour, orderCount]) => ({ hour, orderCount }))
    .sort((a, b) => a.hour - b.hour)

  // ------------------------------------------------------------------
  // 4. Upsert into AnalyticsDaily
  // ------------------------------------------------------------------
  const result: AggregationResult = {
    totalOrders,
    totalRevenueCents,
    totalTaxCents,
    totalTipsCents,
    avgOrderValueCents,
    uniqueCustomers,
    repeatCustomers,
    cancelledOrders,
    avgPrepTime,
    tableTurnover,
    topItems,
    peakHours,
  }

  // Use findFirst + create/update instead of upsert because Prisma's
  // compound unique constraint with nullable branchId doesn't accept
  // null in the where clause for upsert/findUnique.
  const existing = await db.analyticsDaily.findFirst({
    where: {
      restaurantId,
      branchId: branchId || null,
      date: dayStart,
    },
  })

  const dataPayload = {
    totalOrders: result.totalOrders,
    totalRevenueCents: result.totalRevenueCents,
    totalTaxCents: result.totalTaxCents,
    totalTipsCents: result.totalTipsCents,
    avgOrderValueCents: result.avgOrderValueCents,
    uniqueCustomers: result.uniqueCustomers,
    repeatCustomers: result.repeatCustomers,
    cancelledOrders: result.cancelledOrders,
    avgPrepTime: result.avgPrepTime,
    tableTurnover: result.tableTurnover,
    topItems: JSON.stringify(result.topItems),
    peakHours: JSON.stringify(result.peakHours),
  }

  if (existing) {
    await db.analyticsDaily.update({
      where: { id: existing.id },
      data: dataPayload,
    })
  } else {
    await db.analyticsDaily.create({
      data: {
        restaurantId,
        branchId: branchId || null,
        date: dayStart,
        ...dataPayload,
      },
    })
  }

  return result
}

// -------------------------------------------------------
// Bulk Aggregation
// -------------------------------------------------------

/**
 * Run daily aggregation for **all** active restaurants.
 * Returns a summary of how many restaurants were processed.
 */
export async function aggregateAllRestaurants(date: Date): Promise<{
  date: string
  processed: number
  errors: string[]
}> {
  const dateStr = toDateString(date)
  const errors: string[] = []
  let processed = 0

  const restaurants = await db.restaurant.findMany({
    where: { isActive: true, isSuspended: false },
    select: { id: true },
  })

  for (const restaurant of restaurants) {
    try {
      await aggregateDailyAnalytics(restaurant.id, date)
      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`restaurant:${restaurant.id} — ${msg}`)
    }
  }

  return { date: dateStr, processed, errors }
}

// -------------------------------------------------------
// On-demand Retrieval (with lazy aggregation)
// -------------------------------------------------------

/**
 * Get analytics for a specific restaurant + date.
 * If no pre-aggregated data exists, runs aggregation on-the-fly.
 */
export async function getAnalyticsForDate(
  restaurantId: string,
  date: Date,
  branchId?: string | null
): Promise<AggregationResult | null> {
  const dayStart = toDateOnly(date)

  // Check for existing pre-aggregated row
  // Use findFirst instead of findUnique because Prisma's compound unique
  // constraint with nullable branchId doesn't accept null in the where clause.
  const existing = await db.analyticsDaily.findFirst({
    where: {
      restaurantId,
      branchId: branchId || null,
      date: dayStart,
    },
  })

  if (existing) {
    return {
      totalOrders: existing.totalOrders,
      totalRevenueCents: existing.totalRevenueCents,
      totalTaxCents: existing.totalTaxCents,
      totalTipsCents: existing.totalTipsCents,
      avgOrderValueCents: existing.avgOrderValueCents,
      uniqueCustomers: existing.uniqueCustomers,
      repeatCustomers: existing.repeatCustomers,
      cancelledOrders: existing.cancelledOrders,
      avgPrepTime: existing.avgPrepTime,
      tableTurnover: existing.tableTurnover,
      topItems: existing.topItems ? JSON.parse(existing.topItems) : [],
      peakHours: existing.peakHours ? JSON.parse(existing.peakHours) : [],
    }
  }

  // No pre-aggregated data — run aggregation on-the-fly
  return aggregateDailyAnalytics(restaurantId, date, branchId)
}

/**
 * Get analytics for a date range (inclusive).
 * Each date that lacks pre-aggregated data will be aggregated on-the-fly.
 */
export async function getAnalyticsRange(
  restaurantId: string,
  dateFrom: Date,
  dateTo: Date,
  branchId?: string | null
): Promise<Array<AggregationResult & { date: string }>> {
  const results: Array<AggregationResult & { date: string }> = []
  const current = toDateOnly(dateFrom)
  const end = toDateOnly(dateTo)

  const zeroEntry = (): AggregationResult => ({
    totalOrders: 0,
    totalRevenueCents: 0,
    totalTaxCents: 0,
    totalTipsCents: 0,
    avgOrderValueCents: 0,
    uniqueCustomers: 0,
    repeatCustomers: 0,
    cancelledOrders: 0,
    avgPrepTime: 0,
    tableTurnover: 0,
    topItems: [],
    peakHours: [],
  })

  while (current <= end) {
    try {
      const data = await getAnalyticsForDate(restaurantId, current, branchId)
      if (data) {
        results.push({ ...data, date: toDateString(current) })
      } else {
        // Even with zero orders, push a zeroed-out entry for continuity
        results.push({ ...zeroEntry(), date: toDateString(current) })
      }
    } catch (err) {
      // If aggregation fails for a single day (e.g. FK constraint),
      // push a zeroed entry so the whole request doesn't fail
      console.error(`[ANALYTICS_RANGE] Failed for ${toDateString(current)}:`, err instanceof Error ? err.message : err)
      results.push({ ...zeroEntry(), date: toDateString(current) })
    }
    current.setDate(current.getDate() + 1)
  }

  return results
}

// -------------------------------------------------------
// Event-driven Re-aggregation (non-blocking)
// -------------------------------------------------------

/**
 * Trigger an async re-aggregation for a restaurant's today analytics.
 * Designed to be called from the event bus when an order is completed.
 * Errors are caught and logged — never throws.
 */
export function triggerReaggregation(restaurantId: string, date?: Date): void {
  const targetDate = date ?? new Date()

  // Fire-and-forget — non-blocking
  aggregateDailyAnalytics(restaurantId, targetDate).catch((err) => {
    console.error(
      `[ANALYTICS_REAGGREGATE] Failed for restaurant:${restaurantId} date:${toDateString(targetDate)}`,
      err
    )
  })
}
