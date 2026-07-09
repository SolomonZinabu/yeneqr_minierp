// ============================================================
// Yene QR — Loyalty Rewards Catalog API (Phase 3.3)
// ============================================================
// GET  /api/restaurants/[id]/loyalty/rewards — list rewards
// POST /api/restaurants/[id]/loyalty/rewards — create reward
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, getAuthContext } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)

    // Public endpoint for customer view (active rewards only)
    // Staff can see all rewards
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where: Record<string, unknown> = { restaurantId }
    if (activeOnly || !auth) {
      where.isActive = true
    } else if (auth) {
      // Authenticated staff — verify scope
      const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
      if (permErr) return permErr
    }

    const rewards = await db.loyaltyReward.findMany({
      where,
      orderBy: { pointsCost: 'asc' },
    })

    return NextResponse.json({ data: rewards })
  } catch (error) {
    console.error('[REWARDS_LIST]', error)
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { name, description, type, pointsCost, menuItemId, categoryId, discountCents, isActive = true, sortOrder = 0 } = body

    if (!name || !type || !pointsCost) {
      return NextResponse.json({ error: 'name, type, and pointsCost are required' }, { status: 400 })
    }

    const validTypes = ['free_item', 'discount', 'free_category']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    if (type === 'free_item' && !menuItemId) {
      return NextResponse.json({ error: 'menuItemId is required for free_item type' }, { status: 400 })
    }
    if (type === 'discount' && (!discountCents || discountCents <= 0)) {
      return NextResponse.json({ error: 'discountCents must be > 0 for discount type' }, { status: 400 })
    }

    const reward = await db.loyaltyReward.create({
      data: {
        restaurantId,
        name,
        description: description || null,
        type,
        pointsCost,
        menuItemId: menuItemId || null,
        categoryId: categoryId || null,
        discountCents: discountCents || null,
        isActive,
        sortOrder,
      },
    })

    return NextResponse.json({ data: reward }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[REWARD_CREATE]', error)
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 })
  }
}
