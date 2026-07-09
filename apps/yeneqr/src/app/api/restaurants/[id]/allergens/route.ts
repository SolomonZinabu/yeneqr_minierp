import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/allergens — List all allergens
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // Verify restaurant exists
    const restaurant = await db.restaurant.findFirst({
      where: { id: restaurantId },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const allergens = await db.allergen.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { menuItemAllergens: true },
        },
      },
    })

    return NextResponse.json({ allergens })
  } catch (error) {
    console.error('[ALLERGENS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch allergens' },
      { status: 500 }
    )
  }
}

// POST /api/restaurants/[id]/allergens — Create a new allergen (staff only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request)
    const { id: restaurantId } = await params
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { name, icon } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Allergen name is required' },
        { status: 400 }
      )
    }

    // Check if allergen already exists
    const existing = await db.allergen.findFirst({
      where: { name },
    })

    if (existing) {
      return NextResponse.json({ allergen: existing })
    }

    const allergen = await db.allergen.create({
      data: {
        name,
        icon,
      },
    })

    return NextResponse.json({ allergen }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ALLERGEN_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create allergen' },
      { status: 500 }
    )
  }
}
