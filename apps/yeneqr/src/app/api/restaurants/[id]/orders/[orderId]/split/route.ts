// ============================================================
// Yene QR — Bill Split API
// POST: Create a bill split for an order
// GET: Get bill splits for an order
// PATCH: Update a split (e.g., mark a portion as paid manually)
// DELETE: Remove a split
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { updateBillSplitAfterPayment, areAllSplitsPaid, parseSplitData } from '@/lib/bill-split'
import { emitEvent } from '@/lib/realtime'
import { recordPlatformFee } from '@/lib/platform-fee'

interface SplitEntry {
  name: string
  items?: string[] // OrderItem IDs assigned to this person
  percentage?: number
  amount?: number
}

/**
 * GET /api/restaurants/[id]/orders/[orderId]/split
 * Get bill splits for an order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id: restaurantId, orderId } = await params
    const auth = requireAuth(request)

    // Require order:view permission + restaurant scope
    const permErr = requirePerm(auth, 'order:view', restaurantId)
    if (permErr) return permErr

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        billSplits: {
          include: {
            payments: {
              select: { id: true, amountCents: true, status: true, method: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        items: {
          select: {
            id: true,
            name: true,
            priceCents: true,
            quantity: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify branch access
    if (auth.type !== 'customer') {
      const branchErr = verifyBranchAccess(auth, order.branchId, restaurantId)
      if (branchErr) return branchErr
    }

    return NextResponse.json({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmountCents: order.totalAmountCents,
        items: order.items,
        billSplits: order.billSplits,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BILL_SPLIT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch bill splits' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/orders/[orderId]/split
 * Create a bill split for an order
 * Body: { splitType: 'equal'|'items'|'custom'|'percentage', splits: SplitEntry[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id: restaurantId, orderId } = await params
    const auth = requireAuth(request)

    // Require order:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'order:manage', restaurantId)
    if (permErr) return permErr

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: {
          select: {
            id: true,
            name: true,
            priceCents: true,
            quantity: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify branch access
    if (auth.type !== 'customer') {
      const branchErr = verifyBranchAccess(auth, order.branchId, restaurantId)
      if (branchErr) return branchErr
    }

    const body = await request.json()
    const { splitType, splits } = body as {
      splitType: 'equal' | 'items' | 'custom' | 'percentage'
      splits: SplitEntry[]
    }

    if (!splitType || !splits || !Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json(
        { error: 'splitType and splits array are required' },
        { status: 400 }
      )
    }

    const totalAmountCents = order.totalAmountCents

    // Calculate per-split amounts (in cents)
    let splitData: {
      name: string
      amountCents: number
      items?: string[]
      percentage?: number
    }[] = []

    switch (splitType) {
      case 'equal': {
        const perPersonCents = Math.round(totalAmountCents / splits.length)
        splitData = splits.map((s) => ({
          name: s.name,
          amountCents: perPersonCents,
        }))
        break
      }

      case 'items': {
        // Each split has a list of orderItem IDs
        const itemPriceMap = new Map<string, number>()
        for (const item of order.items) {
          // Distribute item price proportionally (priceCents * quantity)
          itemPriceMap.set(item.id, item.priceCents * item.quantity)
        }

        const itemTotalCents = order.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
        const taxRatio = order.taxAmountCents / (itemTotalCents || 1)
        const serviceRatio = order.serviceChargeCents / (itemTotalCents || 1)

        splitData = splits.map((s) => {
          const assignedItems = s.items || []
          const itemsSubtotalCents = assignedItems.reduce((sum, itemId) => {
            return sum + (itemPriceMap.get(itemId) || 0)
          }, 0)
          const itemsTaxCents = Math.round(itemsSubtotalCents * taxRatio)
          const itemsServiceCents = Math.round(itemsSubtotalCents * serviceRatio)
          const totalForPersonCents = Math.max(0, itemsSubtotalCents + itemsTaxCents + itemsServiceCents - Math.round(order.discountAmountCents / splits.length))

          return {
            name: s.name,
            amountCents: totalForPersonCents,
            items: assignedItems,
          }
        })
        break
      }

      case 'custom': {
        splitData = splits.map((s) => ({
          name: s.name,
          amountCents: s.amount || 0,
        }))

        // Validate total
        const customTotalCents = splitData.reduce((sum, s) => sum + s.amountCents, 0)
        if (Math.abs(customTotalCents - totalAmountCents) > 1) {
          return NextResponse.json(
            { error: `Custom amounts sum (${customTotalCents} cents) does not match order total (${totalAmountCents} cents)` },
            { status: 400 }
          )
        }
        break
      }

      case 'percentage': {
        splitData = splits.map((s) => ({
          name: s.name,
          amountCents: Math.round(totalAmountCents * (s.percentage || 0) / 100),
          percentage: s.percentage,
        }))

        // Validate total percentage
        const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0)
        if (Math.abs(totalPercentage - 100) > 1) {
          return NextResponse.json(
            { error: `Percentages must sum to 100% (got ${totalPercentage}%)` },
            { status: 400 }
          )
        }
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid split type' }, { status: 400 })
    }

    // Create the bill split record
    const billSplit = await db.billSplit.create({
      data: {
        orderId,
        restaurantId,
        splitType,
        totalAmountCents,
        paidAmountCents: 0,
        status: 'pending',
        splitData: JSON.stringify(splitData),
      },
    })

    return NextResponse.json({ data: billSplit }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BILL_SPLIT_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create bill split' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/restaurants/[id]/orders/[orderId]/split
 * Update a bill split (e.g., mark a split portion as paid manually).
 * Body: { billSplitId, splitIndex, paid: true }
 *
 * This lets staff manually mark a split portion as paid (e.g., when
 * a customer pays cash to the waiter). If there's an existing pending
 * payment linked to this split, it will be marked as completed.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id: restaurantId, orderId } = await params
    const auth = requireAuth(request)

    // Require order:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'order:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { billSplitId, splitIndex, paid } = body as {
      billSplitId: string
      splitIndex: number
      paid: boolean
    }

    if (!billSplitId || splitIndex === undefined || paid === undefined) {
      return NextResponse.json(
        { error: 'billSplitId, splitIndex, and paid are required' },
        { status: 400 }
      )
    }

    // Verify the bill split exists and belongs to this order
    const billSplit = await db.billSplit.findUnique({
      where: { id: billSplitId },
      include: {
        payments: true,
      },
    })

    if (!billSplit) {
      return NextResponse.json(
        { error: 'Bill split not found' },
        { status: 404 }
      )
    }

    if (billSplit.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Bill split does not belong to this order' },
        { status: 400 }
      )
    }

    if (billSplit.restaurantId !== restaurantId) {
      return NextResponse.json(
        { error: 'Bill split does not belong to this restaurant' },
        { status: 400 }
      )
    }

    if (billSplit.status === 'paid') {
      return NextResponse.json(
        { error: 'Bill split is already fully paid' },
        { status: 400 }
      )
    }

    // Validate splitIndex
    const splitData = parseSplitData(billSplit.splitData)
    const splitEntry = splitData[splitIndex]

    if (!splitEntry) {
      return NextResponse.json(
        { error: `Invalid split index ${splitIndex}. Split has ${splitData.length} portions.` },
        { status: 400 }
      )
    }

    if (!paid) {
      // Currently only supporting marking as paid (not un-marking)
      return NextResponse.json(
        { error: 'Only paid=true is supported' },
        { status: 400 }
      )
    }

    const splitAmountCents = splitEntry.amountCents

    // Check if there's an existing pending payment for this split
    const pendingPayment = billSplit.payments.find(
      (p) => p.status === 'pending' || p.status === 'processing'
    )

    if (pendingPayment) {
      // Mark the existing pending payment as completed
      await db.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'completed',
          paidAt: new Date(),
        },
      })

      // Record platform fee (idempotent — computes fee on net revenue)
      await recordPlatformFee({
        restaurantId,
        paymentId: pendingPayment.id,
        orderId,
        branchId: pendingPayment.branchId,
        amountCents: pendingPayment.amountCents,
        tipAmountCents: pendingPayment.tipAmountCents,
      })

      console.info('[BILL_SPLIT_PATCH_PAYMENT_COMPLETED]', {
        billSplitId,
        paymentId: pendingPayment.id,
        amountCents: pendingPayment.amountCents,
      })
    } else {
      // Create a new cash payment record marked as completed
      // (staff manually confirmed cash received)
      const newPayment = await db.payment.create({
        data: {
          orderId,
          restaurantId,
          branchId: (await db.order.findUnique({ where: { id: orderId } }))?.branchId || '',
          billSplitId,
          amountCents: splitAmountCents,
          tipAmountCents: 0,
          method: 'cash',
          provider: 'cash',
          status: 'completed',
          reference: `CASH-SPLIT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          paidAt: new Date(),
        },
      })

      // Record platform fee for the new cash payment
      await recordPlatformFee({
        restaurantId,
        paymentId: newPayment.id,
        orderId,
        branchId: newPayment.branchId,
        amountCents: newPayment.amountCents,
        tipAmountCents: 0,
      })

      console.info('[BILL_SPLIT_PATCH_CASH_PAYMENT_CREATED]', {
        billSplitId,
        splitIndex,
        amountCents: splitAmountCents,
        paymentId: newPayment.id,
      })
    }

    // Update BillSplit paidAmountCents and status
    const { fullyPaid } = await updateBillSplitAfterPayment(billSplitId, splitAmountCents)

    // Emit real-time event
    emitEvent({
      type: 'payment_received',
      restaurantId,
      orderId,
      amountCents: splitAmountCents,
      method: 'cash',
    })

    // If all splits are paid, complete the order
    if (fullyPaid) {
      const allSplitsPaid = await areAllSplitsPaid(orderId)
      if (allSplitsPaid) {
        await db.order.updateMany({
          where: {
            id: orderId,
            status: { not: 'completed' },
          },
          data: {
            status: 'completed',
            completedAt: new Date(),
            paidAt: new Date(),
          },
        })

        console.info('[BILL_SPLIT_PATCH_ORDER_COMPLETED]', { orderId, billSplitId })
      }
    }

    // Fetch updated bill split to return
    const updatedBillSplit = await db.billSplit.findUnique({
      where: { id: billSplitId },
      include: {
        payments: {
          select: { id: true, amountCents: true, status: true, method: true },
        },
      },
    })

    return NextResponse.json({
      data: {
        billSplit: updatedBillSplit,
        splitIndex,
        paid: true,
        fullyPaid,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BILL_SPLIT_PATCH]', error)
    return NextResponse.json(
      { error: 'Failed to update bill split' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/orders/[orderId]/split
 * Remove a bill split.
 * Body: { billSplitId }
 *
 * Only allows deletion if the split has not been partially or fully paid.
 * Any pending payments linked to this split will also be removed.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id: restaurantId, orderId } = await params
    const auth = requireAuth(request)

    // Require order:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'order:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { billSplitId } = body as {
      billSplitId: string
    }

    if (!billSplitId) {
      return NextResponse.json(
        { error: 'billSplitId is required' },
        { status: 400 }
      )
    }

    // Verify the bill split exists and belongs to this order
    const billSplit = await db.billSplit.findUnique({
      where: { id: billSplitId },
      include: {
        payments: true,
      },
    })

    if (!billSplit) {
      return NextResponse.json(
        { error: 'Bill split not found' },
        { status: 404 }
      )
    }

    if (billSplit.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Bill split does not belong to this order' },
        { status: 400 }
      )
    }

    if (billSplit.restaurantId !== restaurantId) {
      return NextResponse.json(
        { error: 'Bill split does not belong to this restaurant' },
        { status: 400 }
      )
    }

    // Don't allow deletion if the split has been partially or fully paid
    if (billSplit.paidAmountCents > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a bill split that has been partially or fully paid. Consider voiding the payments first.' },
        { status: 400 }
      )
    }

    // Delete any pending payments linked to this split
    // (billSplitId on Payment uses onDelete: SetNull, but we should clean up)
    const pendingPayments = billSplit.payments.filter(
      (p) => p.status === 'pending' || p.status === 'processing'
    )

    if (pendingPayments.length > 0) {
      await db.payment.deleteMany({
        where: {
          id: { in: pendingPayments.map((p) => p.id) },
        },
      })

      console.info('[BILL_SPLIT_DELETE_PENDING_PAYMENTS]', {
        billSplitId,
        deletedCount: pendingPayments.length,
      })
    }

    // Delete the bill split
    await db.billSplit.delete({
      where: { id: billSplitId },
    })

    console.info('[BILL_SPLIT_DELETED]', {
      billSplitId,
      orderId,
      restaurantId,
    })

    return NextResponse.json({
      data: {
        deleted: true,
        billSplitId,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BILL_SPLIT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete bill split' },
      { status: 500 }
    )
  }
}
