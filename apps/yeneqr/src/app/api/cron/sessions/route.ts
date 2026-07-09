// ============================================================
// Yene QR — Session Cleanup Cron API Route
// POST /api/cron/sessions
// Deactivates expired customer sessions and cleans up old
// inactive session records. Called by external cron scheduler.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronHeader = request.headers.get('x-cron-secret')
    if (CRON_SECRET && cronHeader !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    let deactivated = 0
    let deleted = 0

    // 1. Deactivate all active sessions that have passed their expiresAt
    const deactivateResult = await db.customerSession.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: now },
      },
      data: {
        isActive: false,
      },
    })
    deactivated = deactivateResult.count

    // 2. Delete inactive sessions older than 7 days (cleanup)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const deleteResult = await db.customerSession.deleteMany({
      where: {
        isActive: false,
        lastActivityAt: { lt: sevenDaysAgo },
      },
    })
    deleted = deleteResult.count

    // 3. Also update table status for tables whose sessions expired
    // but table is still marked as 'occupied'
    const expiredSessions = await db.customerSession.findMany({
      where: {
        isActive: false,
        expiresAt: { lt: now },
        table: {
          status: 'occupied',
        },
      },
      select: {
        tableId: true,
        id: true,
      },
    })

    // Check each expired session's table — only free it if there are
    // no OTHER active sessions or active orders on that table
    let tablesFreed = 0
    for (const session of expiredSessions) {
      const hasActiveSession = await db.customerSession.findFirst({
        where: {
          tableId: session.tableId,
          isActive: true,
        },
      })

      const hasActiveOrder = await db.order.findFirst({
        where: {
          tableId: session.tableId,
          status: { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up'] },
        },
      })

      if (!hasActiveSession && !hasActiveOrder) {
        await db.table.update({
          where: { id: session.tableId },
          data: { status: 'available' },
        })
        tablesFreed++
      }
    }

    console.log(
      `[SESSION_CLEANUP] Deactivated: ${deactivated}, Deleted: ${deleted}, Tables freed: ${tablesFreed}`
    )

    // Phase R2: Auto-dismiss old read notifications (older than 7 days)
    // Reduces notification fatigue by cleaning up notifications the user
    // has already seen. Unread notifications are NEVER auto-deleted.
    const oldReadNotifications = await db.notification.deleteMany({
      where: {
        isRead: true,
        readAt: { lt: sevenDaysAgo },
      },
    })
    console.log(
      `[NOTIFICATION_CLEANUP] Auto-dismissed ${oldReadNotifications.count} old read notifications`
    )

    return NextResponse.json({
      success: true,
      deactivated,
      deleted,
      tablesFreed,
      notificationsCleaned: oldReadNotifications.count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('[SESSION_CLEANUP_ERROR]', error)
    return NextResponse.json(
      { error: 'Session cleanup failed' },
      { status: 500 }
    )
  }
}
