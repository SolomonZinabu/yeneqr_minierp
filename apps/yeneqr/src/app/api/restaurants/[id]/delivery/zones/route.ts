// ============================================================
// Yene QR — Delivery Zones API (Phase 3.1)
// ============================================================
// GET  /api/restaurants/[id]/delivery/zones — list delivery zones
// POST /api/restaurants/[id]/delivery/zones — create zone
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
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where: Record<string, unknown> = { restaurantId }
    if (activeOnly || !auth) where.isActive = true

    if (auth) {
      const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
      if (permErr) return permErr
    }

    const zones = await db.deliveryZone.findMany({
      where,
      orderBy: { deliveryFeeCents: 'asc' },
    })

    return NextResponse.json({ data: zones })
  } catch (error) {
    console.error('[DELIVERY_ZONES_LIST]', error)
    return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 })
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
    const { name, deliveryFeeCents, estimatedMinutes, isActive = true } = body

    if (!name || deliveryFeeCents === undefined || !estimatedMinutes) {
      return NextResponse.json({ error: 'name, deliveryFeeCents, and estimatedMinutes are required' }, { status: 400 })
    }

    const zone = await db.deliveryZone.create({
      data: { restaurantId, name, deliveryFeeCents, estimatedMinutes, isActive },
    })

    return NextResponse.json({ data: zone }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[DELIVERY_ZONE_CREATE]', error)
    return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 })
  }
}
