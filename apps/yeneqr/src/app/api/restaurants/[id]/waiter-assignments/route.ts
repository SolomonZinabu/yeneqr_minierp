// ============================================================
// Yene QR — Waiter Auto-Assignment & Rebalance API
// GET    /api/restaurants/[id]/waiter-assignments — Get waiter workloads
// POST   /api/restaurants/[id]/waiter-assignments — Auto-assign unassigned tables
// PATCH  /api/restaurants/[id]/waiter-assignments — Rebalance all tables evenly
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import {
  getWaiterWorkloads,
  autoAssignTables,
  rebalanceTables,
  type WaiterWorkload,
  type RebalanceResult,
} from '@/lib/waiter-assignment'

/**
 * GET /api/restaurants/[id]/waiter-assignments
 * Get workload data for all active waiters in a branch.
 * Query params: branchId (required)
 */
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

    // Require staff:view permission (workload data exposes staff assignments)
    const permErr = requirePerm(auth, 'staff:view', restaurantId)
    if (permErr) return permErr

    const url = new URL(request.url)
    const branchId = url.searchParams.get('branchId')

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId query parameter is required' },
        { status: 400 }
      )
    }

    // Verify branch belongs to restaurant
    const { db } = await import('@/lib/db')
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Verify branch access — branch-scoped staff can only see their branch's workloads
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    const workloads = await getWaiterWorkloads(restaurantId, branchId)

    // Also get tables with no assignments for context
    const tables = await db.table.findMany({
      where: { branchId, status: { not: 'disabled' } },
      select: { id: true, number: true },
      orderBy: { number: 'asc' },
    })

    const allAssignedTableIds = new Set<string>()
    for (const w of workloads) {
      for (const tableId of w.assignedTableIds) {
        allAssignedTableIds.add(tableId)
      }
    }

    const unassignedTables = tables.filter(t => !allAssignedTableIds.has(t.id))

    return NextResponse.json({
      data: {
        waiters: workloads,
        unassignedTables: unassignedTables.map(t => ({ id: t.id, number: t.number })),
        totalTables: tables.length,
        assignedTables: allAssignedTableIds.size,
        source: workloads.some(w => w.entryId) ? 'shift' : 'staff_assignment',
      },
    })
  } catch (error) {
    console.error('[WAITER_WORKLOADS_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch waiter workloads' }, { status: 500 })
  }
}

/**
 * POST /api/restaurants/[id]/waiter-assignments
 * Auto-assign all unassigned tables to the least-busy waiters.
 * Body: { branchId: string }
 */
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

    // Require staff:manage permission (auto-assign modifies staff assignments)
    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { branchId } = body

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }

    // Verify branch belongs to restaurant
    const { db } = await import('@/lib/db')
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Verify branch access
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    const results = await autoAssignTables(restaurantId, branchId)

    return NextResponse.json({
      data: {
        assignmentsMade: results.length,
        changes: results,
      },
    })
  } catch (error) {
    console.error('[WAITER_AUTO_ASSIGN_ERROR]', error)
    return NextResponse.json({ error: 'Failed to auto-assign tables' }, { status: 500 })
  }
}

/**
 * PATCH /api/restaurants/[id]/waiter-assignments
 * Rebalance all table assignments evenly across active waiters.
 * Body: { branchId: string }
 */
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

    // Require staff:manage permission (rebalance modifies staff assignments)
    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { branchId } = body

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }

    // Verify branch belongs to restaurant
    const { db } = await import('@/lib/db')
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Verify branch access
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    const results = await rebalanceTables(restaurantId, branchId)

    return NextResponse.json({
      data: {
        waitersAffected: results.length,
        changes: results,
      },
    })
  } catch (error) {
    console.error('[WAITER_REBALANCE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to rebalance tables' }, { status: 500 })
  }
}
