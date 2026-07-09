// ============================================================
// Yene QR — Entity Translation API
// GET  /api/restaurants/[id]/translations?entityType=menuItem&lang=am — Get translations
// PUT  /api/restaurants/[id]/translations — Bulk update translations
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { parseI18nJson, serializeI18nJson } from '@/lib/i18n'

const ENTITY_CONFIG: Record<string, {
  model: any
  nameField: string
  descField?: string
  restaurantIdField: string
}> = {
  menuItem: { model: db.menuItem, nameField: 'nameI18n', descField: 'descriptionI18n', restaurantIdField: 'restaurantId' },
  menuCategory: { model: db.menuCategory, nameField: 'nameI18n', descField: 'descriptionI18n', restaurantIdField: 'restaurantId' },
  modifierGroup: { model: db.modifierGroup, nameField: 'nameI18n', restaurantIdField: 'menuItemId' },
  modifierOption: { model: db.modifierOption, nameField: 'nameI18n', restaurantIdField: 'modifierGroupId' },
  promotion: { model: db.promotion, nameField: 'nameI18n', descField: 'descriptionI18n', restaurantIdField: 'restaurantId' },
  branch: { model: db.branch, nameField: 'nameI18n', restaurantIdField: 'restaurantId' },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const lang = searchParams.get('lang') || 'en'

    if (!entityType || !ENTITY_CONFIG[entityType]) {
      return NextResponse.json(
        { error: `Invalid entityType. Valid: ${Object.keys(ENTITY_CONFIG).join(', ')}` },
        { status: 400 }
      )
    }

    const config = ENTITY_CONFIG[entityType]

    // For modifierGroup/modifierOption, we need to find by restaurant through parent
    let items: any[]
    if (entityType === 'modifierGroup') {
      items = await db.modifierGroup.findMany({
        where: { menuItem: { restaurantId: id } },
        select: { id: true, name: true, nameI18n: true, description: true, descriptionI18n: true },
      })
    } else if (entityType === 'modifierOption') {
      items = await db.modifierOption.findMany({
        where: { modifierGroup: { menuItem: { restaurantId: id } } },
        select: { id: true, name: true, nameI18n: true },
      })
    } else {
      items = await (config.model as any).findMany({
        where: { [config.restaurantIdField]: id },
        select: { id: true, name: true, nameI18n: true, description: true, descriptionI18n: true },
      })
    }

    const translations = items.map((item: any) => {
      const nameI18n = parseI18nJson(item.nameI18n)
      const descI18n = parseI18nJson(item.descriptionI18n)

      return {
        entityId: item.id,
        defaultName: item.name,
        defaultDescription: item.description || null,
        translatedName: nameI18n?.[lang] || null,
        translatedDescription: descI18n?.[lang] || null,
        nameI18n,
        descriptionI18n: descI18n,
      }
    })

    return NextResponse.json({ entityType, languageCode: lang, translations })
  } catch (error) {
    console.error('[TRANSLATIONS_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch translations' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', id)
    if (permErr) return permErr

    const body = await request.json()
    const { languageCode, translations } = body as {
      languageCode: string
      translations: Array<{
        entityType: string
        entityId: string
        fields: { name?: string; description?: string }
      }>
    }

    if (!languageCode || !translations || !Array.isArray(translations)) {
      return NextResponse.json({ error: 'Missing languageCode or translations' }, { status: 400 })
    }

    let updated = 0
    const errors: Array<{ entityId: string; error: string }> = []

    for (const entry of translations) {
      const config = ENTITY_CONFIG[entry.entityType]
      if (!config) {
        errors.push({ entityId: entry.entityId, error: `Unknown entity type: ${entry.entityType}` })
        continue
      }

      try {
        const item = await (config.model as any).findUnique({ where: { id: entry.entityId } })
        if (!item) {
          errors.push({ entityId: entry.entityId, error: 'Entity not found' })
          continue
        }

        // Update nameI18n
        const updateData: any = {}
        if (entry.fields.name !== undefined) {
          const existingNameI18n = parseI18nJson(item.nameI18n) || {}
          if (entry.fields.name === '') {
            delete existingNameI18n[languageCode]
          } else {
            existingNameI18n[languageCode] = entry.fields.name
          }
          updateData.nameI18n = serializeI18nJson(existingNameI18n)
          // Also update nameAm for backward compatibility
          if (languageCode === 'am') {
            updateData.nameAm = entry.fields.name || null
          }
        }

        // Update descriptionI18n
        if (entry.fields.description !== undefined && config.descField) {
          const existingDescI18n = parseI18nJson(item.descriptionI18n) || {}
          if (entry.fields.description === '') {
            delete existingDescI18n[languageCode]
          } else {
            existingDescI18n[languageCode] = entry.fields.description
          }
          updateData.descriptionI18n = serializeI18nJson(existingDescI18n)
          if (languageCode === 'am') {
            updateData.descriptionAm = entry.fields.description || null
          }
        }

        await (config.model as any).update({
          where: { id: entry.entityId },
          data: updateData,
        })
        updated++
      } catch (err) {
        errors.push({ entityId: entry.entityId, error: String(err) })
      }
    }

    return NextResponse.json({ updated, errors: errors.length > 0 ? errors : undefined })
  } catch (error) {
    console.error('[TRANSLATIONS_PUT_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update translations' }, { status: 500 })
  }
}
