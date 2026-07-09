// ============================================================
// Yene QR — Admin Overview API
// Quick overview stats for the admin dashboard.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/admin/overview
 * Quick overview stats for admin dashboard:
 *  - Total restaurants (active/suspended/pending)
 *  - MRR
 *  - Open tickets count
 *  - Recent signups (last 5)
 *  - Platform health metrics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    // Run independent queries in parallel
    const [
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      pendingRestaurants,
      activeSubscriptionsWithPlan,
      openTickets,
      ticketsByStatus,
      recentSignups,
      ordersToday,
      ordersYesterday,
      activeSessions,
    ] = await Promise.all([
      // Total restaurants
      db.restaurant.count(),

      // Active restaurants
      db.restaurant.count({
        where: { isActive: true, isSuspended: false, isVerified: true },
      }),

      // Suspended restaurants
      db.restaurant.count({
        where: { isSuspended: true },
      }),

      // Pending restaurants
      db.restaurant.count({
        where: { isActive: false, isSuspended: false, isVerified: false },
      }),

      // Active subscriptions with plan for MRR
      db.subscription.findMany({
        where: { status: 'active' },
        include: {
          plan: {
            select: { priceCents: true },
          },
        },
      }),

      // Open tickets count
      db.supportTicket.count({
        where: { status: { in: ['open', 'in_progress'] } },
      }),

      // Tickets by status
      db.supportTicket.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Recent signups (last 5)
      db.restaurant.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          cuisineType: true,
          city: true,
          createdAt: true,
          isActive: true,
          isVerified: true,
          isSuspended: true,
          subscription: {
            select: {
              plan: { select: { name: true, slug: true } },
              status: true,
            },
          },
          users: {
            where: { role: 'owner' },
            select: { name: true, email: true },
            take: 1,
          },
        },
      }),

      // Orders today
      db.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          status: { notIn: ['cancelled'] },
        },
      }),

      // Orders yesterday (for comparison)
      db.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date(new Date().setHours(0, 0, 0, 0)).getTime() - 86400000),
            lt: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          status: { notIn: ['cancelled'] },
        },
      }),

      // Active customer sessions
      db.customerSession.count({
        where: { isActive: true },
      }),
    ])

    // Calculate MRR
    const mrr = activeSubscriptionsWithPlan.reduce(
      (sum, sub) => sum + sub.plan.priceCents,
      0
    )

    // Format recent signups
    const recentSignupsFormatted = recentSignups.map(r => {
      const owner = r.users[0]
      let status: 'active' | 'suspended' | 'pending'
      if (r.isSuspended) {
        status = 'suspended'
      } else if (!r.isVerified && !r.isActive) {
        status = 'pending'
      } else {
        status = 'active'
      }

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        ownerName: owner?.name || 'N/A',
        ownerEmail: owner?.email || 'N/A',
        cuisine: r.cuisineType || 'Other',
        city: r.city || 'Unknown',
        plan: r.subscription?.plan?.slug || 'basic',
        status,
        joinedAt: r.createdAt.toISOString(),
      }
    })

    // Ticket counts by status
    const ticketCounts: Record<string, number> = {}
    for (const t of ticketsByStatus) {
      ticketCounts[t.status] = t._count.id
    }

    // Compute order growth
    const orderGrowth = ordersYesterday > 0
      ? Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100)
      : ordersToday > 0 ? 100 : 0

    // Platform health metrics
    const healthMetrics = {
      uptime: 99.9, // This would normally come from a monitoring service
      activeSessions,
      ordersToday,
      orderGrowth,
      averageResponseTime: 120, // ms — would come from monitoring
    }

    return NextResponse.json({
      data: {
        restaurants: {
          total: totalRestaurants,
          active: activeRestaurants,
          suspended: suspendedRestaurants,
          pending: pendingRestaurants,
        },
        mrr,
        tickets: {
          open: openTickets,
          byStatus: ticketCounts,
        },
        recentSignups: recentSignupsFormatted,
        health: healthMetrics,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_OVERVIEW]', error)
    return NextResponse.json(
      { error: 'Failed to fetch overview' },
      { status: 500 }
    )
  }
}
