// ============================================================
// Yene QR — Single UI String API
// GET  /api/i18n/ui-strings/[key] — Get a single UI string with all translations
// PUT  /api/i18n/ui-strings/[key] — Update translations for a single key
// DELETE /api/i18n/ui-strings/[key] — Delete a UI string key
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeI18nJson, parseI18nJson } from '@/lib/i18n'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const decodedKey = decodeURIComponent(key)

    const uiString = await db.uIString.findUnique({
      where: { key: decodedKey },
    })

    if (!uiString) {
      return NextResponse.json(
        { error: `UI string with key '${decodedKey}' not found` },
        { status: 404 }
      )
    }

    const translations = parseI18nJson(uiString.translations)

    return NextResponse.json({
      id: uiString.id,
      key: uiString.key,
      group: uiString.group,
      description: uiString.description,
      defaultValue: uiString.defaultValue,
      translations: translations || {},
      isActive: uiString.isActive,
      createdAt: uiString.createdAt,
      updatedAt: uiString.updatedAt,
    })
  } catch (error) {
    console.error('[I18N_UI_STRING_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch UI string' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const decodedKey = decodeURIComponent(key)
    const body = await request.json()
    const { translations, defaultValue, description, group } = body

    const existing = await db.uIString.findUnique({
      where: { key: decodedKey },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `UI string with key '${decodedKey}' not found` },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (translations !== undefined) {
      updateData.translations = serializeI18nJson(translations)
    }
    if (defaultValue !== undefined) {
      updateData.defaultValue = defaultValue
    }
    if (description !== undefined) {
      updateData.description = description
    }
    if (group !== undefined) {
      updateData.group = group
    }

    const uiString = await db.uIString.update({
      where: { key: decodedKey },
      data: updateData,
    })

    return NextResponse.json({
      id: uiString.id,
      key: uiString.key,
      group: uiString.group,
      description: uiString.description,
      defaultValue: uiString.defaultValue,
      translations: parseI18nJson(uiString.translations) || {},
    })
  } catch (error) {
    console.error('[I18N_UI_STRING_PUT_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update UI string' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const decodedKey = decodeURIComponent(key)

    const existing = await db.uIString.findUnique({
      where: { key: decodedKey },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `UI string with key '${decodedKey}' not found` },
        { status: 404 }
      )
    }

    await db.uIString.delete({ where: { key: decodedKey } })

    return NextResponse.json({ success: true, key: decodedKey })
  } catch (error) {
    console.error('[I18N_UI_STRING_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete UI string' }, { status: 500 })
  }
}
