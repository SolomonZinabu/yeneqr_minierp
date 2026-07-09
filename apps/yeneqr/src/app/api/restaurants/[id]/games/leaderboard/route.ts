// ============================================================
// YeneQR Arena — Leaderboard API
// ============================================================
// GET /api/restaurants/[id]/games/leaderboard?gameType=trivia_royale&period=daily
// Returns top 10 players for a game type and period
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get('gameType') || 'trivia_royale'
    const period = searchParams.get('period') || 'daily'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    const leaderboard = await db.gameLeaderboard.findMany({
      where: { restaurantId, gameType, period },
      orderBy: { bestScore: 'desc' },
      take: limit,
      select: {
        id: true,
        customerName: true,
        bestScore: true,
        totalPlays: true,
        avgScore: true,
        rank: true,
      },
    })

    // Get total unique players for this period
    const totalPlayers = await db.gameLeaderboard.count({
      where: { restaurantId, gameType, period },
    })

    return NextResponse.json({
      data: leaderboard,
      meta: {
        gameType,
        period,
        totalPlayers,
      },
    })
  } catch (error) {
    console.error('[LEADERBOARD_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
