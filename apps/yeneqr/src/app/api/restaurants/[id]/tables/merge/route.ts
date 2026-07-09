// ============================================================
// Yene QR — Table Merge API (Gap 2.20)
// ============================================================
// POST /api/restaurants/[id]/tables/merge
// Combines two tables into one party. All order items from the
// secondary table's active order are transferred to the primary
// table's active order. The secondary table is then marked available.
//
// Body: {
//   primaryTableId: string,    // the table that will receive the items
//   secondaryTableId: string,  // the table being merged in (will be freed)
// }
//
// Use case: A large party arrives and occupies two adjacent tables.
// They want to order and pay together. Staff merges the tables so
// all items go to one order.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'table:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { primaryTableId, secondaryTableId } = body as {
      primaryTableId: string
      secondaryTableId: string
    }

    if (!primaryTableId || !secondaryTableId) {
      return NextResponse.json(
        { error: 'primaryTableId and secondaryTableId are required' },
        { status: 400 }
      )
    }

    if (primaryTableId === secondaryTableId) {
      return NextResponse.json(
        { error: 'Cannot merge a table with itself' },
        { status: 400 }
      )
    }

    // Fetch both tables
    const [primaryTable, secondaryTable] = await Promise.all([
      db.table.findFirst({
        where: { id: primaryTableId, branch: { restaurantId } },
        include: {
          orders: {
            where: { status: { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served'] } },
            include: { items: true },
          },
        },
      }),
      db.table.findFirst({
        where: { id: secondaryTableId, branch: { restaurantId } },
        include: {
          orders: {
            where: { status: { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served'] } },
            include: { items: true },
          },
        },
      }),
    ])

    if (!primaryTable) {
      return NextResponse.json({ error: 'Primary table not found' }, { status: 404 })
    }
    if (!secondaryTable) {
      return NextResponse.json({ error: 'Secondary table not found' }, { status: 404 })
    }

    // Verify both tables are in the same branch
    if (primaryTable.branchId !== secondaryTable.branchId) {
      return NextResponse.json(
        { error: 'Cannot merge tables from different branches' },
        { status: 400 }
      )
    }

    // Verify user has access to this branch
    const branchErr = verifyBranchAccess(auth, primaryTable.branchId, restaurantId)
    if (branchErr) return branchErr

    // Find active orders
    const primaryOrder = primaryTable.orders[0]
    const secondaryOrder = secondaryTable.orders[0]

    if (!secondaryOrder) {
      return NextResponse.json(
        { error: 'Secondary table has no active order to merge' },
        { status: 400 }
      )
    }

    if (!primaryOrder) {
      // If primary table has no active order, just reassign the secondary order to the primary table
      await db.order.update({
        where: { id: secondaryOrder.id },
        data: { tableId: primaryTableId },
      })

      // Free the secondary table
      await db.table.update({
        where: { id: secondaryTableId },
        data: { status: 'available' },
      })

      emitEvent({
        type: 'table_status_changed',
        restaurantId,
        branchId: primaryTable.branchId,
        tableId: secondaryTableId,
        fromStatus: 'occupied',
        toStatus: 'available',
      })

      return NextResponse.json({
        success: true,
        message: `Table ${secondaryTable.number} merged into Table ${primaryTable.number}. Order reassigned.`,
        mergedOrderId: secondaryOrder.id,
        itemsTransferred: secondaryOrder.items.length,
      })
    }

    // Both tables have active orders — transfer items from secondary to primary
    const itemsToTransfer = secondaryOrder.items

    if (itemsToTransfer.length === 0) {
      return NextResponse.json(
        { error: 'Secondary table has no items to transfer' },
        { status: 400 }
      )
    }

    // Transfer each item to the primary order
    await db.orderItem.updateMany({
      where: { orderId: secondaryOrder.id },
      data: { orderId: primaryOrder.id },
    })

    // Cancel the secondary order (it now has no items)
    await db.order.update({
      where: { id: secondaryOrder.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: `Merged into order ${primaryOrder.orderNumber} (table ${primaryTable.number})`,
      },
    })

    // Free the secondary table
    await db.table.update({
      where: { id: secondaryTableId },
      data: { status: 'available' },
    })

    // Emit events
    emitEvent({
      type: 'table_status_changed',
      restaurantId,
      branchId: primaryTable.branchId,
      tableId: secondaryTableId,
      fromStatus: 'occupied',
      toStatus: 'available',
    })

    emitEvent({
      type: 'order_status_changed',
      restaurantId,
      branchId: primaryTable.branchId,
      orderId: secondaryOrder.id,
      fromStatus: secondaryOrder.status,
      toStatus: 'cancelled',
    })

    return NextResponse.json({
      success: true,
      message: `Table ${secondaryTable.number} merged into Table ${primaryTable.number}. ${itemsToTransfer.length} item(s) transferred.`,
      mergedOrderId: primaryOrder.id,
      cancelledOrderId: secondaryOrder.id,
      itemsTransferred: itemsToTransfer.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[TABLE_MERGE]', error)
    return NextResponse.json({ error: 'Failed to merge tables' }, { status: 500 })
  }
}
