// ============================================================
// Yene QR — Notification Detail API (Mark as Read)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * PUT /api/restaurants/[id]/notifications/[notificationId]
 * Mark notification as read.
 * Body: { isRead?: boolean } (defaults to true)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  try {
    const { id: restaurantId, notificationId } = await params
    const auth = requireAuth(request)

    // Require restaurant:view permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (notification.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { isRead = true } = body as { isRead?: boolean }

    const updated = await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[NOTIFICATION_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/notifications/[notificationId]
 * Delete a notification.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  try {
    const { id: restaurantId, notificationId } = await params
    const auth = requireAuth(request)

    // Require restaurant:view permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (notification.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.notification.delete({
      where: { id: notificationId },
    })

    return NextResponse.json({ data: { id: notificationId, deleted: true } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[NOTIFICATION_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
