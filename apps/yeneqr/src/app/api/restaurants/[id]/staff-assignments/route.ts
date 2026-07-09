// ============================================================
// Yene QR — Staff Assignments API (GET, POST)
// ============================================================
// Manages table-to-waiter and station-to-kitchen_staff assignments.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/staff-assignments
 * List all staff assignments for a restaurant, optionally filtered by branch/role.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'staff:view', id)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    // Use resolveBranchScope so branch-scoped staff (waiter, kitchen_staff)
    // automatically get their auth.branchId — they cannot omit it to see all
    // branches' assignments.
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const role = searchParams.get('role') || undefined

    const where: Record<string, unknown> = {
      branch: { restaurantId: id },
      isActive: true,
    }
    if (branchId) where.branchId = branchId
    if (role) where.role = role

    const assignments = await db.staffAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        branch: { select: { id: true, name: true } },
        kitchenStation: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Enrich with table info for waiters
    const enriched = assignments.map((a) => {
      const result: Record<string, unknown> = { ...a }
      if (a.role === 'waiter' && a.assignedTables) {
        try {
          const tableIds: string[] = JSON.parse(a.assignedTables)
          result.assignedTableIds = tableIds
        } catch {
          result.assignedTableIds = []
        }
      } else {
        result.assignedTableIds = []
      }
      return result
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STAFF_ASSIGNMENTS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch staff assignments' }, { status: 500 })
  }
}

/**
 * POST /api/restaurants/[id]/staff-assignments
 * Create or update a staff assignment.
 * Body: { userId, branchId, role, stationId?, assignedTables? }
 * If an active assignment already exists for this user+branch+role, it updates it instead.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'staff:manage', id)
    if (permErr) return permErr

    const body = await request.json()
    const { userId, branchId, role, stationId, assignedTables } = body

    if (!userId || !branchId || !role) {
      return NextResponse.json({ error: 'userId, branchId, and role are required' }, { status: 400 })
    }

    if (!['waiter', 'kitchen_staff'].includes(role)) {
      return NextResponse.json({ error: 'Role must be "waiter" or "kitchen_staff"' }, { status: 400 })
    }

    // Verify the user belongs to this restaurant
    const user = await db.restaurantUser.findFirst({
      where: { id: userId, restaurantId: id },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found in this restaurant' }, { status: 404 })
    }

    // Verify the branch belongs to this restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId: id },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found in this restaurant' }, { status: 404 })
    }

    const data: Record<string, unknown> = {
      userId,
      branchId,
      restaurantId: id,
      role,
      isActive: true,
    }

    if (role === 'kitchen_staff' && stationId) {
      // Verify station exists
      const station = await db.kitchenStation.findFirst({
        where: { id: stationId, branchId },
      })
      if (!station) {
        return NextResponse.json({ error: 'Kitchen station not found in this branch' }, { status: 404 })
      }
      data.stationId = stationId
    }

    if (role === 'waiter' && assignedTables) {
      // Validate table IDs
      if (!Array.isArray(assignedTables)) {
        return NextResponse.json({ error: 'assignedTables must be an array of table IDs' }, { status: 400 })
      }
      // Verify tables exist in this branch
      const tables = await db.table.findMany({
        where: { id: { in: assignedTables }, branchId },
      })
      if (tables.length !== assignedTables.length) {
        return NextResponse.json({ error: 'Some table IDs are invalid or not in this branch' }, { status: 400 })
      }
      data.assignedTables = JSON.stringify(assignedTables)
    }

    // Upsert: if active assignment exists for this user+branch+role, update it
    const existing = await db.staffAssignment.findFirst({
      where: { userId, branchId, role, isActive: true },
    })

    let assignment
    if (existing) {
      assignment = await db.staffAssignment.update({
        where: { id: existing.id },
        data,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          branch: { select: { id: true, name: true } },
          kitchenStation: { select: { id: true, name: true, type: true } },
        },
      })
    } else {
      assignment = await db.staffAssignment.create({
        data,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          branch: { select: { id: true, name: true } },
          kitchenStation: { select: { id: true, name: true, type: true } },
        },
      })
    }

    return NextResponse.json({ data: assignment })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STAFF_ASSIGNMENTS_POST]', error)
    return NextResponse.json({ error: 'Failed to create/update staff assignment' }, { status: 500 })
  }
}
