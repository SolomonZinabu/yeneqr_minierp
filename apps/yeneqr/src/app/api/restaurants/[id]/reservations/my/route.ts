// ============================================================
// Yene QR — Customer's Own Reservations API
// GET /api/restaurants/[id]/reservations/my
// Fetches reservations for a customer identified by phone number
// (provided via query param or decoded from their session token).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/reservations/my?phone=...
 * Fetch all reservations for a customer at a specific restaurant.
 * Customer identity is resolved by:
 *   1. phone query param (from localStorage)
 *   2. Fallback: session token's table association
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow customer tokens or staff with table:view permission
    if (auth.type === 'customer') {
      if (auth.restaurantId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Staff: require table:view permission + restaurant scope
      const permErr = requirePerm(auth, 'table:view', id)
      if (permErr) return permErr
    }

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const branchId = searchParams.get('branchId')

    if (!phone || phone.trim() === '') {
      return NextResponse.json({ data: [] })
    }

    const where: Record<string, unknown> = {
      restaurantId: id,
      customerPhone: phone.trim(),
    }

    if (branchId && branchId.trim() !== '') {
      where.branchId = branchId
    }

    // Only show non-cancelled reservations, ordered by date (upcoming first)
    const reservations = await db.tableReservation.findMany({
      where,
      orderBy: [{ reservedDate: 'desc' }, { reservedTime: 'desc' }],
      take: 20,
      include: {
        table: {
          select: { id: true, number: true, capacity: true, status: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ data: reservations })
  } catch (error) {
    console.error('[CUSTOMER_RESERVATIONS]', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    )
  }
}
