// ============================================================
// Yene QR — Notifications API (List, Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, getAuthContext, requirePerm, resolveBranchScope } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/notifications
 * List notifications for a restaurant with optional filters.
 */
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

    // Require restaurant:view permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const isRead = searchParams.get('isRead')
    const type = searchParams.get('type')
    const grouped = searchParams.get('grouped') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId }

    // Filter by userId or null (broadcast notifications)
    if (userId) {
      where.userId = userId
    }

    if (branchId) where.branchId = branchId

    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === 'true'
    }

    if (type) {
      where.type = type
    }

    // Phase R2: Grouping by type — returns type counts instead of individual notifications
    // Reduces notification fatigue by showing "5 new orders" instead of 5 separate entries
    if (grouped) {
      const groupedNotifications = await db.notification.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
        _max: { createdAt: true },
      })

      const unreadByType = await db.notification.groupBy({
        by: ['type'],
        where: { ...where, isRead: false },
        _count: { _all: true },
      })

      const unreadMap = new Map(unreadByType.map((g) => [g.type, g._count._all]))

      return NextResponse.json({
        groups: groupedNotifications.map((g) => ({
          type: g.type,
          total: g._count._all,
          unread: unreadMap.get(g.type) || 0,
          latestAt: g._max.createdAt,
        })),
        unreadCount: unreadByType.reduce((sum, g) => sum + g._count._all, 0),
      })
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
    ])

    // Count unread
    const unreadCount = await db.notification.count({
      where: {
        ...where,
        isRead: false,
      },
    })

    return NextResponse.json({
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    })
  } catch (error) {
    console.error('[NOTIFICATIONS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/notifications
 * Create a notification (internal use).
 * Body: { userId?, type, channel?, title, message, data?, branchId? }
 *
 * SECURITY: This endpoint previously had NO authentication — anyone on the
 * internet could create fraudulent notifications for any restaurant/branch.
 * Now requires auth + 'restaurant:view' permission + restaurant scope.
 * The branchId in the body (if provided) is also validated to belong to the
 * restaurant, so a caller cannot inject notifications into another branch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // ── Auth + permission + restaurant scope ──
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { userId, type, channel = 'in_app', title, message, data, branchId } = body as {
      userId?: string
      type: string
      channel?: string
      title: string
      message: string
      data?: unknown
      branchId?: string
    }

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title, and message are required' },
        { status: 400 }
      )
    }

    // ── Validate branchId belongs to this restaurant (if provided) ──
    // Prevents a caller from injecting notifications into a branch of a
    // different restaurant (the FK would technically allow it since branchId
    // is just a string, but we want a clear 400 instead of a confusing FK error).
    if (branchId) {
      const branch = await db.branch.findFirst({
        where: { id: branchId, restaurantId },
        select: { id: true },
      })
      if (!branch) {
        return NextResponse.json(
          { error: 'branchId does not belong to this restaurant' },
          { status: 400 }
        )
      }
    }

    const validTypes = [
      'new_order',
      'order_ready',
      'payment_success',
      'payment_failed',
      'subscription_expiry',
      'waiter_call',
      'low_stock',
      'system',
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validChannels = ['in_app', 'sms', 'push']
    if (!validChannels.includes(channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: {
        restaurantId,
        branchId: branchId || null,
        userId: userId || null,
        type,
        channel,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    })

    return NextResponse.json({ data: notification }, { status: 201 })
  } catch (error) {
    // requireAuth throws Error('Unauthorized') on missing/invalid token
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[NOTIFICATION_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}
