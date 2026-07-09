import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/menus/[menuId]/categories — List categories in a menu
// Auth: staff with menu:view, OR customer with valid session for this restaurant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> }
) {
  try {
    const { id: restaurantId, menuId } = await params
    const auth = getAuthContext(request)

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Customers scanning QR codes can view categories for their restaurant
    if (auth.type === 'customer') {
      if (auth.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const permErr = requirePerm(auth, 'menu:view', restaurantId)
      if (permErr) return permErr
    }

    const menu = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    const categories = await db.menuCategory.findMany({
      where: { menuId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        nameAm: true,
        nameI18n: true,
        icon: true,
        image: true,
        description: true,
        descriptionAm: true,
        descriptionI18n: true,
        isActive: true,
        sortOrder: true,
        _count: {
          select: { items: true },
        },
      },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[CATEGORIES_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

// POST /api/restaurants/[id]/menus/[menuId]/categories — Create a category
// Auth required: staff with menu:manage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> }
) {
  try {
    const { id: restaurantId, menuId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()

    const menu = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    const {
      name,
      nameAm,
      description,
      descriptionAm,
      icon,
      image,
      isActive = true,
      sortOrder = 0,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      )
    }

    const category = await db.menuCategory.create({
      data: {
        menuId,
        restaurantId,
        name,
        nameAm,
        description,
        descriptionAm,
        icon,
        image,
        isActive,
        sortOrder,
      },
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[CATEGORY_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}
