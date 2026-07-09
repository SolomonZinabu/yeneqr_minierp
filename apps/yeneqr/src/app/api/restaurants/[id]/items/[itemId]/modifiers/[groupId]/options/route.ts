import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// POST /api/restaurants/[id]/items/[itemId]/modifiers/[groupId]/options — Add option to modifier group
export async function POST(
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
    const modifierGroup = await db.modifierGroup.findFirst({
      where: { id: groupId, menuItemId: itemId },
      include: {
        menuItem: {
          select: { restaurantId: true },
        },
      },
    })

    if (!modifierGroup || modifierGroup.menuItem.restaurantId !== restaurantId) {
      return NextResponse.json(
        { error: 'Modifier group not found' },
        { status: 404 }
      )
    }

    const {
      name,
      nameAm,
      priceDeltaCents = 0,
      isDefault = false,
      isActive = true,
      sortOrder = 0,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Option name is required' },
        { status: 400 }
      )
    }

    const option = await db.modifierOption.create({
      data: {
        modifierGroupId: groupId,
        name,
        nameAm,
        priceDeltaCents,
        isDefault,
        isActive,
        sortOrder,
      },
    })

    return NextResponse.json({ option }, { status: 201 })
  } catch (error) {
    console.error('[MODIFIER_OPTION_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create modifier option' },
      { status: 500 }
    )
  }
}
