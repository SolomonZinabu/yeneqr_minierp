// ============================================================
// Yene QR — Table Reservation Detail API (Get, Update, Delete)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'
import { notifyReservationCancelledByCustomer, notifyReservationCancelledByRestaurant } from '@/lib/notifications'
import { logStaffAction } from '@/lib/audit-log'

/**
 * GET /api/restaurants/[id]/reservations/[reservationId]
 * Get reservation details.
 * Supports customer tokens (type=customer) for their own reservations.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reservationId: string }> }
) {
  try {
    const { id, reservationId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Customer tokens can view their own reservations
    if (auth.type === 'customer') {
      const reservation = await db.tableReservation.findFirst({
        where: { id: reservationId, restaurantId: id },
        include: {
          table: {
            select: { id: true, number: true, capacity: true, status: true },
          },
          branch: {
            select: { id: true, name: true },
          },
          restaurant: {
            select: { id: true, name: true },
          },
        },
      })
      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }
      return NextResponse.json({ data: reservation })
    }

    // Staff: require table:view permission + restaurant scope
    const permErr = requirePerm(auth, 'table:view', id)
    if (permErr) return permErr

    const reservation = await db.tableReservation.findFirst({
      where: { id: reservationId, restaurantId: id },
      include: {
        table: {
          select: { id: true, number: true, capacity: true, status: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        restaurant: {
          select: { id: true, name: true },
        },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Verify branch access for staff (customers are handled by their own session check)
    if (auth.type !== 'customer' && reservation.branchId) {
      const branchErr = verifyBranchAccess(auth, reservation.branchId, id)
      if (branchErr) return branchErr
    }

    return NextResponse.json({ data: reservation })
  } catch (error) {
    console.error('[RESERVATION_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservation' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/reservations/[reservationId]
 * Update a reservation (confirm, cancel, mark no-show, complete, assign table).
 * Supports customer tokens for cancellation only (pending/confirmed → cancelled).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reservationId: string }> }
) {
  try {
    const { id, reservationId } = await params
    const auth = requireAuth(request)

    // Customer tokens: only allow cancellation
    if (auth.type === 'customer' || auth.role === 'customer') {
      const existing = await db.tableReservation.findFirst({
        where: { id: reservationId, restaurantId: id },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }

      const body = await request.json()
      const { status, cancellationReason } = body

      // Customers can only cancel
      if (status !== 'cancelled') {
        return NextResponse.json({ error: 'Customers can only cancel reservations' }, { status: 403 })
      }

      // Only pending or confirmed reservations can be cancelled
      if (!['pending', 'confirmed'].includes(existing.status)) {
        return NextResponse.json(
          { error: `Cannot cancel a reservation with status "${existing.status}"` },
          { status: 400 }
        )
      }

      const fromStatus = existing.status

      // Cancel the reservation
      await db.tableReservation.update({
        where: { id: reservationId },
        data: { status: 'cancelled' },
      })

      // Release the table if one was assigned
      if (existing.tableId) {
        await db.table.update({
          where: { id: existing.tableId },
          data: { status: 'available' },
        })
      }

      // Emit real-time event
      emitEvent({
        type: 'reservation_status_changed',
        restaurantId: id,
        reservationId,
        fromStatus,
        toStatus: 'cancelled',
        tableId: existing.tableId || undefined,
      })

      // Notify restaurant staff
      const dateStr = existing.reservedDate ? new Date(existing.reservedDate).toLocaleDateString() : 'N/A'
      notifyReservationCancelledByCustomer(
        id,
        reservationId,
        existing.customerName,
        dateStr,
        existing.reservedTime,
        existing.partySize,
        cancellationReason || undefined
      ).catch((err) => console.error('[NOTIFY_RESERVATION_CANCELLED_BY_CUSTOMER]', err))

      return NextResponse.json({ data: { id: reservationId, status: 'cancelled' } })
    }

    // Staff: require table:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    const existing = await db.tableReservation.findFirst({
      where: { id: reservationId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Verify branch access for staff
    if (auth.type !== 'customer' && existing.branchId) {
      const branchErr = verifyBranchAccess(auth, existing.branchId, id)
      if (branchErr) return branchErr
    }

    const body = await request.json()
    const { status, tableId, notes, specialRequests, partySize, reservedDate, reservedTime, duration, customerName, customerPhone, customerEmail, cancellationReason } = body

    const updateData: Record<string, unknown> = {}

    // Status transitions
    if (status) {
      const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
      }

      // Validate transitions
      const transitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['completed', 'cancelled', 'no_show'],
        cancelled: [],
        completed: [],
        no_show: [],
      }

      const allowedNext = transitions[existing.status] || []
      if (!allowedNext.includes(status) && status !== existing.status) {
        return NextResponse.json(
          { error: `Cannot transition from "${existing.status}" to "${status}"` },
          { status: 400 }
        )
      }

      const fromStatus = existing.status
      updateData.status = status

      // When confirming, if a table is assigned, update its status
      if (status === 'confirmed' && (tableId || existing.tableId)) {
        const tid = tableId || existing.tableId
        if (tid) {
          await db.table.update({
            where: { id: tid },
            data: { status: 'reserved' },
          })
        }
      }

      // When cancelling or completing or no_show, release the table
      if (['cancelled', 'completed', 'no_show'].includes(status) && existing.tableId) {
        await db.table.update({
          where: { id: existing.tableId },
          data: { status: 'available' },
        })
      }

      // Emit real-time event for status change
      if (fromStatus !== status) {
        emitEvent({
          type: 'reservation_status_changed',
          restaurantId: id,
          reservationId,
          fromStatus,
          toStatus: status,
          tableId: existing.tableId || undefined,
        })

        // Audit log for staff-initiated status changes
        logStaffAction({
          restaurantId: id,
          userId: auth.userId,
          performedByType: auth.type,
          action: `reservation_${status}`,
          entityType: 'reservation',
          entityId: reservationId,
          previousData: { status: fromStatus, customerName: existing.customerName },
          newData: { status, cancellationReason: cancellationReason || null },
        }).catch((err) => console.error('[AUDIT_RESERVATION_STATUS]', err))

        // Notifications for cancellation
        if (status === 'cancelled') {
          const dateStr = existing.reservedDate ? new Date(existing.reservedDate).toLocaleDateString() : 'N/A'
          notifyReservationCancelledByRestaurant(
            id,
            reservationId,
            existing.customerName,
            dateStr,
            existing.reservedTime,
            cancellationReason || undefined,
            existing.customerPhone || undefined,
            existing.customerEmail || undefined
          ).catch((err) => console.error('[NOTIFY_RESERVATION_CANCELLED_BY_RESTAURANT]', err))
        }
      }
    }

    // Table assignment
    if (tableId !== undefined) {
      if (tableId) {
        const table = await db.table.findFirst({
          where: { id: tableId, branchId: existing.branchId, isActive: true },
        })
        if (!table) {
          return NextResponse.json({ error: 'Table not found in this branch' }, { status: 404 })
        }
      }
      updateData.tableId = tableId || null
    }

    if (notes !== undefined) updateData.notes = notes
    if (specialRequests !== undefined) updateData.specialRequests = specialRequests
    if (partySize !== undefined) updateData.partySize = partySize
    if (reservedDate !== undefined) updateData.reservedDate = new Date(reservedDate)
    if (reservedTime !== undefined) updateData.reservedTime = reservedTime
    if (duration !== undefined) updateData.duration = duration
    if (customerName !== undefined) updateData.customerName = customerName
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail

    const reservation = await db.tableReservation.update({
      where: { id: reservationId },
      data: updateData,
      include: {
        table: {
          select: { id: true, number: true, capacity: true, status: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ data: reservation })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESERVATION_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update reservation' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/reservations/[reservationId]
 * Cancel a reservation (soft delete by setting status to cancelled).
 * Supports customer tokens.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reservationId: string }> }
) {
  try {
    const { id, reservationId } = await params
    const auth = requireAuth(request)

    // Customer tokens: allow cancellation
    if (auth.type === 'customer' || auth.role === 'customer') {
      const existing = await db.tableReservation.findFirst({
        where: { id: reservationId, restaurantId: id },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }

      if (!['pending', 'confirmed'].includes(existing.status)) {
        return NextResponse.json(
          { error: `Cannot cancel a reservation with status "${existing.status}"` },
          { status: 400 }
        )
      }

      const fromStatus = existing.status

      // Cancel the reservation
      await db.tableReservation.update({
        where: { id: reservationId },
        data: { status: 'cancelled' },
      })

      // Release the table if one was assigned
      if (existing.tableId) {
        await db.table.update({
          where: { id: existing.tableId },
          data: { status: 'available' },
        })
      }

      // Emit real-time event
      emitEvent({
        type: 'reservation_status_changed',
        restaurantId: id,
        reservationId,
        fromStatus,
        toStatus: 'cancelled',
        tableId: existing.tableId || undefined,
      })

      // Notify restaurant staff
      const dateStr = existing.reservedDate ? new Date(existing.reservedDate).toLocaleDateString() : 'N/A'
      notifyReservationCancelledByCustomer(
        id,
        reservationId,
        existing.customerName,
        dateStr,
        existing.reservedTime,
        existing.partySize
      ).catch((err) => console.error('[NOTIFY_RESERVATION_CANCELLED_BY_CUSTOMER]', err))

      return NextResponse.json({ data: { id: reservationId, status: 'cancelled' } })
    }

    // Staff: require table:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'table:manage', id)
    if (permErr) return permErr

    const existing = await db.tableReservation.findFirst({
      where: { id: reservationId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    const fromStatus = existing.status

    // Cancel the reservation
    await db.tableReservation.update({
      where: { id: reservationId },
      data: { status: 'cancelled' },
    })

    // Release the table if one was assigned
    if (existing.tableId) {
      await db.table.update({
        where: { id: existing.tableId },
        data: { status: 'available' },
      })
    }

    // Emit real-time event
    emitEvent({
      type: 'reservation_status_changed',
      restaurantId: id,
      reservationId,
      fromStatus,
      toStatus: 'cancelled',
      tableId: existing.tableId || undefined,
    })

    // Audit log
    logStaffAction({
      restaurantId: id,
      userId: auth.userId,
      performedByType: auth.type,
      action: 'reservation_cancelled',
      entityType: 'reservation',
      entityId: reservationId,
      previousData: { status: fromStatus, customerName: existing.customerName },
      newData: { status: 'cancelled' },
    }).catch((err) => console.error('[AUDIT_RESERVATION_CANCEL]', err))

    // Notify customer
    const dateStr = existing.reservedDate ? new Date(existing.reservedDate).toLocaleDateString() : 'N/A'
    notifyReservationCancelledByRestaurant(
      id,
      reservationId,
      existing.customerName,
      dateStr,
      existing.reservedTime,
      undefined,
      existing.customerPhone || undefined,
      existing.customerEmail || undefined
    ).catch((err) => console.error('[NOTIFY_RESERVATION_CANCELLED_BY_RESTAURANT]', err))

    return NextResponse.json({ data: { id: reservationId, status: 'cancelled' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESERVATION_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to cancel reservation' },
      { status: 500 }
    )
  }
}
