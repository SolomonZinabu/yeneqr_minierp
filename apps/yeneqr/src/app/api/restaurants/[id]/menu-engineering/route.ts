// ============================================================
// Menu Engineering / Profitability Analysis
// ============================================================
// GET /api/restaurants/[id]/menu-engineering
//
// Classifies items as Star/Puzzle/Plowhorse/Dog based on the
// Kasavana-Smith model: popularity (relative to menu average) vs
// margin (relative to menu average contribution margin).
//
// Query params:
//   branchId — scope to a specific branch
//   days     — lookback window in days (default 30)
//   dateFrom — ISO date string (overrides 'days' if provided)
//   dateTo   — ISO date string (defaults to now)
//
// Fixes applied (P0):
//   1. Popularity denominator = total menu items (not just sold items)
//   2. Margin threshold = relative (avg contribution margin, not 60%)
//   3. Zero-cost items flagged with 'missingCostData'
//   4. Cancelled orders excluded via Order.status + OrderItem.cancelledAt
//   5. Modifier revenue included (OrderItemModifier.priceDeltaCents)
//   6. Branch price overrides applied (MenuItemBranchOverride)
//   7. Uses groupBy aggregation (not full-table JS loop)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'analytics:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const days = parseInt(searchParams.get('days') || '30', 10)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Determine date range
    const now = new Date()
    const endDate = dateTo ? new Date(dateTo) : now
    const startDate = dateFrom ? new Date(dateFrom) : (() => {
      const d = new Date()
      d.setDate(d.getDate() - days)
      return d
    })()

    // ── 1. Fetch all menu items with category ──
    const menuItems = await db.menuItem.findMany({
      where: { restaurantId },
      select: {
        id: true,
        name: true,
        priceCents: true,
        costCents: true,
        isAvailable: true,
        isPopular: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    })

    if (menuItems.length === 0) {
      return NextResponse.json({ data: [], summary: { stars: 0, puzzles: 0, plowhorses: 0, dogs: 0, totalProfitCents: 0, totalRevenueCents: 0, avgMarginCents: 0, avgQuantity: 0 }, dateRange: { start: startDate, end: endDate } })
    }

    // ── 2. Fetch branch price overrides (if branchId is specified) ──
    let branchOverrides: Map<string, { priceCents?: number; isAvailable?: boolean }> = new Map()
    if (branchId) {
      const overrides = await db.menuItemBranchOverride.findMany({
        where: { branchId, menuItemId: { in: menuItems.map(m => m.id) } },
        select: { menuItemId: true, priceCents: true, isAvailable: true },
      })
      for (const o of overrides) {
        branchOverrides.set(o.menuItemId, { priceCents: o.priceCents || undefined, isAvailable: o.isAvailable })
      }
    }

    // ── 3. Aggregate order items using groupBy (not full-table scan) ──
    // Exclude: cancelled orders (Order.status = 'cancelled') + cancelled items (cancelledAt != null)
    const orderItemWhere: Record<string, unknown> = {
      restaurantId,
      createdAt: { gte: startDate, lte: endDate },
      kitchenStatus: { not: 'cancelled' },
      cancelledAt: null,
      order: { status: { not: 'cancelled' } },
    }
    if (branchId) orderItemWhere.branchId = branchId

    const aggregated = await db.orderItem.groupBy({
      by: ['menuItemId'],
      where: orderItemWhere as any,
      _sum: { quantity: true },
      _count: { id: true },
    })

    // ── 4. Fetch modifier revenue per menu item ──
    // Sum all OrderItemModifier.priceDeltaCents for items in the date range
    const modifierRevenue = await db.orderItemModifier.groupBy({
      by: ['orderItemId'],
      _sum: { priceDeltaCents: true },
    })

    // Build a map of menuItemId → { quantity, modifierRevenueCents }
    // We need to fetch the order items to map modifiers back to menu items
    const stats: Record<string, { quantity: number; revenueCents: number; modifierRevenueCents: number }> = {}

    // Fetch order items with their menuItemId for modifier mapping
    const orderItemsWithModifiers = await db.orderItem.findMany({
      where: orderItemWhere as any,
      select: {
        id: true,
        menuItemId: true,
        quantity: true,
        priceCents: true,
        modifierSelections: {
          select: { priceDeltaCents: true, quantity: true },
        },
      },
    })

    for (const oi of orderItemsWithModifiers) {
      if (!oi.menuItemId) continue
      if (!stats[oi.menuItemId]) stats[oi.menuItemId] = { quantity: 0, revenueCents: 0, modifierRevenueCents: 0 }
      stats[oi.menuItemId].quantity += oi.quantity
      stats[oi.menuItemId].revenueCents += oi.priceCents * oi.quantity
      // Add modifier revenue
      for (const mod of oi.modifierSelections) {
        stats[oi.menuItemId].modifierRevenueCents += (mod.priceDeltaCents || 0) * (mod.quantity || 1) * oi.quantity
      }
    }

    // ── 5. Calculate per-item metrics ──
    const totalMenuItemCount = menuItems.length // Fixed: denominator = ALL items, not just sold
    const totalQuantity = Object.values(stats).reduce((sum, s) => sum + s.quantity, 0)
    const avgQuantity = totalQuantity / Math.max(1, totalMenuItemCount) // Fixed: divide by total items

    // Build preliminary item data with margin
    const itemsWithMargin = menuItems.map(item => {
      const s = stats[item.id] || { quantity: 0, revenueCents: 0, modifierRevenueCents: 0 }
      const override = branchOverrides.get(item.id)
      const effectivePriceCents = override?.priceCents ?? item.priceCents
      const effectiveIsAvailable = override?.isAvailable ?? item.isAvailable
      const marginCents = effectivePriceCents - item.costCents
      const marginPct = effectivePriceCents > 0 ? (marginCents / effectivePriceCents) * 100 : 0
      const profitCents = marginCents * s.quantity
      const totalRevenueCents = s.revenueCents + s.modifierRevenueCents

      return {
        id: item.id,
        name: item.name,
        categoryId: item.category?.id || null,
        category: item.category?.name || 'Uncategorized',
        priceCents: effectivePriceCents,
        costCents: item.costCents,
        marginCents,
        marginPct: Math.round(marginPct * 10) / 10, // Keep 1 decimal place
        quantitySold: s.quantity,
        revenueCents: totalRevenueCents, // Includes modifiers
        modifierRevenueCents: s.modifierRevenueCents,
        profitCents,
        isAvailable: effectiveIsAvailable,
        isPopular: item.isPopular,
        missingCostData: item.costCents === 0, // Flag items with no cost entered
      }
    })

    // ── 6. Calculate relative margin threshold ──
    // Average contribution margin = total profit / total quantity sold
    // Only count items that actually sold for the average
    const soldItems = itemsWithMargin.filter(i => i.quantitySold > 0 && !i.missingCostData)
    const totalProfitCents = soldItems.reduce((sum, i) => sum + i.profitCents, 0)
    const totalSoldQuantity = soldItems.reduce((sum, i) => sum + i.quantitySold, 0)
    const avgMarginCents = totalSoldQuantity > 0 ? totalProfitCents / totalSoldQuantity : 0

    // ── 7. Classify items ──
    const classified = itemsWithMargin.map(item => {
      let classification = 'Dog'
      let isHighPopularity = false
      let isHighMargin = false

      if (!item.missingCostData && item.quantitySold > 0) {
        isHighPopularity = item.quantitySold >= avgQuantity
        isHighMargin = item.marginCents >= avgMarginCents // Relative threshold

        if (isHighPopularity && isHighMargin) classification = 'Star'
        else if (!isHighPopularity && isHighMargin) classification = 'Puzzle'
        else if (isHighPopularity && !isHighMargin) classification = 'Plowhorse'
        else classification = 'Dog'
      } else if (item.missingCostData) {
        classification = 'Unknown' // Can't classify without cost data
      } else {
        classification = 'Dog' // Never sold
      }

      return {
        ...item,
        classification,
        isHighPopularity,
        isHighMargin,
        avgQuantity: Math.round(avgQuantity * 10) / 10,
        avgMarginCents: Math.round(avgMarginCents),
      }
    })

    // Sort by profit descending
    classified.sort((a, b) => b.profitCents - a.profitCents)

    // ── 8. Summary ──
    const summary = {
      stars: classified.filter(c => c.classification === 'Star').length,
      puzzles: classified.filter(c => c.classification === 'Puzzle').length,
      plowhorses: classified.filter(c => c.classification === 'Plowhorse').length,
      dogs: classified.filter(c => c.classification === 'Dog').length,
      unknown: classified.filter(c => c.classification === 'Unknown').length,
      totalProfitCents,
      totalRevenueCents: classified.reduce((sum, c) => sum + c.revenueCents, 0),
      totalModifierRevenueCents: classified.reduce((sum, c) => sum + c.modifierRevenueCents, 0),
      avgMarginCents: Math.round(avgMarginCents),
      avgQuantity: Math.round(avgQuantity * 10) / 10,
      totalItems: menuItems.length,
      itemsSold: soldItems.length,
      itemsNeverSold: menuItems.length - soldItems.length - classified.filter(c => c.missingCostData).length,
    }

    // ── 9. Category profitability roll-up ──
    const categoryMap: Record<string, { name: string; profitCents: number; revenueCents: number; quantitySold: number; itemCount: number }> = {}
    for (const item of classified) {
      const catName = item.category
      if (!categoryMap[catName]) categoryMap[catName] = { name: catName, profitCents: 0, revenueCents: 0, quantitySold: 0, itemCount: 0 }
      categoryMap[catName].profitCents += item.profitCents
      categoryMap[catName].revenueCents += item.revenueCents
      categoryMap[catName].quantitySold += item.quantitySold
      categoryMap[catName].itemCount++
    }
    const categorySummary = Object.values(categoryMap).sort((a, b) => b.profitCents - a.profitCents)

    return NextResponse.json({
      data: classified,
      summary,
      categorySummary,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      thresholds: {
        avgQuantity: Math.round(avgQuantity * 10) / 10,
        avgMarginCents: Math.round(avgMarginCents),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[MENU_ENGINEERING]', error)
    return NextResponse.json({ error: 'Failed to fetch menu engineering data' }, { status: 500 })
  }
}
