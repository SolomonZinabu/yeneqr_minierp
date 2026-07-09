// ============================================================
// Reward Claim API — Staff marks a reward as redeemed
// ============================================================
// POST /api/restaurants/[id]/rewards/[rewardId]/claim
//   Body: { note?: string }
//   Marks the reward as claimed, records who claimed it and when,
//   and stores an optional staff note (e.g., "served chocolate cake")
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rewardId: string }> }
) {
  try {
    const { id: restaurantId, rewardId } = await params
    const auth = getAuthContext(request)

    if (!auth || auth.type !== 'staff' || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Staff authentication required' }, { status: 401 })
    }

    requirePerm(auth, 'payment:manage', restaurantId)

    const body = await request.json().catch(() => ({}))
    const note = (body as { note?: string })?.note?.trim().slice(0, 200) || null

    // Load the reward to verify it exists + belongs to this restaurant
    const reward = await db.gameReward.findUnique({
      where: { id: rewardId },
    })

    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    }

    if (reward.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Reward does not belong to this restaurant' }, { status: 403 })
    }

    if (reward.isClaimed) {
      return NextResponse.json({ error: 'Reward already claimed' }, { status: 400 })
    }

    // Mark as claimed
    const updated = await db.gameReward.update({
      where: { id: rewardId },
      data: {
        isClaimed: true,
        claimedAt: new Date(),
        claimedBy: auth.userId,
        claimNote: note,
      },
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        isClaimed: updated.isClaimed,
        claimedAt: updated.claimedAt,
        claimNote: updated.claimNote,
      },
    })
  } catch (error) {
    console.error('[REWARD_CLAIM]', error)
    return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 })
  }
}
