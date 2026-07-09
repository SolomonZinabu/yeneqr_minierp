// ============================================================
// YeneQR Arena — Submit Game Score
// ============================================================
// POST /api/restaurants/[id]/games/submit
// Body: {
//   gameType: string,
//   score: number,
//   correctAnswers: number,
//   totalQuestions: number,
//   maxStreak: number,
//   durationSeconds: number,
//   customerName?: string,
// }
//
// 1. Saves the game session
// 2. Updates the leaderboard (daily + weekly + all_time)
// 3. Checks if player earned a reward (top 3 daily/weekly)
// 4. Returns updated leaderboard position + any rewards earned
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'

const REWARD_CONFIG = {
  daily: [
    { position: 1, type: 'loyalty_points', value: { points: 100, badge: 'Daily Champion 🏆' } },
    { position: 2, type: 'loyalty_points', value: { points: 50 } },
    { position: 3, type: 'loyalty_points', value: { points: 25 } },
  ],
  weekly: [
    { position: 1, type: 'free_item', value: { description: 'Free dessert!', badge: 'Weekly Champion 👑' } },
    { position: 2, type: 'loyalty_points', value: { points: 200 } },
    { position: 3, type: 'loyalty_points', value: { points: 100 } },
  ],
}

function getPeriodBounds(period: 'daily' | 'weekly') {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  if (period === 'daily') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else {
    // Weekly: Monday to Sunday
    const day = now.getDay() || 7 // 0 = Sunday → 7
    start.setDate(now.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  }

  return { start, end }
}

// Compute the dedupKey: customerId if identified, otherwise sessionId, otherwise anonymous
function computeDedupKey(customerId: string | null, sessionId: string | null): string {
  if (customerId) return `customer:${customerId}`
  if (sessionId) return `session:${sessionId}`
  return 'session:anonymous'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    const body = await request.json()
    const {
      gameType,
      score,
      correctAnswers = 0,
      totalQuestions = 0,
      maxStreak = 0,
      durationSeconds = 0,
      customerName = 'Guest',
    } = body as {
      gameType: string
      score: number
      correctAnswers?: number
      totalQuestions?: number
      maxStreak?: number
      durationSeconds?: number
      customerName?: string
    }

    if (!gameType || score === undefined) {
      return NextResponse.json({ error: 'gameType and score are required' }, { status: 400 })
    }

    const sessionId = auth?.sessionId || body.sessionId || null
    const customerId = auth?.type === 'customer' ? auth.userId : body.customerId || null
    const branchId = auth?.branchId || body.branchId || null

    // If the customer is identified, load their name from the session/customer
    // record so we don't trust the client-provided name
    let resolvedName = customerName
    if (sessionId) {
      const session = await db.customerSession.findUnique({
        where: { id: sessionId },
        select: { customerName: true, customerPhone: true, customerId: true },
      })
      if (session?.customerName) {
        resolvedName = session.customerName
      }
      if (session?.customerPhone && !customerId) {
        // Try to find customer by phone
        const linkedCustomer = await db.customer.findUnique({
          where: {
            restaurantId_phone: {
              restaurantId,
              phone: session.customerPhone,
            },
          },
        })
        if (linkedCustomer) {
          // Auto-link the session to this customer
          await db.customerSession.update({
            where: { id: sessionId },
            data: { customerId: linkedCustomer.id },
          })
        }
      }
    }

    // 1. Save the game session
    const session = await db.gameSession.create({
      data: {
        restaurantId,
        branchId,
        sessionId,
        customerId,
        customerName: resolvedName,
        gameType,
        score,
        correctAnswers,
        totalQuestions,
        maxStreak,
        durationSeconds,
      },
    })

    // 2. Update leaderboards (daily + weekly)
    const dedupKey = computeDedupKey(customerId, sessionId)
    const rewards: Array<{ period: string; position: number; reward: typeof REWARD_CONFIG.daily[0] }> = []

    // Load customer phone for reward records
    let customerPhone: string | null = null
    if (customerId) {
      const customer = await db.customer.findUnique({
        where: { id: customerId },
        select: { phone: true },
      })
      customerPhone = customer?.phone || null
    } else if (sessionId) {
      const sess = await db.customerSession.findUnique({
        where: { id: sessionId },
        select: { customerPhone: true },
      })
      customerPhone = sess?.customerPhone || null
    }

    for (const period of ['daily', 'weekly'] as const) {
      const { start, end } = getPeriodBounds(period)

      // Get or create leaderboard entry by dedupKey (customerId OR sessionId)
      const existing = await db.gameLeaderboard.findUnique({
        where: {
          restaurantId_gameType_period_dedupKey: {
            restaurantId,
            gameType,
            period,
            dedupKey,
          },
        },
      })

      if (existing) {
        const newBest = Math.max(existing.bestScore, score)
        const newTotal = existing.totalPlays + 1
        const newAvg = (existing.avgScore * existing.totalPlays + score) / newTotal

        await db.gameLeaderboard.update({
          where: { id: existing.id },
          data: {
            bestScore: newBest,
            totalPlays: newTotal,
            avgScore: newAvg,
            customerName: resolvedName,
            customerId: customerId || existing.customerId,
            sessionId: sessionId || existing.sessionId,
            updatedAt: new Date(),
          },
        })
      } else {
        await db.gameLeaderboard.create({
          data: {
            restaurantId,
            gameType,
            period,
            customerName: resolvedName,
            customerId,
            sessionId,
            bestScore: score,
            totalPlays: 1,
            avgScore: score,
            rank: 999,
            periodStart: start,
            periodEnd: end,
            dedupKey,
          },
        })
      }

      // Recalculate ranks for this period
      const allEntries = await db.gameLeaderboard.findMany({
        where: { restaurantId, gameType, period },
        orderBy: { bestScore: 'desc' },
      })

      for (let i = 0; i < allEntries.length; i++) {
        await db.gameLeaderboard.update({
          where: { id: allEntries[i].id },
          data: { rank: i + 1 },
        })
      }

      // 3. Check for rewards
      const playerEntry = allEntries.find(e => e.dedupKey === dedupKey)
      const playerRank = playerEntry?.rank || 999

      const rewardConfig = REWARD_CONFIG[period]
      for (const reward of rewardConfig) {
        if (playerRank === reward.position) {
          // Only award if not already claimed for this period+position
          const alreadyRewarded = await db.gameReward.findFirst({
            where: {
              restaurantId,
              gameType,
              period,
              position: reward.position,
              dedupKey,
            },
          })

          if (!alreadyRewarded) {
            const rewardValue = JSON.stringify(reward.value)
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 7) // Rewards expire in 7 days

            await db.gameReward.create({
              data: {
                restaurantId,
                gameType,
                period,
                position: reward.position,
                rewardType: reward.type,
                rewardValue,
                customerId,
                customerName: resolvedName,
                customerPhone,
                sessionId,
                dedupKey,
                isClaimed: false,
                expiresAt,
              },
            })

            // If loyalty points reward, credit them immediately
            if (reward.type === 'loyalty_points' && customerId) {
              const points = (reward.value as { points: number }).points
              await db.customer.update({
                where: { id: customerId },
                data: { loyaltyPoints: { increment: points } },
              }).catch(() => {})
            }

            rewards.push({ period, position: reward.position, reward: reward as typeof REWARD_CONFIG.daily[0] })
          }
        }
      }
    }

    // 4. Get the player's current rank
    const dailyLeaderboard = await db.gameLeaderboard.findMany({
      where: { restaurantId, gameType, period: 'daily' },
      orderBy: { bestScore: 'desc' },
      take: 10,
      select: { customerName: true, bestScore: true, rank: true, totalPlays: true },
    })

    const playerDailyRank = dailyLeaderboard.findIndex(e => e.customerName === resolvedName) + 1

    return NextResponse.json({
      data: {
        sessionId: session.id,
        score,
        correctAnswers,
        maxStreak,
        dailyRank: playerDailyRank || null,
        topTen: dailyLeaderboard,
        rewards: rewards.map(r => ({
          period: r.period,
          position: r.position,
          type: r.reward.type,
          ...r.reward.value as Record<string, unknown>,
        })),
      },
    })
  } catch (error) {
    console.error('[GAME_SUBMIT]', error)
    return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 })
  }
}
