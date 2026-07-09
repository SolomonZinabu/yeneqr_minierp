// ============================================================
// Yene QR — Bulk AI Translation API (Gap 2.17)
// ============================================================
// POST /api/restaurants/[id]/i18n/bulk-translate
// Uses AI to batch-translate menu item names + descriptions into
// the restaurant's enabled languages.
//
// Body: {
//   targetLanguages: string[],   // e.g., ["am", "om", "ti"]
//   itemIds?: string[],          // optional: specific items (default: all)
//   overwrite?: boolean          // optional: overwrite existing translations (default: false)
// }
//
// Returns: { translated: number, skipped: number, errors: string[] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { targetLanguages, itemIds, overwrite = false } = body as {
      targetLanguages: string[]
      itemIds?: string[]
      overwrite?: boolean
    }

    if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return NextResponse.json({ error: 'targetLanguages array is required' }, { status: 400 })
    }

    // Fetch menu items (all or specified)
    const where: Record<string, unknown> = { restaurantId }
    if (itemIds && itemIds.length > 0) {
      where.id = { in: itemIds }
    }

    const items = await db.menuItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameAm: true,
        nameI18n: true,
        description: true,
        descriptionAm: true,
        descriptionI18n: true,
      },
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'No menu items found' }, { status: 404 })
    }

    let translated = 0
    let skipped = 0
    const errors: string[] = []

    // Process each item
    for (const item of items) {
      try {
        // Parse existing i18n JSON
        let nameI18n: Record<string, string> = {}
        let descI18n: Record<string, string> = {}
        try { nameI18n = item.nameI18n ? JSON.parse(item.nameI18n) : {} } catch { /* empty */ }
        try { descI18n = item.descriptionI18n ? JSON.parse(item.descriptionI18n) : {} } catch { /* empty */ }

        let itemChanged = false

        for (const lang of targetLanguages) {
          // Skip if translation exists and overwrite is false
          if (!overwrite && nameI18n[lang]) {
            skipped++
            continue
          }

          // Translate name
          if (item.name) {
            const translatedName = await translateText(item.name, lang, restaurantId)
            if (translatedName) {
              nameI18n[lang] = translatedName
              itemChanged = true
            }
          }

          // Translate description (if exists)
          if (item.description && (!overwrite && !descI18n[lang])) {
            const translatedDesc = await translateText(item.description, lang, restaurantId)
            if (translatedDesc) {
              descI18n[lang] = translatedDesc
              itemChanged = true
            }
          }
        }

        if (itemChanged) {
          await db.menuItem.update({
            where: { id: item.id },
            data: {
              nameI18n: JSON.stringify(nameI18n),
              descriptionI18n: descI18n && Object.keys(descI18n).length > 0 ? JSON.stringify(descI18n) : null,
              // Also set nameAm if Amharic is in target languages
              ...(nameI18n['am'] && !item.nameAm ? { nameAm: nameI18n['am'] } : {}),
            },
          })
          translated++
        }
      } catch (err) {
        errors.push(`Item "${item.name}": ${(err as Error).message}`)
      }
    }

    return NextResponse.json({
      success: true,
      translated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      totalItems: items.length,
      targetLanguages,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BULK_TRANSLATE]', error)
    return NextResponse.json({ error: 'Failed to bulk translate' }, { status: 500 })
  }
}

/**
 * Translate text using the per-restaurant AI provider abstraction.
 * Restaurant owners configure their own provider + API key in Settings.
 * Falls back to Z.ai SDK in sandbox (development only).
 * Returns null if AI is disabled for this restaurant.
 */
async function translateText(text: string, targetLang: string, restaurantId: string): Promise<string | null> {
  if (!text || text.trim().length === 0) return null

  const { aiTranslate } = await import('@/lib/ai-provider')
  return aiTranslate(text, targetLang, restaurantId)
}
