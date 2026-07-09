// ============================================================
// Yene QR — Shift Entries API
// GET    /api/restaurants/[id]/shifts/entries — List entries (filter by date, branchId, userId)
// POST   /api/restaurants/[id]/shifts/entries — Create/schedule a shift entry
// PATCH  /api/restaurants/[id]/shifts/entries — Clock in, clock out, start/end break
// DELETE /api/restaurants/[id]/shifts/entries — Remove a shift entry
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm, resolveBranchScope } from '@/lib/api-auth'

// GET — List shift entries with filters
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permErr = requirePerm(auth, 'staff:view', restaurantId)
    if (permErr) return permErr

    const url = new URL(request.url)
    // Use resolveBranchScope so branch-scoped staff cannot see other branches' entries
    const branchId = resolveBranchScope(auth, url.searchParams.get('branchId'))
    const date = url.searchParams.get('date') // YYYY-MM-DD
    const userId = url.searchParams.get('userId')
    const shiftId = url.searchParams.get('shiftId')
    const status = url.searchParams.get('status')

    const where: any = { restaurantId }
    if (branchId) where.branchId = branchId
    if (userId) where.userId = userId
    if (shiftId) where.shiftId = shiftId
    if (status) where.status = status

    if (date) {
      const start = new Date(date + 'T00:00:00.000Z')
      const end = new Date(date + 'T23:59:59.999Z')
      where.date = { gte: start, lte: end }
    }

    const entries = await db.shiftEntry.findMany({
      where,
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
        user: { select: { id: true, name: true, role: true, avatar: true, phone: true } },
        branch: { select: { id: true, name: true } },
        kitchenStation: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }],
    })

    return NextResponse.json({ data: entries })
  } catch (error) {
    console.error('[SHIFT_ENTRIES_LIST_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch shift entries' }, { status: 500 })
  }
}

// POST — Schedule a shift entry (assign staff to a shift on a date)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { shiftId, userId, branchId, date, stationId, assignedTables, notes } = body

    if (!shiftId || !userId || !branchId || !date) {
      return NextResponse.json(
        { error: 'shiftId, userId, branchId, and date are required' },
        { status: 400 }
      )
    }

    // Verify shift exists and belongs to restaurant
    const shift = await db.shift.findFirst({
      where: { id: shiftId, restaurantId, isActive: true },
    })
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    // Verify user exists and belongs to restaurant
    const user = await db.restaurantUser.findFirst({
      where: { id: userId, restaurantId, isActive: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const entryDate = new Date(date + 'T00:00:00.000Z')

    const entry = await db.shiftEntry.create({
      data: {
        shiftId,
        userId,
        restaurantId,
        branchId,
        date: entryDate,
        stationId: stationId || null,
        assignedTables: assignedTables ? JSON.stringify(assignedTables) : null,
        notes: notes || null,
        status: 'scheduled',
      },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
        user: { select: { id: true, name: true, role: true, avatar: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: entry }, { status: 201 })
  } catch (error: any) {
    // Handle unique constraint violation (duplicate entry)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This user is already assigned to this shift on this date' },
        { status: 409 }
      )
    }
    console.error('[SHIFT_ENTRY_CREATE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create shift entry' }, { status: 500 })
  }
}

// PATCH — Clock in, clock out, start/end break, update assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { entryId, action, assignedTables, stationId, notes } = body

    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 })
    }

    const entry = await db.shiftEntry.findFirst({
      where: { id: entryId, restaurantId },
    })
    if (!entry) {
      return NextResponse.json({ error: 'Shift entry not found' }, { status: 404 })
    }

    const now = new Date()
    const updateData: any = {}

    switch (action) {
      case 'clock_in':
        if (entry.status !== 'scheduled') {
          return NextResponse.json({ error: 'Can only clock in from scheduled status' }, { status: 400 })
        }
        updateData.status = 'clocked_in'
        updateData.clockInTime = now
        break

      case 'clock_out':
        if (entry.status !== 'clocked_in' && entry.status !== 'on_break') {
          return NextResponse.json({ error: 'Can only clock out from clocked_in or on_break status' }, { status: 400 })
        }
        updateData.status = 'clocked_out'
        updateData.clockOutTime = now
        // If on break, end the break too
        if (entry.status === 'on_break' && !entry.breakEnd) {
          updateData.breakEnd = now
        }
        break

      case 'start_break':
        if (entry.status !== 'clocked_in') {
          return NextResponse.json({ error: 'Can only start break from clocked_in status' }, { status: 400 })
        }
        updateData.status = 'on_break'
        updateData.breakStart = now
        break

      case 'end_break':
        if (entry.status !== 'on_break') {
          return NextResponse.json({ error: 'Can only end break from on_break status' }, { status: 400 })
        }
        updateData.status = 'clocked_in'
        updateData.breakEnd = now
        break

      case 'mark_absent':
        if (entry.status !== 'scheduled') {
          return NextResponse.json({ error: 'Can only mark absent from scheduled status' }, { status: 400 })
        }
        updateData.status = 'absent'
        break

      case 'update':
        // Update assignment data without changing status
        if (assignedTables !== undefined) {
          updateData.assignedTables = JSON.stringify(assignedTables)
        }
        if (stationId !== undefined) {
          updateData.stationId = stationId
        }
        if (notes !== undefined) {
          updateData.notes = notes
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action. Use: clock_in, clock_out, start_break, end_break, mark_absent, update' }, { status: 400 })
    }

    const updated = await db.shiftEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
        user: { select: { id: true, name: true, role: true, avatar: true } },
        branch: { select: { id: true, name: true } },
        kitchenStation: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[SHIFT_ENTRY_UPDATE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update shift entry' }, { status: 500 })
  }
}

// DELETE — Remove a shift entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const entryId = url.searchParams.get('entryId')

    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 })
    }

    // Only allow deleting scheduled entries
    const entry = await db.shiftEntry.findFirst({
      where: { id: entryId, restaurantId },
    })
    if (!entry) {
      return NextResponse.json({ error: 'Shift entry not found' }, { status: 404 })
    }
    if (entry.status !== 'scheduled') {
      return NextResponse.json({ error: 'Can only delete scheduled entries' }, { status: 400 })
    }

    await db.shiftEntry.delete({ where: { id: entryId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SHIFT_ENTRY_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete shift entry' }, { status: 500 })
  }
}
