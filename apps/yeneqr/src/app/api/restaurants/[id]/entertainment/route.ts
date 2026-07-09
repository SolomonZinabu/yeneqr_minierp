// ============================================================
// Yene QR — Customer-facing Entertainment Content API
// Returns merged restaurant-specific + platform-wide content
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveI18nString, parseI18nJson } from '@/lib/i18n'

/**
 * Resolve i18n for a trivia content object.
 * The content is JSON: { question, options[], correctIndex, explanation }
 * We resolve i18n for question, options, and explanation.
 */
function resolveTriviaI18n(
  content: string,
  contentI18n: string | null,
  lang: string,
  defaultLang: string = 'en'
): Record<string, unknown> {
  let trivia: Record<string, unknown>
  try {
    trivia = JSON.parse(content)
  } catch {
    return { raw: content }
  }

  const i18nMap = parseI18nJson(contentI18n)
  if (!i18nMap) return trivia

  // The contentI18n for trivia is a JSON string where each language key
  // maps to a JSON string of the translated trivia object
  const langData = i18nMap[lang] || i18nMap[defaultLang] || i18nMap['en']
  if (!langData) return trivia

  let translatedTrivia: Record<string, unknown> | null = null
  try {
    translatedTrivia = JSON.parse(langData)
  } catch {
    return trivia
  }

  return {
    ...trivia,
    question: (translatedTrivia as Record<string, unknown>).question ?? trivia.question,
    options: (translatedTrivia as Record<string, unknown>).options ?? trivia.options,
    explanation: (translatedTrivia as Record<string, unknown>).explanation ?? trivia.explanation,
  }
}

/**
 * GET /api/restaurants/[id]/entertainment
 * Customer-facing endpoint — returns entertainment content for a restaurant.
 * Merges restaurant-specific content with platform-wide (restaurantId = null),
 * with restaurant content taking priority.
 *
 * Query params:
 *   type     — Filter by content type (fact, story, read, trivia_question, game_config)
 *   category — Filter by category (food, culture, science, history, general)
 *   lang     — Language code for i18n resolution
 *   limit    — Max items to return (default 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const category = searchParams.get('category') || undefined
    const lang = searchParams.get('lang') || 'en'
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    // Verify restaurant exists
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, defaultLanguage: true },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const defaultLang = restaurant.defaultLanguage || 'en'

    // Build where clause for common filters
    const baseWhere: Record<string, unknown> = {
      isActive: true,
    }
    if (type) baseWhere.type = type
    if (category) baseWhere.category = category

    // Fetch restaurant-specific content and platform-wide content in parallel
    const [restaurantContent, platformContent] = await Promise.all([
      db.entertainmentContent.findMany({
        where: { ...baseWhere, restaurantId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      db.entertainmentContent.findMany({
        where: { ...baseWhere, restaurantId: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    ])

    // Merge: restaurant content takes priority over platform content
    // If restaurant has content of the same type+category, skip the platform version
    const restaurantKeys = new Set(
      restaurantContent.map((c) => `${c.type}:${c.category || 'none'}`)
    )

    // For more granular dedup, use individual content IDs
    // Actually, we should just combine them and let restaurant content come first
    // The priority means: if restaurant has content, show that instead of platform defaults
    // For simplicity and better UX, we show ALL restaurant content + platform content
    // that doesn't overlap by type+category

    // Better approach: show restaurant content first, then supplement with platform content
    // for categories/types where restaurant has no content
    const restaurantTypeCategories = new Set<string>()
    for (const item of restaurantContent) {
      // Track which (type, category) combos the restaurant has
      restaurantTypeCategories.add(`${item.type}::${item.category || ''}`)
    }

    const supplementedPlatform = platformContent.filter(
      (item) => !restaurantTypeCategories.has(`${item.type}::${item.category || ''}`)
    )

    const allContent = [...restaurantContent, ...supplementedPlatform]

    // Apply limit
    const limitedContent = allContent.slice(0, limit)

    // Resolve i18n for each item
    const resolvedData = limitedContent.map((item) => {
      const resolvedTitle = resolveI18nString(item.titleI18n, item.title || '', lang, defaultLang)

      let resolvedContent: string | Record<string, unknown> = item.content

      if (item.type === 'trivia_question') {
        // For trivia, parse and resolve i18n within the JSON structure
        resolvedContent = resolveTriviaI18n(item.content, item.contentI18n, lang, defaultLang)
      } else {
        // For other types, resolve content as plain text
        resolvedContent = resolveI18nString(item.contentI18n, item.content, lang, defaultLang)
      }

      let parsedMetadata: Record<string, unknown> | null = null
      if (item.metadata) {
        try {
          parsedMetadata = JSON.parse(item.metadata)
        } catch {
          parsedMetadata = null
        }
      }

      return {
        id: item.id,
        type: item.type,
        category: item.category,
        title: resolvedTitle,
        content: resolvedContent,
        imageUrl: item.imageUrl,
        metadata: parsedMetadata,
        sortOrder: item.sortOrder,
      }
    })

    return NextResponse.json({
      data: resolvedData,
    })
  } catch (error) {
    console.error('[ENTERTAINMENT_CUSTOMER_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch entertainment content' },
      { status: 500 }
    )
  }
}
