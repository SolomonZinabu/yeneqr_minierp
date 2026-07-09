// ============================================================
// Yene QR — Restaurant Language Configuration API
// GET  /api/restaurants/[id]/i18n/languages — Get enabled languages
// PUT  /api/restaurants/[id]/i18n/languages — Configure enabled languages
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const restaurant = await db.restaurant.findUnique({
      where: { id },
      include: { restaurantLanguages: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Get translation stats for each language
    const stats = await db.translationStat.findMany({
      where: { restaurantId: id },
    })

    const enabledLanguages = await Promise.all(
      restaurant.restaurantLanguages.map(async (rl) => {
        const lang = await db.language.findUnique({ where: { code: rl.languageCode } })
        const langStats = stats.filter(s => s.languageCode === rl.languageCode)
        const overallCompletion = langStats.length > 0
          ? Math.round(langStats.reduce((acc, s) => acc + s.completionPct, 0) / langStats.length)
          : 0

        return {
          code: rl.languageCode,
          name: lang?.name || rl.languageCode,
          nameLocal: lang?.nameLocal || rl.languageCode,
          direction: (lang?.direction || 'ltr') as 'ltr' | 'rtl',
          fontFamily: lang?.fontFamily || null,
          flagEmoji: lang?.flagEmoji || null,
          isDefault: rl.isDefault,
          isActive: rl.isActive,
          isRequired: rl.isRequired,
          sortOrder: rl.sortOrder,
          completionPct: overallCompletion,
        }
      })
    )

    return NextResponse.json({
      defaultLanguage: restaurant.defaultLanguage,
      enabledLanguages,
    })
  } catch (error) {
    console.error('[RESTAURANT_I18N_LANGUAGES_GET_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch restaurant languages' }, { status: 500 })
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
    const { defaultLanguage, languages } = body as {
      defaultLanguage?: string
      languages: Array<{
        code: string
        isActive: boolean
        isRequired: boolean
        isDefault: boolean
        sortOrder: number
      }>
    }

    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Update in transaction
    await db.$transaction(async (tx) => {
      // Delete existing language configs
      await tx.restaurantLanguage.deleteMany({ where: { restaurantId: id } })

      // Create new language configs
      for (const lang of languages) {
        await tx.restaurantLanguage.create({
          data: {
            restaurantId: id,
            languageCode: lang.code,
            isDefault: lang.isDefault,
            isActive: lang.isActive,
            isRequired: lang.isRequired,
            sortOrder: lang.sortOrder,
          },
        })
      }

      // Update default language on restaurant
      if (defaultLanguage) {
        await tx.restaurant.update({
          where: { id },
          data: {
            defaultLanguage,
            enabledLanguages: JSON.stringify(languages.filter(l => l.isActive).map(l => l.code)),
          },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[RESTAURANT_I18N_LANGUAGES_PUT_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update restaurant languages' }, { status: 500 })
  }
}
