// ============================================================
// Yene QR — Table Reservations API (List & Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'
import { emitEvent } from '@/lib/realtime'
import { notifyReservationCreated } from '@/lib/notifications'
import { logStaffAction } from '@/lib/audit-log'

/**
 * GET /api/restaurants/[id]/reservations
 * List reservations for a restaurant.
 * Query params: branchId, date, status, page, limit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Staff: require table:view permission + restaurant scope
    const permErr = requirePerm(auth, 'table:view', id)
    if (permErr) return permErr

    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    // SECURITY (Phase 2.3): resolveBranchScope forces auth.branchId for
    // branch-scoped roles and customers, ignoring client-supplied branchId.
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const rawDate = searchParams.get('date')
    const date = rawDate && rawDate.trim() !== '' ? rawDate : undefined
    const rawStatus = searchParams.get('status')
    const status = rawStatus && rawStatus.trim() !== '' ? rawStatus : undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId: id }
    if (branchId) {
      where.branchId = branchId
    }
    if (status) {
      where.status = status
    }
    if (date) {
      try {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)
        where.reservedDate = { gte: startOfDay, lte: endOfDay }
      } catch {
        // Invalid date format, skip date filter
      }
    }

    const [reservations, total] = await Promise.all([
      db.tableReservation.findMany({
        where,
        skip,
        take: limit,
        // Show newest reservations first so admin always sees recent bookings
        orderBy: [{ createdAt: 'desc' }],
        include: {
          table: {
            select: { id: true, number: true, capacity: true, status: true },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
      }),
      db.tableReservation.count({ where }),
    ])

    return NextResponse.json({
      data: reservations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[RESERVATIONS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/reservations
 * Create a new reservation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limit: prevent reservation spam
    const clientIp = getClientIp(request)
    const rl = checkRateLimit(`customerReservation:${clientIp}`, RATE_LIMITS.customerReservation)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    }

    const auth = requireAuth(request)

    // Customer tokens: scope check only (customer-specific logic above)
    if (auth.type === 'customer') {
      if (auth.restaurantId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Staff: require table:manage permission + restaurant scope
      const permErr = requirePerm(auth, 'table:manage', id)
      if (permErr) return permErr
    }

    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }
    if (!restaurant.isActive) {
      return NextResponse.json(
        { error: 'Cannot create reservations for an inactive restaurant' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      branchId,
      tableId,
      customerName,
      customerPhone,
      customerEmail,
      partySize,
      reservedDate,
      reservedTime,
      duration,
      specialRequests,
      notes,
    } = body

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    // ── Customer session ↔ body branch cross-check ──
    // SECURITY: A customer at Branch A could previously book a table at
    // Branch B of the same restaurant by swapping `branchId` in the body.
    // Since `tableId` is optional for reservations, the attacker didn't
    // even need to know a valid table ID at Branch B. This block rejects
    // any mismatch between the customer's session branch and the requested
    // branch. Staff are allowed to book at any branch of their restaurant.
    if (auth.type === 'customer' && auth.branchId && auth.branchId !== branchId) {
      return NextResponse.json(
        { error: 'Forbidden — branch mismatch with customer session' },
        { status: 403 }
      )
    }

    if (!customerName) {
      return NextResponse.json({ error: 'customerName is required' }, { status: 400 })
    }
    if (!customerPhone) {
      return NextResponse.json({ error: 'customerPhone is required' }, { status: 400 })
    }
    if (!partySize || partySize < 1) {
      return NextResponse.json({ error: 'partySize must be at least 1' }, { status: 400 })
    }
    if (!reservedDate) {
      return NextResponse.json({ error: 'reservedDate is required' }, { status: 400 })
    }
    if (!reservedTime) {
      return NextResponse.json({ error: 'reservedTime is required' }, { status: 400 })
    }

    // Verify branch
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId: id, isActive: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found or inactive' }, { status: 404 })
    }

    // Verify table if provided
    if (tableId) {
      const table = await db.table.findFirst({
        where: { id: tableId, branchId, isActive: true },
      })
      if (!table) {
        return NextResponse.json({ error: 'Table not found or inactive' }, { status: 404 })
      }

      // Check for conflicting reservations
      const reservationDate = new Date(reservedDate)
      const reservationDuration = duration || 120

      // Parse the reserved time to get start/end minutes
      const [hours, minutes] = reservedTime.split(':').map(Number)
      const startMinutes = hours * 60 + minutes
      const endMinutes = startMinutes + reservationDuration

      const conflictingReservations = await db.tableReservation.findMany({
        where: {
          tableId,
          status: { in: ['pending', 'confirmed'] },
          reservedDate: {
            gte: new Date(reservationDate.setHours(0, 0, 0, 0)),
            lte: new Date(reservationDate.setHours(23, 59, 59, 999)),
          },
        },
      })

      for (const existing of conflictingReservations) {
        const [exH, exM] = existing.reservedTime.split(':').map(Number)
        const exStart = exH * 60 + exM
        const exEnd = exStart + existing.duration

        // Check overlap
        if (startMinutes < exEnd && endMinutes > exStart) {
          return NextResponse.json(
            { error: `Table is already reserved from ${existing.reservedTime} for ${existing.duration} minutes` },
            { status: 409 }
          )
        }
      }
    }

    const reservation = await db.tableReservation.create({
      data: {
        restaurantId: id,
        branchId,
        tableId: tableId || null,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        partySize,
        reservedDate: new Date(reservedDate),
        reservedTime,
        duration: duration || 120,
        status: 'pending',
        specialRequests: specialRequests || null,
        notes: notes || null,
      },
      include: {
        table: {
          select: { id: true, number: true, capacity: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    })

    // If table is specified, update table status to reserved
    if (tableId) {
      await db.table.update({
        where: { id: tableId },
        data: { status: 'reserved' },
      })
    }

    // Emit real-time event for new reservation
    emitEvent({
      type: 'reservation_status_changed',
      restaurantId: id,
      reservationId: reservation.id,
      fromStatus: 'none',
      toStatus: 'pending',
      tableId: tableId || undefined,
    })

    // Notify restaurant staff about new reservation
    const dateStr = reservation.reservedDate ? new Date(reservation.reservedDate).toLocaleDateString() : 'N/A'
    notifyReservationCreated(
      id,
      customerName.trim(),
      dateStr,
      reservedTime,
      partySize
    ).catch((err) => console.error('[NOTIFY_RESERVATION_CREATED]', err))

    // Audit log for staff-created reservations
    if (auth.type === 'staff') {
      logStaffAction({
        restaurantId: id,
        userId: auth.userId,
        performedByType: auth.type,
        action: 'reservation_created',
        entityType: 'reservation',
        entityId: reservation.id,
        newData: { customerName, reservedDate, reservedTime, partySize },
      }).catch((err) => console.error('[AUDIT_RESERVATION_CREATE]', err))
    }

    return NextResponse.json({ data: reservation }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESERVATION_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    )
  }
}
