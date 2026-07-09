// ============================================================
// Rewards API — Staff endpoints
// ============================================================
// GET /api/restaurants/[id]/rewards
//   Query params: status (unclaimed|claimed|all), gameType, period
//   Returns list of game rewards for staff to manage
//
// POST /api/restaurants/[id]/rewards/[rewardId]/claim
//   Body: { note?: string }
//   Marks a reward as claimed by the current staff user
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    if (!auth || auth.type !== 'staff' || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Staff authentication required' }, { status: 401 })
    }

    requirePerm(auth, 'payment:view', restaurantId)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'unclaimed' // unclaimed|claimed|all
    const gameType = searchParams.get('gameType')
    const period = searchParams.get('period')

    const where: any = { restaurantId }
    if (status === 'unclaimed') where.isClaimed = false
    else if (status === 'claimed') where.isClaimed = true
    if (gameType) where.gameType = gameType
    if (period) where.period = period

    const rewards = await db.gameReward.findMany({
      where,
      orderBy: [
        { isClaimed: 'asc' }, // Unclaimed first
        { createdAt: 'desc' },
      ],
      take: 100,
    })

    // Format for staff UI
    const formatted = rewards.map(r => ({
      id: r.id,
      gameType: r.gameType,
      period: r.period,
      position: r.position,
      rewardType: r.rewardType,
      rewardValue: (() => { try { return JSON.parse(r.rewardValue) } catch { return {} } })(),
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerId: r.customerId,
      isClaimed: r.isClaimed,
      claimedAt: r.claimedAt,
      claimedBy: r.claimedBy,
      claimNote: r.claimNote,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      isExpired: r.expiresAt ? new Date(r.expiresAt) < new Date() : false,
    }))

    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error('[REWARDS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 })
  }
}
