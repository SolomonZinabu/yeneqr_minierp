// ============================================================
// Yene QR — Delivery Addresses API (Phase 3.1)
// ============================================================
// GET  /api/restaurants/[id]/delivery/addresses — list addresses (optionally by customer)
// POST /api/restaurants/[id]/delivery/addresses — save a delivery address
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, getAuthContext } from '@/lib/api-auth'

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

    const { searchParams } = new URL(request.url)
    const requestedCustomerId = searchParams.get('customerId')

    const where: Record<string, unknown> = { restaurantId }
    // Security: customers can only see their own addresses
    if (auth.type === 'customer') {
      where.customerId = auth.userId  // customer's session ID acts as their customer ID
    } else if (requestedCustomerId) {
      where.customerId = requestedCustomerId
    }

    const addresses = await db.deliveryAddress.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: addresses })
  } catch (error) {
    console.error('[DELIVERY_ADDRESSES_LIST]', error)
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 })
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

    const body = await request.json()
    const { customerId, label, fullName, phone, addressLine1, addressLine2, city, region, latitude, longitude, deliveryInstructions } = body

    if (!fullName || !phone || !addressLine1 || !city) {
      return NextResponse.json({ error: 'fullName, phone, addressLine1, and city are required' }, { status: 400 })
    }

    const address = await db.deliveryAddress.create({
      data: {
        restaurantId,
        customerId: customerId || null,
        label: label || null,
        fullName,
        phone,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        region: region || null,
        latitude: latitude || null,
        longitude: longitude || null,
        deliveryInstructions: deliveryInstructions || null,
      },
    })

    return NextResponse.json({ data: address }, { status: 201 })
  } catch (error) {
    console.error('[DELIVERY_ADDRESS_CREATE]', error)
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500 })
  }
}
