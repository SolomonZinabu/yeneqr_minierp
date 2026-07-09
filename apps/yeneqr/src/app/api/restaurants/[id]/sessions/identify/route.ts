// ============================================================
// Customer Identification API
// ============================================================
// POST /api/restaurants/[id]/sessions/identify
//
// Allows a guest (anonymous CustomerSession) to identify themselves
// by providing a name and optionally a phone number. This:
//
//   1. Updates the CustomerSession with customerName + customerPhone
//   2. Finds or creates a Customer record (keyed by phone per restaurant)
//   3. Links the session to the Customer record (customerId)
//   4. Migrates any existing leaderboard entries from sessionId dedupKey
//      to customerId dedupKey, so the customer's previous anonymous
//      scores now count under their identified identity.
//   5. Returns the customer profile (name, points, rewards, best scores)
//
// Body: { name: string, phone?: string }
// Auth: Bearer <sessionToken>
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    if (!auth?.sessionId) {
      return NextResponse.json(
        { error: 'Active session required. Scan the table QR to identify yourself.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone } = body as { name?: string; phone?: string }

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const trimmedName = name.trim().slice(0, 50)
    const trimmedPhone = phone?.trim() || null

    // 1. Load the current session
    const session = await db.customerSession.findUnique({
      where: { id: auth.sessionId },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Session does not belong to this restaurant' }, { status: 403 })
    }

    // 2. Find or create Customer record (only if phone provided)
    let customerId: string | null = session.customerId

    if (trimmedPhone) {
      const existing = await db.customer.findUnique({
        where: {
          restaurantId_phone: {
            restaurantId,
            phone: trimmedPhone,
          },
        },
      })

      if (existing) {
        customerId = existing.id
        if (!existing.name && trimmedName) {
          await db.customer.update({
            where: { id: existing.id },
            data: { name: trimmedName },
          })
        }
      } else {
        const created = await db.customer.create({
          data: {
            restaurantId,
            name: trimmedName,
            phone: trimmedPhone,
            lastVisitAt: new Date(),
          },
        })
        customerId = created.id
      }
    }

    // 3. Update the session
    await db.customerSession.update({
      where: { id: session.id },
      data: {
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        customerId,
      },
    })

    // 4. Migrate leaderboard entries from session dedupKey to customer dedupKey
    if (customerId) {
      const sessionDedupKey = `session:${session.id}`
      const customerDedupKey = `customer:${customerId}`

      const sessionEntries = await db.gameLeaderboard.findMany({
        where: {
          restaurantId,
          dedupKey: sessionDedupKey,
        },
      })

      for (const entry of sessionEntries) {
        const customerEntry = await db.gameLeaderboard.findUnique({
          where: {
            restaurantId_gameType_period_dedupKey: {
              restaurantId,
              gameType: entry.gameType,
              period: entry.period,
              dedupKey: customerDedupKey,
            },
          },
        })

        if (customerEntry) {
          const newBest = Math.max(customerEntry.bestScore, entry.bestScore)
          const newTotal = customerEntry.totalPlays + entry.totalPlays
          const newAvg = (customerEntry.avgScore * customerEntry.totalPlays + entry.avgScore * entry.totalPlays) / newTotal

          await db.gameLeaderboard.update({
            where: { id: customerEntry.id },
            data: {
              bestScore: newBest,
              totalPlays: newTotal,
              avgScore: newAvg,
              customerId,
              customerName: trimmedName,
            },
          })

          await db.gameLeaderboard.delete({ where: { id: entry.id } })
        } else {
          await db.gameLeaderboard.update({
            where: { id: entry.id },
            data: {
              dedupKey: customerDedupKey,
              customerId,
              customerName: trimmedName,
            },
          })
        }
      }

      // Repoint GameSession and GameReward records
      await db.gameSession.updateMany({
        where: { sessionId: session.id, customerId: null },
        data: { customerId, customerName: trimmedName },
      })

      await db.gameReward.updateMany({
        where: { sessionId: session.id, customerId: null },
        data: { customerId, customerName: trimmedName, customerPhone: trimmedPhone },
      })

      // Recalculate ranks for affected leaderboards
      const affectedGameTypes = [...new Set(sessionEntries.map(e => e.gameType))]
      const affectedPeriods = [...new Set(sessionEntries.map(e => e.period))]
      for (const gameType of affectedGameTypes) {
        for (const period of affectedPeriods) {
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
        }
      }
    }

    // 5. Build profile response
    const customer = customerId
      ? await db.customer.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            name: true,
            phone: true,
            loyaltyPoints: true,
            totalSpentCents: true,
            visitCount: true,
          },
        })
      : null

    const unclaimedRewards = customerId
      ? await db.gameReward.findMany({
          where: {
            customerId,
            isClaimed: false,
          },
          select: {
            id: true,
            gameType: true,
            period: true,
            position: true,
            rewardType: true,
            rewardValue: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : []

    const bestScores = customerId
      ? await db.gameSession.groupBy({
          by: ['gameType'],
          where: { customerId },
          _max: { score: true },
          _count: { score: true },
        })
      : []

    return NextResponse.json({
      data: {
        identified: true,
        customer: customer
          ? {
              ...customer,
            }
          : null,
        unclaimedRewards: unclaimedRewards.map(r => ({
          ...r,
          rewardValue: (() => { try { return JSON.parse(r.rewardValue) } catch { return {} } })(),
        })),
        bestScores: bestScores.map(b => ({
          gameType: b.gameType,
          bestScore: b._max.score || 0,
          totalPlays: b._count.score,
        })),
      },
    })
  } catch (error) {
    console.error('[SESSION_IDENTIFY]', error)
    return NextResponse.json(
      { error: 'Failed to identify customer' },
      { status: 500 }
    )
  }
}

// GET — fetch the current customer profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    if (!auth?.sessionId) {
      return NextResponse.json({ data: { identified: false } })
    }

    const session = await db.customerSession.findUnique({
      where: { id: auth.sessionId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        customerId: true,
      },
    })

    if (!session) {
      return NextResponse.json({ data: { identified: false } })
    }

    if (!session.customerName) {
      return NextResponse.json({
        data: {
          identified: false,
          hasSession: true,
        },
      })
    }

    const customer = session.customerId
      ? await db.customer.findUnique({
          where: { id: session.customerId },
          select: {
            id: true,
            name: true,
            phone: true,
            loyaltyPoints: true,
            totalSpentCents: true,
            visitCount: true,
          },
        })
      : null

    const unclaimedRewards = session.customerId
      ? await db.gameReward.findMany({
          where: {
            customerId: session.customerId,
            isClaimed: false,
          },
          select: {
            id: true,
            gameType: true,
            period: true,
            position: true,
            rewardType: true,
            rewardValue: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : []

    const bestScores = session.customerId
      ? await db.gameSession.groupBy({
          by: ['gameType'],
          where: { customerId: session.customerId },
          _max: { score: true },
          _count: { score: true },
        })
      : []

    return NextResponse.json({
      data: {
        identified: true,
        name: session.customerName,
        phone: session.customerPhone,
        customer: customer
          ? {
              ...customer,
            }
          : null,
        unclaimedRewards: unclaimedRewards.map(r => ({
          ...r,
          rewardValue: (() => { try { return JSON.parse(r.rewardValue) } catch { return {} } })(),
        })),
        bestScores: bestScores.map(b => ({
          gameType: b.gameType,
          bestScore: b._max.score || 0,
          totalPlays: b._count.score,
        })),
      },
    })
  } catch (error) {
    console.error('[SESSION_PROFILE_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}
