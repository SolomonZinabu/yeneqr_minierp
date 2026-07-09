// ============================================================
// Yene QR — UI String Bundle API
// GET /api/i18n/ui-strings/bundle?lang=am&restaurantId=xxx
// Returns ALL UI strings for a language as a flat key-value map
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseI18nJson } from '@/lib/i18n'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'en'
    const restaurantId = searchParams.get('restaurantId')

    // Fetch all active UI strings in one query
    const uiStrings = await db.uIString.findMany({
      where: { isActive: true },
    })

    // Batch-fetch restaurant overrides (single query instead of N+1)
    let overrideMap: Record<string, string> = {}
    if (restaurantId) {
      const overrides = await db.uIStringOverride.findMany({
        where: {
          restaurantId,
          languageCode: lang,
        },
        select: {
          uiStringKey: true,
          value: true,
        },
      })
      overrideMap = Object.fromEntries(
        overrides.map(o => [o.uiStringKey, o.value])
      )
    }

    // Build the string map with fallback chain
    const strings: Record<string, string> = {}

    for (const uiString of uiStrings) {
      // Check for restaurant override first
      const override = overrideMap[uiString.key]
      if (override) {
        strings[uiString.key] = override
        continue
      }

      // Resolve from platform translations
      if (lang === 'en') {
        strings[uiString.key] = uiString.defaultValue
      } else {
        const translations = parseI18nJson(uiString.translations)
        const translated = translations?.[lang] || null
        strings[uiString.key] = translated || uiString.defaultValue
      }
    }

    // Get language direction
    const language = await db.language.findUnique({ where: { code: lang } })
    const direction = language?.direction || 'ltr'

    return NextResponse.json({
      language: lang,
      direction,
      strings,
    })
  } catch (error: unknown) {
    console.error('[I18N_BUNDLE_ERROR]', error)
    // Return an empty strings bundle instead of a 500 error
    // The client-side useI18n hook has built-in English fallbacks
    // that will provide readable text when the bundle is empty
    const lang = new URL(request.url).searchParams.get('lang') || 'en'
    return NextResponse.json({
      language: lang,
      direction: 'ltr',
      strings: {},
    })
  }
}
