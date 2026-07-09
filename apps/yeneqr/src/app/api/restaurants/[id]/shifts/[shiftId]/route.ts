// ============================================================
// Yene QR — Shift Detail API
// GET    /api/restaurants/[id]/shifts/[shiftId] — Get shift details
// PUT    /api/restaurants/[id]/shifts/[shiftId] — Update shift
// DELETE /api/restaurants/[id]/shifts/[shiftId] — Soft-delete shift
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
  try {
    const { id: restaurantId, shiftId } = await params
    const auth = getAuthContext(request)
    if (!auth || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permErr = requirePerm(auth, 'staff:view', restaurantId)
    if (permErr) return permErr

    const shift = await db.shift.findFirst({
      where: { id: shiftId, restaurantId },
      include: {
        branch: { select: { id: true, name: true } },
        shiftEntries: {
          include: {
            user: { select: { id: true, name: true, role: true, avatar: true } },
            kitchenStation: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    return NextResponse.json({ data: shift })
  } catch (error) {
    console.error('[SHIFT_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch shift' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
  try {
    const { id: restaurantId, shiftId } = await params
    const auth = getAuthContext(request)
    if (!auth || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { name, startTime, endTime, color, isActive } = body

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (startTime && !timeRegex.test(startTime)) {
      return NextResponse.json({ error: 'startTime must be in HH:mm format' }, { status: 400 })
    }
    if (endTime && !timeRegex.test(endTime)) {
      return NextResponse.json({ error: 'endTime must be in HH:mm format' }, { status: 400 })
    }

    const shift = await db.shift.update({
      where: { id: shiftId },
      data: {
        ...(name !== undefined && { name }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: shift })
  } catch (error) {
    console.error('[SHIFT_UPDATE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
  try {
    const { id: restaurantId, shiftId } = await params
    const auth = getAuthContext(request)
    if (!auth || auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    // Soft delete
    await db.shift.update({
      where: { id: shiftId },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SHIFT_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
