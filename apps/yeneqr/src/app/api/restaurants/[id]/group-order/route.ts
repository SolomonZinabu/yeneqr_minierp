// Phase 5.3 — Social / Group Ordering
// POST /api/restaurants/[id]/group-order — create a group order session
// GET /api/restaurants/[id]/group-order?code=XXX — get group order by code
// Allows multiple people to add items to a shared order via a link
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'
import { emitEvent } from '@/lib/realtime'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    // Find order by group order code (stored in order's specialInstructions or a metadata field)
    // We use the order number as the group code
    const order = await db.order.findFirst({
      where: { restaurantId, orderNumber: code },
      include: {
        items: {
          select: { id: true, name: true, quantity: true, priceCents: true, specialInstructions: true },
        },
        table: { select: { number: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Group order not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        tableNumber: order.table?.number,
        items: order.items,
        totalCents: order.totalAmountCents,
        isGroupOrder: true,
      },
    })
  } catch (error) {
    console.error('[GROUP_ORDER_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch group order' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { branchId, tableId, creatorName } = body

    if (!branchId || !tableId) {
      return NextResponse.json({ error: 'branchId and tableId are required' }, { status: 400 })
    }

    // Generate a short group code (6 chars)
    const groupCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const orderNumber = `GRP-${groupCode}`

    // Create the group order (pending, no items yet)
    const order = await db.order.create({
      data: {
        restaurantId,
        branchId,
        tableId,
        orderNumber,
        type: 'dine_in',
        status: 'pending',
        subtotalCents: 0,
        taxAmountCents: 0,
        totalAmountCents: 0,
        specialInstructions: `Group order created by ${creatorName || 'Guest'}. Share code: ${groupCode}`,
      },
    })

    return NextResponse.json({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        groupCode,
        shareUrl: `/menu/${groupCode}`,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[GROUP_ORDER_CREATE]', error)
    return NextResponse.json({ error: 'Failed to create group order' }, { status: 500 })
  }
}
