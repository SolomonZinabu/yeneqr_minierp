import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

// GET /api/restaurants/[id]/items/[itemId]/translations — List translations for an item
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

    const translations = await db.menuItemTranslation.findMany({
      where: { menuItemId: itemId },
    })

    return NextResponse.json({ translations })
  } catch (error) {
    console.error('[TRANSLATIONS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    )
  }
}

// POST /api/restaurants/[id]/items/[itemId]/translations — Create or update translation
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

    const { language, name, description } = body

    if (!language) {
      return NextResponse.json(
        { error: 'Language code is required' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Translation name is required' },
        { status: 400 }
      )
    }

    // Upsert: if a translation for this language already exists, update it
    const translation = await db.menuItemTranslation.upsert({
      where: {
        menuItemId_language: {
          menuItemId: itemId,
          language,
        },
      },
      update: {
        name,
        description,
      },
      create: {
        menuItemId: itemId,
        language,
        name,
        description,
      },
    })

    return NextResponse.json({ translation }, { status: 201 })
  } catch (error) {
    console.error('[TRANSLATION_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create/update translation' },
      { status: 500 }
    )
  }
}
