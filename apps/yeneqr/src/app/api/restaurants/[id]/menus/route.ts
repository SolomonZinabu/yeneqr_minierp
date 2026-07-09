import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/menus — List all menus for a restaurant
// Auth: staff with menu:view, OR customer with valid session for this restaurant
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

    // Customers scanning QR codes can view menus for their restaurant
    if (auth.type === 'customer') {
      if (auth.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const permErr = requirePerm(auth, 'menu:view', restaurantId)
      if (permErr) return permErr
    }

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const menus = await db.menu.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { categories: true, qrCodes: true },
        },
      },
    })

    return NextResponse.json({ menus })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[MENUS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch menus' },
      { status: 500 }
    )
  }
}

// POST /api/restaurants/[id]/menus — Create a new menu
// Auth required: staff with menu:manage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const {
      name,
      nameAm,
      description,
      descriptionAm,
      isActive = true,
      sortOrder = 0,
      schedule,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Menu name is required' },
        { status: 400 }
      )
    }

    const menu = await db.menu.create({
      data: {
        restaurantId,
        name,
        nameAm,
        description,
        descriptionAm,
        isActive,
        sortOrder,
        schedule,
      },
    })

    return NextResponse.json({ menu }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[MENU_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create menu' },
      { status: 500 }
    )
  }
}
