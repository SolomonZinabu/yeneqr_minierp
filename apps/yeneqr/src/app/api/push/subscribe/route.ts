// ============================================================
// Yene QR — Push Subscription API
// POST: Save push subscription for a user
// DELETE: Remove push subscription
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

/**
 * POST /api/push/subscribe
 * Save a push subscription (endpoint, keys) for a user.
 * Body: { endpoint, p256dh, auth }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)

    const body = await request.json()
    const { endpoint, p256dh, auth: authKey } = body as {
      endpoint: string
      p256dh: string
      auth: string
    }

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        { error: 'endpoint, p256dh, and auth are required' },
        { status: 400 }
      )
    }

    // Upsert: if the same userId+endpoint exists, update keys; otherwise create
    const existing = await db.pushSubscription.findFirst({
      where: { userId: auth.userId, endpoint },
    })

    if (existing) {
      await db.pushSubscription.update({
        where: { id: existing.id },
        data: { p256dh, auth: authKey },
      })
    } else {
      await db.pushSubscription.create({
        data: {
          userId: auth.userId,
          restaurantId: auth.restaurantId || '',
          endpoint,
          p256dh,
          auth: authKey,
        },
      })
    }

    return NextResponse.json({ message: 'Push subscription saved' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PUSH_SUBSCRIBE]', error)
    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/push/subscribe
 * Remove a push subscription.
 * Body: { endpoint }
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request)

    const body = await request.json()
    const { endpoint } = body as { endpoint: string }

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpoint is required' },
        { status: 400 }
      )
    }

    await db.pushSubscription.deleteMany({
      where: { userId: auth.userId, endpoint },
    })

    return NextResponse.json({ message: 'Push subscription removed' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PUSH_UNSUBSCRIBE]', error)
    return NextResponse.json(
      { error: 'Failed to remove push subscription' },
      { status: 500 }
    )
  }
}
