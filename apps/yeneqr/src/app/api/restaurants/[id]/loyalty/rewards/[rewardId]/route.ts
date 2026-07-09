// ============================================================
// Yene QR — Loyalty Reward Detail API (DELETE)
// ============================================================
// DELETE /api/restaurants/[id]/loyalty/rewards/[rewardId]
// Soft-deletes a loyalty reward by setting isActive=false.
// (Hard delete would break historical redemption records.)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rewardId: string }> }
) {
  try {
    const { id: restaurantId, rewardId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    // Verify the reward belongs to this restaurant
    const existing = await db.loyaltyReward.findFirst({
      where: { id: rewardId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 }
      )
    }

    // Soft-delete: mark as inactive so historical redemptions stay intact
    await db.loyaltyReward.update({
      where: { id: rewardId },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[LOYALTY_REWARD_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete reward' },
      { status: 500 }
    )
  }
}
