// ============================================================
// Yene QR — Menu Content i18n API
// GET  /api/restaurants/[id]/i18n/menu-content — Get all menu content with i18n
// PUT  /api/restaurants/[id]/i18n/menu-content — Update menu item/category i18n
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { parseI18nJson, serializeI18nJson, setI18nValue } from '@/lib/i18n'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // Verify restaurant exists
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        nameI18n: true,
        description: true,
        descriptionI18n: true,
        defaultLanguage: true,
        enabledLanguages: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Get categories with i18n
    const categories = await db.menuCategory.findMany({
      where: { restaurantId, isActive: true },
      select: {
        id: true,
        name: true,
        nameI18n: true,
        description: true,
        descriptionI18n: true,
        sortOrder: true,
        menuId: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Get items with i18n
    const items = await db.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      select: {
        id: true,
        name: true,
        nameI18n: true,
        description: true,
        descriptionI18n: true,
        categoryId: true,
        priceCents: true,
        sortOrder: true,
      },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    })

    // Calculate translation stats per language
    const enabledLangs = Array.isArray(restaurant.enabledLanguages)
      ? (restaurant.enabledLanguages as string[])
      : typeof restaurant.enabledLanguages === 'string'
        ? JSON.parse(restaurant.enabledLanguages)
        : ['en']

    const stats: Record<string, { categories: { total: number; translated: number }; items: { total: number; translated: number }; restaurant: { total: number; translated: number } }> = {}

    for (const l of enabledLangs) {
      if (l === 'en') continue
      stats[l] = {
        restaurant: {
          total: 2,
          translated: [
            parseI18nJson(restaurant.nameI18n)?.[l] ? 1 : 0,
            parseI18nJson(restaurant.descriptionI18n)?.[l] ? 1 : 0,
          ].reduce((a, b) => a + b, 0),
        },
        categories: {
          total: categories.length,
          translated: categories.filter(c => parseI18nJson(c.nameI18n)?.[l]).length,
        },
        items: {
          total: items.length,
          translated: items.filter(i => parseI18nJson(i.nameI18n)?.[l]).length,
        },
      }
    }

    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        nameI18n: parseI18nJson(restaurant.nameI18n) || {},
        description: restaurant.description,
        descriptionI18n: parseI18nJson(restaurant.descriptionI18n) || {},
        defaultLanguage: restaurant.defaultLanguage,
        enabledLanguages: enabledLangs,
      },
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        nameI18n: parseI18nJson(c.nameI18n) || {},
        description: c.description,
        descriptionI18n: parseI18nJson(c.descriptionI18n) || {},
        menuId: c.menuId,
        sortOrder: c.sortOrder,
      })),
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        nameI18n: parseI18nJson(i.nameI18n) || {},
        description: i.description,
        descriptionI18n: parseI18nJson(i.descriptionI18n) || {},
        categoryId: i.categoryId,
        price: i.priceCents,
        sortOrder: i.sortOrder,
      })),
      stats,
    })
  } catch (error) {
    console.error('[MENU_CONTENT_I18N_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch menu content' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { entityType, entityId, field, language, value } = body

    if (!entityType || !entityId || !field || !language) {
      return NextResponse.json(
        { error: 'Missing required fields: entityType, entityId, field, language' },
        { status: 400 }
      )
    }

    const validTypes = ['restaurant', 'category', 'item']
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validFields = ['nameI18n', 'descriptionI18n']
    if (!validFields.includes(field)) {
      return NextResponse.json(
        { error: `Invalid field. Must be one of: ${validFields.join(', ')}` },
        { status: 400 }
      )
    }

    if (entityType === 'restaurant') {
      const current = await db.restaurant.findUnique({
        where: { id: entityId },
        select: { [field]: true },
      })
      if (!current) {
        return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
      }

      const currentI18n = parseI18nJson(current[field] as string)
      const updatedI18n = setI18nValue(currentI18n, language, value)

      await db.restaurant.update({
        where: { id: entityId },
        data: { [field]: serializeI18nJson(updatedI18n) },
      })
    } else if (entityType === 'category') {
      const current = await db.menuCategory.findUnique({
        where: { id: entityId },
        select: { [field]: true },
      })
      if (!current) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }

      const currentI18n = parseI18nJson(current[field] as string)
      const updatedI18n = setI18nValue(currentI18n, language, value)

      await db.menuCategory.update({
        where: { id: entityId },
        data: { [field]: serializeI18nJson(updatedI18n) },
      })
    } else if (entityType === 'item') {
      const current = await db.menuItem.findUnique({
        where: { id: entityId },
        select: { [field]: true },
      })
      if (!current) {
        return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
      }

      const currentI18n = parseI18nJson(current[field] as string)
      const updatedI18n = setI18nValue(currentI18n, language, value)

      await db.menuItem.update({
        where: { id: entityId },
        data: { [field]: serializeI18nJson(updatedI18n) },
      })
    }

    return NextResponse.json({
      success: true,
      entityType,
      entityId,
      field,
      language,
      value,
    })
  } catch (error) {
    console.error('[MENU_CONTENT_I18N_PUT_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update translation' }, { status: 500 })
  }
}
