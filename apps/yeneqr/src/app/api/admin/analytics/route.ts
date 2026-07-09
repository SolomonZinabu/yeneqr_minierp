// ============================================================
// Yene QR — Admin Analytics API
// Platform-wide analytics for the super admin dashboard.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/admin/analytics
 * Platform-wide analytics:
 *  - Total restaurants (active/suspended/pending)
 *  - MRR from active subscriptions
 *  - Total orders across platform (last 30 days)
 *  - Revenue by plan
 *  - Cuisine type distribution
 *  - Geographic distribution (by city)
 *  - Monthly growth (signups per month for last 12 months)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    // Run independent queries in parallel
    const [
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      pendingRestaurants,
      activeSubscriptionsWithPlan,
      ordersLast30Days,
      cuisineDistribution,
      geoDistribution,
      monthlySignups,
    ] = await Promise.all([
      // 1. Total restaurants
      db.restaurant.count(),

      // 2. Active restaurants
      db.restaurant.count({
        where: { isActive: true, isSuspended: false, isVerified: true },
      }),

      // 3. Suspended restaurants
      db.restaurant.count({
        where: { isSuspended: true },
      }),

      // 4. Pending restaurants
      db.restaurant.count({
        where: { isActive: false, isSuspended: false, isVerified: false },
      }),

      // 5. Active subscriptions with plan info for MRR and revenue by plan
      db.subscription.findMany({
        where: { status: 'active' },
        include: {
          plan: {
            select: { id: true, name: true, slug: true, priceCents: true },
          },
        },
      }),

      // 6. Orders in last 30 days (count + total revenue)
      db.order.aggregate({
        _count: { id: true },
        _sum: { totalAmountCents: true },
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: { notIn: ['cancelled'] },
        },
      }),

      // 7. Cuisine type distribution
      db.restaurant.groupBy({
        by: ['cuisineType'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        where: { cuisineType: { not: null } },
      }),

      // 8. Geographic distribution by city
      db.restaurant.groupBy({
        by: ['city'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        where: { city: { not: null } },
      }),

      // 9. Monthly signups for last 12 months
      db.restaurant.findMany({
        where: { createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    // Calculate MRR (Monthly Recurring Revenue)
    const mrr = activeSubscriptionsWithPlan.reduce(
      (sum, sub) => sum + sub.plan.priceCents,
      0
    )

    // Revenue by plan
    const revenueByPlan = new Map<string, { name: string; slug: string; priceCents: number; count: number; revenueCents: number }>()
    for (const sub of activeSubscriptionsWithPlan) {
      const existing = revenueByPlan.get(sub.plan.id)
      if (existing) {
        existing.count += 1
        existing.revenueCents += sub.plan.priceCents
      } else {
        revenueByPlan.set(sub.plan.id, {
          name: sub.plan.name,
          slug: sub.plan.slug,
          priceCents: sub.plan.priceCents,
          count: 1,
          revenueCents: sub.plan.priceCents,
        })
      }
    }

    // Cuisine distribution with percentage
    const totalCuisines = cuisineDistribution.reduce((sum, c) => sum + c._count.id, 0)
    const cuisineStats = cuisineDistribution.map(c => ({
      cuisine: c.cuisineType || 'Other',
      count: c._count.id,
      percentage: totalCuisines > 0 ? Math.round((c._count.id / totalCuisines) * 1000) / 10 : 0,
    }))

    // Geographic distribution with revenue
    // Need to get revenue per city from analytics
    const cityNames = geoDistribution.map(g => g.city).filter((c): c is string => c !== null)

    // Get revenue by restaurant, then map to city
    const cityRestaurantIds = await db.restaurant.findMany({
      where: { city: { in: cityNames } },
      select: { id: true, city: true },
    })

    const cityRestaurantMap = new Map(cityRestaurantIds.map(r => [r.id, r.city]))

    const thirtyDaysAgoForCity = new Date()
    thirtyDaysAgoForCity.setDate(thirtyDaysAgoForCity.getDate() - 30)

    const cityAnalytics = await db.analyticsDaily.groupBy({
      by: ['restaurantId'],
      where: { date: { gte: thirtyDaysAgoForCity } },
      _sum: { totalRevenueCents: true },
    })

    const cityRevenueMap = new Map<string, number>()
    for (const analytic of cityAnalytics) {
      const city = cityRestaurantMap.get(analytic.restaurantId)
      if (city) {
        const current = cityRevenueMap.get(city) || 0
        cityRevenueMap.set(city, current + (analytic._sum.totalRevenueCents || 0))
      }
    }

    const geoStats = geoDistribution.map(g => ({
      city: g.city || 'Unknown',
      restaurants: g._count.id,
      revenueCents: cityRevenueMap.get(g.city || 'Unknown') || 0,
    }))

    // Monthly signups — group by month
    const monthlyGrowth: { month: string; signups: number; monthLabel: string }[] = []
    const monthMap = new Map<string, number>()

    for (const r of monthlySignups) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`
      monthMap.set(key, (monthMap.get(key) || 0) + 1)
    }

    // Fill in all 12 months even if zero
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      monthlyGrowth.push({
        month: key,
        monthLabel: monthNames[d.getMonth()],
        signups: monthMap.get(key) || 0,
      })
    }

    // Also get monthly revenue from analytics for last 12 months
    const monthlyRevenueData = await db.analyticsDaily.groupBy({
      by: ['date'],
      where: { date: { gte: twelveMonthsAgo } },
      _sum: { totalRevenueCents: true },
      _count: { id: true },
    })

    // Group by month
    const monthlyRevenueMap = new Map<string, { revenue: number; subscriptions: number }>()
    for (const entry of monthlyRevenueData) {
      const key = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyRevenueMap.get(key) || { revenue: 0, subscriptions: 0 }
      existing.revenue += entry._sum.totalRevenueCents || 0
      existing.subscriptions += 1 // Number of restaurant-days
      monthlyRevenueMap.set(key, existing)
    }

    const monthlyRevenue = monthlyGrowth.map(m => ({
      month: m.monthLabel,
      revenueCents: monthlyRevenueMap.get(m.month)?.revenue || 0,
      subscriptions: activeSubscriptionsWithPlan.length, // Current active count
      newRestaurants: m.signups,
    }))

    return NextResponse.json({
      data: {
        restaurants: {
          total: totalRestaurants,
          active: activeRestaurants,
          suspended: suspendedRestaurants,
          pending: pendingRestaurants,
        },
        mrr,
        ordersLast30Days: ordersLast30Days._count.id,
        revenueLast30Days: ordersLast30Days._sum.totalAmountCents || 0,
        revenueByPlan: Array.from(revenueByPlan.values()),
        cuisineDistribution: cuisineStats,
        geographicDistribution: geoStats,
        monthlyGrowth,
        monthlyRevenue,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_ANALYTICS]', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
