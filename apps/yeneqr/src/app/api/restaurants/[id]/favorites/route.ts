// ============================================================
// Yene QR — Customer Favorites API
// GET    /api/restaurants/[id]/favorites  — List customer's favorites
// POST   /api/restaurants/[id]/favorites  — Add item to favorites
// DELETE /api/restaurants/[id]/favorites  — Remove item from favorites
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'

/**
 * Helper: resolve a Customer record from the request's session token.
 * If no customer exists yet, returns null (for GET) or creates one (for mutations).
 */
async function resolveCustomer(request: NextRequest, restaurantId: string, createIfMissing = false) {
  const auth = getAuthContext(request)
  if (!auth) return null
  // Verify the token belongs to this restaurant
  if (auth.restaurantId !== restaurantId) return null

  // Look up session by token → get customer
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return null

  const session = await db.customerSession.findUnique({
    where: { token },
    include: { customer: true },
  })

  // Double-check session belongs to this restaurant
  if (session && session.restaurantId !== restaurantId) return null

  if (session?.customer) {
    return session.customer
  }

  // If no customer linked to session yet and we're doing a mutation, create one
  if (createIfMissing && session) {
    const customer = await db.customer.create({
      data: {
        restaurantId: session.restaurantId,
        language: session.language || 'en',
      },
    })

    // Link the customer to the session
    await db.customerSession.update({
      where: { id: session.id },
      data: { customerId: customer.id },
    })

    return customer
  }

  return null
}

/**
 * GET /api/restaurants/[id]/favorites
 * Returns the list of menuItemIds the customer has favorited.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const customer = await resolveCustomer(request, restaurantId)

    if (!customer) {
      // Not authenticated or no customer record yet — return empty list
      return NextResponse.json({ data: { favorites: [] } })
    }

    const favorites = await db.customerFavorite.findMany({
      where: {
        customerId: customer.id,
        menuItem: { restaurantId },
      },
      select: {
        id: true,
        menuItemId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      data: {
        favorites: favorites.map((f) => ({
          id: f.id,
          menuItemId: f.menuItemId,
          createdAt: f.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('[FAVORITES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/favorites
 * Add a menu item to the customer's favorites.
 * Body: { menuItemId }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // Rate limit: prevent favorite spam
    const clientIp = getClientIp(request)
    const rl = checkRateLimit(`customerFavorite:${clientIp}`, RATE_LIMITS.customerFavorite)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    }

    const customer = await resolveCustomer(request, restaurantId, true)

    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { menuItemId } = body as { menuItemId?: string }

    if (!menuItemId) {
      return NextResponse.json(
        { error: 'menuItemId is required' },
        { status: 400 }
      )
    }

    // Verify the menu item belongs to this restaurant
    const menuItem = await db.menuItem.findFirst({
      where: { id: menuItemId, restaurantId },
    })

    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      )
    }

    // Use upsert to avoid duplicate errors on the @@unique constraint
    const favorite = await db.customerFavorite.upsert({
      where: {
        customerId_menuItemId: {
          customerId: customer.id,
          menuItemId,
        },
      },
      update: {},
      create: {
        customerId: customer.id,
        menuItemId,
        restaurantId,
      },
    })

    return NextResponse.json({
      data: {
        id: favorite.id,
        menuItemId: favorite.menuItemId,
        createdAt: favorite.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[FAVORITES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to add favorite' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/favorites
 * Remove a menu item from the customer's favorites.
 * Body: { menuItemId }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const customer = await resolveCustomer(request, restaurantId)

    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { menuItemId } = body as { menuItemId?: string }

    if (!menuItemId) {
      return NextResponse.json(
        { error: 'menuItemId is required' },
        { status: 400 }
      )
    }

    const deleted = await db.customerFavorite.deleteMany({
      where: {
        customerId: customer.id,
        menuItemId,
      },
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Favorite not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: { removed: true, menuItemId },
    })
  } catch (error) {
    console.error('[FAVORITES_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to remove favorite' },
      { status: 500 }
    )
  }
}
