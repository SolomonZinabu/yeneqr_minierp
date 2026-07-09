// ============================================================
// Yene QR — UI Strings API
// GET  /api/i18n/ui-strings?group=menu — List UI strings (optionally by group)
// POST /api/i18n/ui-strings — Create a new UI string
// PUT  /api/i18n/ui-strings — Bulk update UI string translations
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeI18nJson, parseI18nJson } from '@/lib/i18n'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const group = searchParams.get('group')
    const lang = searchParams.get('lang') || 'en'

    const where: any = { isActive: true }
    if (group) where.group = group

    const uiStrings = await db.uIString.findMany({ where, orderBy: [{ group: 'asc' }, { key: 'asc' }] })

    const result = uiStrings.map(s => {
      const translations = parseI18nJson(s.translations)
      const resolvedValue = lang === 'en' ? s.defaultValue : (translations?.[lang] || s.defaultValue)

      return {
        id: s.id,
        key: s.key,
        group: s.group,
        description: s.description,
        defaultValue: s.defaultValue,
        translations,
        resolvedValue,
      }
    })

    return NextResponse.json({ strings: result, group, language: lang })
  } catch (error) {
    console.error('[I18N_UI_STRINGS_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch UI strings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, group, defaultValue, description, translations } = body

    if (!key || !group || !defaultValue) {
      return NextResponse.json(
        { error: 'Missing required fields: key, group, defaultValue' },
        { status: 400 }
      )
    }

    const existing = await db.uIString.findUnique({ where: { key } })
    if (existing) {
      return NextResponse.json(
        { error: `UI string with key '${key}' already exists` },
        { status: 409 }
      )
    }

    const uiString = await db.uIString.create({
      data: {
        key,
        group,
        defaultValue,
        description: description || null,
        translations: serializeI18nJson(translations || null),
      },
    })

    return NextResponse.json({ uiString }, { status: 201 })
  } catch (error) {
    console.error('[I18N_UI_STRINGS_POST_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create UI string' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, translations } = body

    if (!key || !translations) {
      return NextResponse.json(
        { error: 'Missing required fields: key, translations' },
        { status: 400 }
      )
    }

    const existing = await db.uIString.findUnique({ where: { key } })
    if (!existing) {
      return NextResponse.json(
        { error: `UI string with key '${key}' not found` },
        { status: 404 }
      )
    }

    const uiString = await db.uIString.update({
      where: { key },
      data: {
        translations: serializeI18nJson(translations),
      },
    })

    return NextResponse.json({ uiString })
  } catch (error) {
    console.error('[I18N_UI_STRINGS_PUT_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update UI string' }, { status: 500 })
  }
}
