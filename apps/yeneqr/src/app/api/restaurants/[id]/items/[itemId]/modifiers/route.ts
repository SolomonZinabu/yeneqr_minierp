import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/items/[itemId]/modifiers — List modifier groups for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const item = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const modifierGroups = await db.modifierGroup.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json({ modifierGroups })
  } catch (error) {
    console.error('[MODIFIERS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch modifier groups' },
      { status: 500 }
    )
  }
}

// POST /api/restaurants/[id]/items/[itemId]/modifiers — Create a modifier group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr
    const body = await request.json()

    const item = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const {
      name,
      nameAm,
      isRequired = false,
      selectionType = 'single',
      minSelection = 1,
      maxSelection = 1,
      sortOrder = 0,
      options = [],
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Modifier group name is required' },
        { status: 400 }
      )
    }

    const modifierGroup = await db.modifierGroup.create({
      data: {
        menuItemId: itemId,
        name,
        nameAm,
        isRequired,
        selectionType,
        minSelection,
        maxSelection,
        sortOrder,
        options: {
          create: options.map(
            (option: {
              name: string
              nameAm?: string
              priceDelta?: number
              isDefault?: boolean
              isActive?: boolean
              sortOrder?: number
            }) => ({
              name: option.name,
              nameAm: option.nameAm,
              priceDeltaCents: option.priceDeltaCents ?? 0,
              isDefault: option.isDefault ?? false,
              isActive: option.isActive ?? true,
              sortOrder: option.sortOrder ?? 0,
            })
          ),
        },
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json({ modifierGroup }, { status: 201 })
  } catch (error) {
    console.error('[MODIFIER_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create modifier group' },
      { status: 500 }
    )
  }
}
