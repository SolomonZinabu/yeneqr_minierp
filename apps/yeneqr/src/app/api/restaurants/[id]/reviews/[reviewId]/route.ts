// ============================================================
// Yene QR — Review Reply API (Phase R10)
// ============================================================
// PATCH /api/restaurants/[id]/reviews/[reviewId]
// Owner/manager replies to a customer review.
// Body: { ownerReply: string }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { id: restaurantId, reviewId } = await params
    const auth = requireAuth(request)

    // Only owners/managers can reply to reviews
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { ownerReply } = body as { ownerReply: string }

    if (!ownerReply || ownerReply.trim().length === 0) {
      return NextResponse.json({ error: 'ownerReply is required' }, { status: 400 })
    }

    if (ownerReply.length > 1000) {
      return NextResponse.json({ error: 'Reply must be under 1000 characters' }, { status: 400 })
    }

    // Verify the review belongs to this restaurant
    const review = await db.review.findFirst({
      where: { id: reviewId, restaurantId },
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const updated = await db.review.update({
      where: { id: reviewId },
      data: {
        ownerReply: ownerReply.trim(),
        ownerReplyAt: new Date(),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[REVIEW_REPLY]', error)
    return NextResponse.json({ error: 'Failed to reply to review' }, { status: 500 })
  }
}

// DELETE — remove owner reply (un-reply)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { id: restaurantId, reviewId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const review = await db.review.findFirst({
      where: { id: reviewId, restaurantId },
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const updated = await db.review.update({
      where: { id: reviewId },
      data: {
        ownerReply: null,
        ownerReplyAt: null,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[REVIEW_REPLY_DELETE]', error)
    return NextResponse.json({ error: 'Failed to remove reply' }, { status: 500 })
  }
}
