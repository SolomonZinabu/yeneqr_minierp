// ============================================================
// Yene QR — Admin Restaurants API
// List all restaurants with pagination, search, status filter.
// Manage restaurant status (approve, suspend, reactivate).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/admin/restaurants
 * List all restaurants for admin with pagination, search, and filters.
 * Query params: page, limit, search, status, plan
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const search = searchParams.get('search') || ''
    const statusFilter = searchParams.get('status') || '' // active, suspended, pending
    const planFilter = searchParams.get('plan') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { email: { contains: search } },
        { city: { contains: search } },
      ]
    }

    // Status filter
    if (statusFilter === 'active') {
      where.isActive = true
      where.isSuspended = false
      where.isVerified = true
    } else if (statusFilter === 'suspended') {
      where.isSuspended = true
    } else if (statusFilter === 'pending') {
      where.isActive = false
      where.isSuspended = false
      where.isVerified = false
    }

    // Plan filter — via subscription relation
    if (planFilter) {
      where.subscription = {
        plan: { slug: planFilter },
      }
    }

    const [restaurants, total] = await Promise.all([
      db.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            where: { role: 'owner' },
            select: { name: true, email: true },
            take: 1,
          },
          branches: {
            select: { id: true, _count: { select: { tables: true } } },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              plan: { select: { id: true, name: true, slug: true, priceCents: true } },
              currentPeriodEnd: true,
            },
          },
          _count: {
            select: { branches: true },
          },
        },
      }),
      db.restaurant.count({ where }),
    ])

    // Get last 30-day order stats per restaurant
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Compute monthly stats from analytics
    const restaurantIds = restaurants.map(r => r.id)
    const monthlyStats = await db.analyticsDaily.groupBy({
      by: ['restaurantId'],
      where: {
        restaurantId: { in: restaurantIds },
        date: { gte: thirtyDaysAgo },
      },
      _sum: {
        totalOrders: true,
        totalRevenueCents: true,
      },
    })

    const statsMap = new Map(
      monthlyStats.map(s => [
        s.restaurantId,
        {
          monthlyOrders: s._sum.totalOrders || 0,
          monthlyRevenue: s._sum.totalRevenueCents || 0,
        },
      ])
    )

    // Format response to match mock data structure
    const data = restaurants.map(r => {
      const owner = r.users[0]
      const totalTables = r.branches.reduce((sum, b) => sum + b._count.tables, 0)
      const stats = statsMap.get(r.id) || { monthlyOrders: 0, monthlyRevenue: 0 }

      // Determine status
      let status: 'active' | 'suspended' | 'pending'
      if (r.isSuspended) {
        status = 'suspended'
      } else if (!r.isVerified && !r.isActive) {
        status = 'pending'
      } else {
        status = 'active'
      }

      // Parse settings to check for suspension reason
      let suspensionReason: string | null = null
      if (r.settings) {
        try {
          const settings = JSON.parse(r.settings)
          suspensionReason = settings.suspensionReason || null
        } catch {
          // ignore parse errors
        }
      }

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        ownerName: owner?.name || 'N/A',
        ownerEmail: owner?.email || r.email || 'N/A',
        cuisine: r.cuisineType || 'Other',
        city: r.city || 'Unknown',
        plan: r.subscription?.plan?.slug || 'basic',
        planName: r.subscription?.plan?.name || 'Basic',
        subscriptionStatus: r.subscription?.status || 'trial',
        status,
        tables: totalTables,
        branches: r._count.branches,
        monthlyOrders: stats.monthlyOrders,
        monthlyRevenue: stats.monthlyRevenue,
        suspensionReason,
        joinedAt: r.createdAt.toISOString(),
        lastActiveAt: r.updatedAt.toISOString(),
      }
    })

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_RESTAURANTS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch restaurants' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/restaurants
 * Update restaurant status (approve, suspend, reactivate).
 * Body: { restaurantId, action: 'approve'|'suspend'|'reactivate', reason? }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const body = await request.json()
    const { restaurantId, action, reason } = body

    if (!restaurantId || !action) {
      return NextResponse.json(
        { error: 'restaurantId and action are required' },
        { status: 400 }
      )
    }

    const validActions = ['approve', 'suspend', 'reactivate']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    let updateData: any = {}

    if (action === 'approve') {
      updateData = {
        isActive: true,
        isVerified: true,
        isSuspended: false,
      }
    } else if (action === 'suspend') {
      // Store suspension reason in settings JSON
      const currentSettings = restaurant.settings
        ? JSON.parse(restaurant.settings)
        : {}
      updateData = {
        isSuspended: true,
        isActive: false,
        settings: JSON.stringify({
          ...currentSettings,
          suspensionReason: reason || 'Suspended by admin',
          suspendedAt: new Date().toISOString(),
          suspendedBy: auth.userId,
        }),
      }
    } else if (action === 'reactivate') {
      const currentSettings = restaurant.settings
        ? JSON.parse(restaurant.settings)
        : {}
      updateData = {
        isSuspended: false,
        isActive: true,
        settings: JSON.stringify({
          ...currentSettings,
          suspensionReason: null,
          suspendedAt: null,
          suspendedBy: null,
          reactivatedAt: new Date().toISOString(),
          reactivatedBy: auth.userId,
        }),
      }
    }

    const updated = await db.restaurant.update({
      where: { id: restaurantId },
      data: updateData,
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
        isVerified: updated.isVerified,
        isSuspended: updated.isSuspended,
        action,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_RESTAURANTS_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update restaurant status' },
      { status: 500 }
    )
  }
}
