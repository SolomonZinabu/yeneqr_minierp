// ============================================================
// Yene QR — Platform Languages API
// GET  /api/i18n/languages — List all platform-supported languages
// POST /api/i18n/languages — Add a new platform language (super admin)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const languages = await db.language.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({
      languages: languages.map(l => ({
        id: l.id,
        code: l.code,
        name: l.name,
        nameLocal: l.nameLocal,
        direction: l.direction,
        fontFamily: l.fontFamily,
        flagEmoji: l.flagEmoji,
        isActive: l.isActive,
        sortOrder: l.sortOrder,
      })),
    })
  } catch (error) {
    console.error('[I18N_LANGUAGES_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch languages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, nameLocal, direction, fontFamily, flagEmoji, sortOrder } = body

    if (!code || !name || !nameLocal) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, nameLocal' },
        { status: 400 }
      )
    }

    const existing = await db.language.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { error: `Language with code '${code}' already exists` },
        { status: 409 }
      )
    }

    const language = await db.language.create({
      data: {
        code,
        name,
        nameLocal,
        direction: direction || 'ltr',
        fontFamily: fontFamily || null,
        flagEmoji: flagEmoji || null,
        sortOrder: sortOrder || 99,
      },
    })

    return NextResponse.json({ language }, { status: 201 })
  } catch (error) {
    console.error('[I18N_LANGUAGES_POST_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create language' }, { status: 500 })
  }
}
