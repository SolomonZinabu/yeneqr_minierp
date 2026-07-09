import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/menus/[menuId]/categories/[categoryId] — Get category with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string; categoryId: string }> }
) {
  try {
    const { id: restaurantId, menuId, categoryId } = await params

    const category = await db.menuCategory.findFirst({
      where: { id: categoryId, menuId, restaurantId },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroups: {
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            translations: true,
          },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('[CATEGORY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    )
  }
}

// PUT /api/restaurants/[id]/menus/[menuId]/categories/[categoryId] — Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string; categoryId: string }> }
) {
  try {
    const { id: restaurantId, menuId, categoryId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr
    const body = await request.json()

    const existing = await db.menuCategory.findFirst({
      where: { id: categoryId, menuId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    const {
      name,
      nameAm,
      description,
      descriptionAm,
      icon,
      image,
      isActive,
      sortOrder,
    } = body

    const category = await db.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(description !== undefined && { description }),
        ...(descriptionAm !== undefined && { descriptionAm }),
        ...(icon !== undefined && { icon }),
        ...(image !== undefined && { image }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('[CATEGORY_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

// DELETE /api/restaurants/[id]/menus/[menuId]/categories/[categoryId] — Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string; categoryId: string }> }
) {
  try {
    const { id: restaurantId, menuId, categoryId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const existing = await db.menuCategory.findFirst({
      where: { id: categoryId, menuId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    await db.menuCategory.delete({
      where: { id: categoryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CATEGORY_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
