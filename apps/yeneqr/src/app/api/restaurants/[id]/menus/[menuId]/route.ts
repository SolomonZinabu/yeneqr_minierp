import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/menus/[menuId] — Get menu with all categories
// Auth required: staff with menu:view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> }
) {
  try {
    const { id: restaurantId, menuId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:view', restaurantId)
    if (permErr) return permErr

    const menu = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: { items: true },
            },
          },
        },
      },
    })

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    return NextResponse.json({ menu })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[MENU_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu' },
      { status: 500 }
    )
  }
}

// PUT /api/restaurants/[id]/menus/[menuId] — Update menu
// Auth required: staff with menu:manage
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> }
) {
  try {
    const { id: restaurantId, menuId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()

    const existing = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    const {
      name,
      nameAm,
      description,
      descriptionAm,
      isActive,
      sortOrder,
      schedule,
    } = body

    const menu = await db.menu.update({
      where: { id: menuId },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(description !== undefined && { description }),
        ...(descriptionAm !== undefined && { descriptionAm }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(schedule !== undefined && { schedule }),
      },
    })

    return NextResponse.json({ menu })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[MENU_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update menu' },
      { status: 500 }
    )
  }
}

// DELETE /api/restaurants/[id]/menus/[menuId] — Soft delete menu
// Auth required: staff with menu:manage
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> }
) {
  try {
    const { id: restaurantId, menuId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const existing = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    const menu = await db.menu.update({
      where: { id: menuId },
      data: { isActive: false },
    })

    return NextResponse.json({ menu })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[MENU_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete menu' },
      { status: 500 }
    )
  }
}
