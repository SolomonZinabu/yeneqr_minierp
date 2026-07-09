// ============================================================
// Yene QR — Bulk UI String Update API
// POST /api/i18n/ui-strings/bulk-update — Update multiple UI strings at once
// Body: { updates: [{ key, translations }] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeI18nJson, parseI18nJson } from '@/lib/i18n'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty updates array' },
        { status: 400 }
      )
    }

    const results: Array<{ key: string; translations: Record<string, string> }> = []

    for (const update of updates) {
      const { key, translations } = update
      if (!key || !translations) continue

      const existing = await db.uIString.findUnique({ where: { key } })
      if (!existing) continue

      const uiString = await db.uIString.update({
        where: { key },
        data: {
          translations: serializeI18nJson(translations),
        },
      })

      results.push({
        key: uiString.key,
        translations: parseI18nJson(uiString.translations) || {},
      })
    }

    return NextResponse.json({ updated: results.length, results })
  } catch (error) {
    console.error('[I18N_UI_STRINGS_BULK_UPDATE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to bulk update UI strings' }, { status: 500 })
  }
}
