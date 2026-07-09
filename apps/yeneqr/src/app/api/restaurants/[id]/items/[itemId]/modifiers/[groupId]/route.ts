import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// PUT /api/restaurants/[id]/items/[itemId]/modifiers/[groupId] — Update modifier group
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; groupId: string }> }
) {
  try {
    const { id: restaurantId, itemId, groupId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr
    const body = await request.json()

    // Verify modifier group belongs to the item and the item belongs to the restaurant
    const existing = await db.modifierGroup.findFirst({
      where: { id: groupId, menuItemId: itemId },
      include: {
        menuItem: {
          select: { restaurantId: true },
        },
      },
    })

    if (!existing || existing.menuItem.restaurantId !== restaurantId) {
      return NextResponse.json(
        { error: 'Modifier group not found' },
        { status: 404 }
      )
    }

    const {
      name,
      nameAm,
      isRequired,
      selectionType,
      minSelection,
      maxSelection,
      sortOrder,
    } = body

    const modifierGroup = await db.modifierGroup.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAm !== undefined && { nameAm }),
        ...(isRequired !== undefined && { isRequired }),
        ...(selectionType !== undefined && { selectionType }),
        ...(minSelection !== undefined && { minSelection }),
        ...(maxSelection !== undefined && { maxSelection }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json({ modifierGroup })
  } catch (error) {
    console.error('[MODIFIER_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update modifier group' },
      { status: 500 }
    )
  }
}

// DELETE /api/restaurants/[id]/items/[itemId]/modifiers/[groupId] — Delete modifier group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; groupId: string }> }
) {
  try {
    const { id: restaurantId, itemId, groupId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    // Verify modifier group belongs to the item and the item belongs to the restaurant
    const existing = await db.modifierGroup.findFirst({
      where: { id: groupId, menuItemId: itemId },
      include: {
        menuItem: {
          select: { restaurantId: true },
        },
      },
    })

    if (!existing || existing.menuItem.restaurantId !== restaurantId) {
      return NextResponse.json(
        { error: 'Modifier group not found' },
        { status: 404 }
      )
    }

    await db.modifierGroup.delete({
      where: { id: groupId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MODIFIER_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete modifier group' },
      { status: 500 }
    )
  }
}
