// ============================================================
// Yene QR — Mark All Notifications as Read (Phase R2)
// ============================================================
// POST /api/restaurants/[id]/notifications/mark-all-read
// Bulk-marks all unread notifications as read in a single DB query.
// Previously the frontend looped through each notification individually
// (N API calls for N notifications) — this does it in 1 query.
//
// Optional body: { type?: string, branchId?: string }
// If type is provided, only marks notifications of that type as read.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const body = await request.json().catch(() => ({}))
    const { type, branchId: bodyBranchId } = body as { type?: string; branchId?: string }

    // Resolve branch scope (respects auth.branchId for branch-scoped staff)
    const branchId = resolveBranchScope(auth, bodyBranchId || null)

    const where: Record<string, unknown> = {
      restaurantId,
      isRead: false,
    }

    // Scope to the user's notifications (their personal + broadcast)
    if (auth.userId) {
      where.OR = [
        { userId: auth.userId },
        { userId: null },
      ]
    }

    if (branchId) where.branchId = branchId
    if (type) where.type = type

    const result = await db.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      markedRead: result.count,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[NOTIFICATIONS_MARK_ALL_READ]', error)
    return NextResponse.json(
      { error: 'Failed to mark all as read' },
      { status: 500 }
    )
  }
}
