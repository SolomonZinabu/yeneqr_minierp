// Phase 4.5 — Dynamic Pricing
// GET /api/restaurants/[id]/dynamic-pricing — get current dynamic pricing rules
// POST /api/restaurants/[id]/dynamic-pricing — create/update pricing rule
// Rules: happy_hour (time-based discount), surge (demand-based markup), slow_hour (off-peak discount)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, getAuthContext } from '@/lib/api-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    // Dynamic pricing is implemented via the existing Promotion model
    // with type='happy_hour' and schedule JSON
    const rules = await db.promotion.findMany({
      where: { restaurantId, type: { in: ['happy_hour', 'discount'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        discountType: true,
        discountValueCents: true,
        validFrom: true,
        validUntil: true,
        isActive: true,
        schedule: true,
        applicableItems: true,
      },
    })

    // Also check for active happy hour right now
    const now = new Date()
    const activeRules = rules.filter(r => r.isActive && r.validFrom <= now && r.validUntil >= now)

    return NextResponse.json({
      data: rules,
      activeCount: activeRules.length,
      hasActiveHappyHour: activeRules.some(r => r.type === 'happy_hour'),
    })
  } catch (error) {
    console.error('[DYNAMIC_PRICING_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch pricing rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { name, type, discountType, discountValue, schedule, validFrom, validUntil, applicableItems } = body

    if (!name || !type || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: 'name, type, discountType, discountValue required' }, { status: 400 })
    }

    const { toCents, discountToCents } = await import('@/lib/money')

    const rule = await db.promotion.create({
      data: {
        restaurantId,
        name,
        type, // 'happy_hour' or 'discount'
        discountType,
        discountValueCents: discountToCents(discountValue, discountType),
        minimumOrderCents: 0,
        validFrom: new Date(validFrom || Date.now()),
        validUntil: new Date(validUntil || '2027-12-31'),
        isActive: true,
        schedule: schedule ? JSON.stringify(schedule) : null,
        applicableItems: applicableItems ? JSON.stringify(applicableItems) : null,
      },
    })

    return NextResponse.json({ data: rule }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[DYNAMIC_PRICING_CREATE]', error)
    return NextResponse.json({ error: 'Failed to create pricing rule' }, { status: 500 })
  }
}
