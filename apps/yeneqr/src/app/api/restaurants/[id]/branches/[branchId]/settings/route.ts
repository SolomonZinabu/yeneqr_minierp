// ============================================================
// Yene QR — Branch Settings API
// Phase 6.3: implements the Toast/Square/Lightspeed "layered settings" pattern.
// ============================================================
// GET  /api/restaurants/[id]/branches/[branchId]/settings
//   Returns the branch's settings override row (or null if none exists,
//   meaning 'inherit all from restaurant').
//
// PUT  /api/restaurants/[id]/branches/[branchId]/settings
//   Upserts the branch settings override. Pass null for any field to
//   'inherit from restaurant' (clears the override).
//   Body: { workingHours?, taxRate?, serviceCharge?, acceptedPaymentMethods?,
//           orderTypes?, posPrinterId?, orderRouting? }
//     orderRouting: 'waiter_first' | 'direct_to_kitchen' | null (inherit)
//
// DELETE /api/restaurants/[id]/branches/[branchId]/settings
//   Removes the entire branch settings row (revert to full inheritance).
//
// Resolution rule (consumed by the frontend):
//   effectiveValue = branchSettings.field ?? restaurantSettings.field ?? defaultValue
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: restaurantId, branchId } = await params
    const auth = requireAuth(request)

    // Staff with table:view can read settings; restaurant scope is checked
    const permErr = requirePerm(auth, 'table:view', restaurantId)
    if (permErr) return permErr

    // Verify the user has access to this branch
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    // Verify the branch belongs to this restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId },
      select: { id: true, name: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    const settings = await db.branchSettings.findUnique({
      where: { branchId },
    })

    return NextResponse.json({
      data: settings,
      branch: { id: branch.id, name: branch.name },
      // Hint: when data is null, all fields inherit from restaurant settings
      inheritsAll: settings === null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_SETTINGS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch branch settings' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: restaurantId, branchId } = await params
    const auth = requireAuth(request)

    // Only managers/owners can change settings
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    // Verify the user has access to this branch
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    // Verify the branch belongs to this restaurant
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId },
      select: { id: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      workingHours,
      taxRate,
      serviceCharge,
      acceptedPaymentMethods,
      orderTypes,
      posPrinterId,
      orderRouting,
    } = body as {
      workingHours?: string | null
      taxRate?: number | null
      serviceCharge?: number | null
      acceptedPaymentMethods?: string | null
      orderTypes?: string | null
      posPrinterId?: string | null
      orderRouting?: string | null
    }

    // Validate orderRouting if provided (null = inherit)
    const VALID_ROUTING_MODES = new Set(['waiter_first', 'direct_to_kitchen'])
    if (orderRouting !== null && orderRouting !== undefined) {
      if (typeof orderRouting !== 'string' || !VALID_ROUTING_MODES.has(orderRouting)) {
        return NextResponse.json(
          { error: "orderRouting must be 'waiter_first', 'direct_to_kitchen', or null" },
          { status: 400 }
        )
      }
    }

    // Validate numeric fields if provided (null = inherit)
    if (taxRate !== null && taxRate !== undefined) {
      if (typeof taxRate !== 'number' || taxRate < 0) {
        return NextResponse.json({ error: 'taxRate must be a non-negative number or null' }, { status: 400 })
      }
    }
    if (serviceCharge !== null && serviceCharge !== undefined) {
      if (typeof serviceCharge !== 'number' || serviceCharge < 0) {
        return NextResponse.json({ error: 'serviceCharge must be a non-negative number or null' }, { status: 400 })
      }
    }

    // Upsert the branch settings row
    const settings = await db.branchSettings.upsert({
      where: { branchId },
      update: {
        ...(workingHours !== undefined ? { workingHours: workingHours || null } : {}),
        ...(taxRate !== undefined ? { taxRate: taxRate ?? null } : {}),
        ...(serviceCharge !== undefined ? { serviceCharge: serviceCharge ?? null } : {}),
        ...(acceptedPaymentMethods !== undefined ? { acceptedPaymentMethods: acceptedPaymentMethods || null } : {}),
        ...(orderTypes !== undefined ? { orderTypes: orderTypes || null } : {}),
        ...(posPrinterId !== undefined ? { posPrinterId: posPrinterId || null } : {}),
        ...(orderRouting !== undefined ? { orderRouting: orderRouting ?? null } : {}),
      },
      create: {
        branchId,
        workingHours: workingHours || null,
        taxRate: taxRate ?? null,
        serviceCharge: serviceCharge ?? null,
        acceptedPaymentMethods: acceptedPaymentMethods || null,
        orderTypes: orderTypes || null,
        posPrinterId: posPrinterId || null,
        orderRouting: orderRouting ?? null,
      },
    })

    return NextResponse.json({ data: settings })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_SETTINGS_PUT]', error)
    return NextResponse.json({ error: 'Failed to save branch settings' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: restaurantId, branchId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    await db.branchSettings.deleteMany({
      where: { branchId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BRANCH_SETTINGS_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete branch settings' }, { status: 500 })
  }
}
