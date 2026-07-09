// ============================================================
// Yene QR — Waiter Call Detail API (Acknowledge/Resolve)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'

/**
 * PUT /api/restaurants/[id]/waiter-calls/[callId]
 * Acknowledge or resolve a waiter call.
 * Body: { status: 'acknowledged' | 'resolved' }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> }
) {
  try {
    const { id: restaurantId, callId } = await params
    const auth = requireAuth(request)

    // Require restaurant:view permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const call = await db.waiterCall.findUnique({
      where: { id: callId },
    })

    if (!call) {
      return NextResponse.json(
        { error: 'Waiter call not found' },
        { status: 404 }
      )
    }

    if (call.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body as { status: string }

    if (!['acknowledged', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be "acknowledged" or "resolved"' },
        { status: 400 }
      )
    }

    // Validate state transitions
    if (call.status === 'resolved') {
      return NextResponse.json(
        { error: 'Call is already resolved' },
        { status: 400 }
      )
    }

    if (status === 'acknowledged' && call.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only acknowledge pending calls' },
        { status: 400 }
      )
    }

    if (status === 'resolved' && call.status === 'pending') {
      return NextResponse.json(
        { error: 'Call must be acknowledged before resolving' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { status }

    if (status === 'acknowledged') {
      updateData.acknowledgedBy = auth.userId
      updateData.acknowledgedAt = new Date()
    } else if (status === 'resolved') {
      updateData.resolvedAt = new Date()
    }

    const updated = await db.waiterCall.update({
      where: { id: callId },
      data: updateData,
    })

    // Emit real-time event so other waiters see the status change immediately
    emitEvent({
      type: 'waiter_call',
      restaurantId,
      callId: updated.id,
      tableId: updated.tableId,
      tableNumber: 0, // We don't have the table number here, but clients will re-fetch
      requestType: updated.requestType,
      message: updated.message || undefined,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[WAITER_CALL_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update waiter call' },
      { status: 500 }
    )
  }
}
