// Phase 4.6 — Waitlist / Queue Management
// GET    /api/restaurants/[id]/waitlist — list waiting entries
// POST   /api/restaurants/[id]/waitlist — add to waitlist
// PATCH  /api/restaurants/[id]/waitlist — update status (seat, cancel, etc.)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, getAuthContext, resolveBranchScope } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const status = searchParams.get('status') || 'waiting'

    const where: Record<string, unknown> = { restaurantId }
    if (branchId) where.branchId = branchId
    if (status !== 'all') where.status = status

    const entries = await db.waitlistEntry.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    // Calculate estimated wait for each entry
    const waitingEntries = entries.filter(e => e.status === 'waiting')
    const enriched = entries.map((entry, index) => {
      const position = entry.status === 'waiting' ? waitingEntries.findIndex(e => e.id === entry.id) + 1 : null
      const estimatedWait = position ? position * 15 : null // 15 min per party ahead
      return { ...entry, position, estimatedWaitMinutes: estimatedWait }
    })

    return NextResponse.json({ data: enriched, waitingCount: waitingEntries.length })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[WAITLIST_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params

    // Rate limit: prevent waitlist spam
    const clientIp = getClientIp(request)
    const rl = checkRateLimit(`customerWaitlist:${clientIp}`, RATE_LIMITS.customerWaitlist)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    }

    const auth = getAuthContext(request)

    // Allow unauthenticated (customer self-add) or staff
    const body = await request.json()
    const { customerName, customerPhone, partySize, branchId, notes } = body

    if (!customerName || !partySize) {
      return NextResponse.json({ error: 'customerName and partySize are required' }, { status: 400 })
    }

    // Count current waiting entries for position estimate
    const waitingCount = await db.waitlistEntry.count({
      where: { restaurantId, status: 'waiting', ...(branchId ? { branchId } : {}) },
    })

    const quotedWaitMinutes = (waitingCount + 1) * 15 // 15 min per party ahead

    const entry = await db.waitlistEntry.create({
      data: {
        restaurantId,
        branchId: branchId || null,
        customerName,
        customerPhone: customerPhone || null,
        partySize: parseInt(partySize, 10) || 1,
        quotedWaitMinutes,
        notes: notes || null,
      },
    })

    // Emit real-time event for dashboard
    emitEvent({
      type: 'notification',
      restaurantId,
      branchId: branchId || undefined,
      notificationId: entry.id,
      notificationType: 'waitlist_added',
      title: 'New Waitlist Entry',
      message: `${customerName} (party of ${partySize}) added to waitlist`,
    })

    return NextResponse.json({
      data: { ...entry, position: waitingCount + 1, estimatedWaitMinutes: quotedWaitMinutes },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[WAITLIST_ADD]', error)
    return NextResponse.json({ error: 'Failed to add to waitlist' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { entryId, status } = body

    if (!entryId || !status) {
      return NextResponse.json({ error: 'entryId and status are required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { status }
    if (status === 'seated') updateData.seatedAt = new Date()

    const entry = await db.waitlistEntry.update({
      where: { id: entryId },
      data: updateData,
    })

    return NextResponse.json({ data: entry })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[WAITLIST_UPDATE]', error)
    return NextResponse.json({ error: 'Failed to update waitlist entry' }, { status: 500 })
  }
}
