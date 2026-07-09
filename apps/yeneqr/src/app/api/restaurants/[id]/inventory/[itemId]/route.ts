// ============================================================
// Yene QR — Inventory Item API (Update, Delete)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { handleInventoryStockChange } from '@/lib/inventory-watchdog'

/**
 * PUT /api/restaurants/[id]/inventory/[itemId]
 * Update an inventory item (edit details or restock).
 * Body: { name?, unit?, currentStock?, minimumStock?, costPerUnit?, supplier?, restockAmount?, isActive? }
 *
 * If restockAmount is provided, it adds to currentStock instead of replacing it.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const {
      name,
      unit,
      currentStock,
      minimumStock,
      costPerUnit,
      supplier,
      restockAmount,
      isActive,
    } = body as {
      name?: string
      unit?: string
      currentStock?: number
      minimumStock?: number
      costPerUnit?: number
      supplier?: string
      restockAmount?: number
      isActive?: boolean
    }

    // Verify item exists and belongs to this restaurant
    const existing = await db.inventoryItem.findUnique({
      where: { id: itemId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    if (existing.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify branch access — branch-scoped staff can only manage inventory at their branch
    if (existing.branchId) {
      const branchErr = verifyBranchAccess(auth, existing.branchId, restaurantId)
      if (branchErr) return branchErr
    }

    // If renaming, check for duplicate name within the same branch
    if (name && name.trim() !== existing.name) {
      const duplicate = await db.inventoryItem.findUnique({
        where: {
          restaurantId_branchId_name: { restaurantId, branchId: existing.branchId, name: name.trim() },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'An inventory item with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name.trim()
    if (unit !== undefined) updateData.unit = unit
    if (minimumStock !== undefined) updateData.minimumStock = minimumStock
    if (costPerUnit !== undefined) updateData.costPerUnit = costPerUnit
    if (supplier !== undefined) updateData.supplier = supplier || null
    if (isActive !== undefined) updateData.isActive = isActive

    // Handle restock: add to current stock
    if (restockAmount !== undefined && restockAmount > 0) {
      updateData.currentStock = existing.currentStock + restockAmount
      updateData.lastRestocked = new Date()
    } else if (currentStock !== undefined) {
      // Direct stock update
      updateData.currentStock = currentStock
      if (currentStock > existing.currentStock) {
        updateData.lastRestocked = new Date()
      }
    }

    const item = await db.inventoryItem.update({
      where: { id: itemId },
      data: updateData,
    })

    // Propagate stock changes to ingredients → menu items
    if (updateData.currentStock !== undefined) {
      const previousStock = existing.currentStock
      const newStock = item.currentStock
      const changes = await handleInventoryStockChange(
        restaurantId,
        itemId,
        previousStock,
        newStock
      )
      if (changes.length > 0) {
        return NextResponse.json({
          data: item,
          availabilityChanges: changes,
        })
      }
    }

    return NextResponse.json({ data: item })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVENTORY_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update inventory item' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/inventory/[itemId]
 * Soft-delete (set isActive=false) or hard-delete an inventory item.
 * Query params: hard=true for permanent deletion
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    // Verify item exists and belongs to this restaurant
    const existing = await db.inventoryItem.findUnique({
      where: { id: itemId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    if (existing.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify branch access — branch-scoped staff can only manage inventory at their branch
    if (existing.branchId) {
      const branchErr = verifyBranchAccess(auth, existing.branchId, restaurantId)
      if (branchErr) return branchErr
    }

    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    if (hardDelete) {
      await db.inventoryItem.delete({ where: { id: itemId } })
    } else {
      await db.inventoryItem.update({
        where: { id: itemId },
        data: { isActive: false },
      })
    }

    return NextResponse.json({
      data: { id: itemId, deleted: hardDelete ? 'permanent' : 'soft' },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INVENTORY_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete inventory item' },
      { status: 500 }
    )
  }
}
