// ============================================================
// Yene QR — Shift Management API
// GET  /api/restaurants/[id]/shifts — List shifts (optionally filter by branchId)
// POST /api/restaurants/[id]/shifts — Create a new shift
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm, resolveBranchScope } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Previously this route had NO permission check — any staff
    // role (including a junior waiter) could list ALL shifts across ALL
    // branches of the restaurant. Now requires 'staff:view' + restaurant scope.
    const permErr = requirePerm(auth, 'staff:view', restaurantId)
    if (permErr) return permErr

    const url = new URL(request.url)
    // Use resolveBranchScope so branch-scoped staff automatically get their
    // auth.branchId — they cannot omit ?branchId= to see all branches' shifts.
    const branchId = resolveBranchScope(auth, url.searchParams.get('branchId'))

    const where: any = { restaurantId, isActive: true }
    if (branchId) where.branchId = branchId

    const shifts = await db.shift.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { shiftEntries: true } },
      },
      orderBy: { startTime: 'asc' },
    })

    return NextResponse.json({ data: shifts })
  } catch (error) {
    console.error('[SHIFTS_LIST_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Previously this route had NO permission check — any staff
    // role could create new shifts in any branch of the restaurant. Now
    // requires 'staff:manage' + restaurant scope.
    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { branchId, name, startTime, endTime, color } = body

    if (!branchId || !name || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'branchId, name, startTime, and endTime are required' },
        { status: 400 }
      )
    }

    // Validate HH:mm format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'startTime and endTime must be in HH:mm format' },
        { status: 400 }
      )
    }

    // Verify branch belongs to restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    const shift = await db.shift.create({
      data: {
        restaurantId,
        branchId,
        name,
        startTime,
        endTime,
        color: color || '#3B82F6',
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: shift }, { status: 201 })
  } catch (error) {
    console.error('[SHIFTS_CREATE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}
