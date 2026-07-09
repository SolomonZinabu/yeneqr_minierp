// ============================================================
// Yene QR — Restaurant Entertainment Content Management API
// GET: List restaurant's entertainment content with pagination
// POST: Create new restaurant-specific content (staff with manager+ role)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

const VALID_TYPES = ['fact', 'story', 'read', 'trivia_question', 'game_config']
const VALID_CATEGORIES = ['food', 'culture', 'science', 'history', 'general']

/**
 * GET /api/restaurants/[id]/entertainment/manage
 * List restaurant's entertainment content with pagination.
 *
 * Query params:
 *   page     — Page number (default 1)
 *   limit    — Items per page (default 20)
 *   type     — Filter by content type
 *   category — Filter by category
 *   isActive — Filter by active status
 *   search   — Search in title/content
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require restaurant:view permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const type = searchParams.get('type') || undefined
    const category = searchParams.get('category') || undefined
    const isActiveParam = searchParams.get('isActive')
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      restaurantId,
    }

    if (type) where.type = type
    if (category) where.category = category
    if (isActiveParam !== null && isActiveParam !== undefined) {
      where.isActive = isActiveParam === 'true'
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      db.entertainmentContent.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.entertainmentContent.count({ where }),
    ])

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESTAURANT_ENTERTAINMENT_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch entertainment content' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/entertainment/manage
 * Create new restaurant-specific content (staff with manager+ role).
 *
 * Body: {
 *   type, category?, title?, titleI18n?, content, contentI18n?,
 *   imageUrl?, metadata?, sortOrder?, isActive?
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require restaurant:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const {
      type,
      category,
      title,
      titleI18n,
      content,
      contentI18n,
      imageUrl,
      metadata,
      sortOrder = 0,
      isActive = true,
    } = body as {
      type: string
      category?: string
      title?: string
      titleI18n?: Record<string, string> | string
      content: string
      contentI18n?: Record<string, string> | string
      imageUrl?: string
      metadata?: Record<string, unknown> | string
      sortOrder?: number
      isActive?: boolean
    }

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'type is required' },
        { status: 400 }
      )
    }

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      )
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    // For trivia_question type, validate content is valid JSON
    if (type === 'trivia_question') {
      try {
        const parsed = JSON.parse(content)
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Invalid trivia format')
        }
        if (typeof parsed.question !== 'string' || !Array.isArray(parsed.options) || typeof parsed.correctIndex !== 'number') {
          return NextResponse.json(
            { error: 'Trivia content must have: question (string), options (array), correctIndex (number)' },
            { status: 400 }
          )
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Invalid trivia format') {
          // re-throw
        }
        return NextResponse.json(
          { error: 'Trivia content must be valid JSON with question, options, and correctIndex' },
          { status: 400 }
        )
      }
    }

    // Verify restaurant exists
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // Serialize JSON fields
    const titleI18nStr = titleI18n
      ? (typeof titleI18n === 'string' ? titleI18n : JSON.stringify(titleI18n))
      : null
    const contentI18nStr = contentI18n
      ? (typeof contentI18n === 'string' ? contentI18n : JSON.stringify(contentI18n))
      : null
    const metadataStr = metadata
      ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
      : null

    const item = await db.entertainmentContent.create({
      data: {
        restaurantId,
        type,
        category: category || null,
        title: title || null,
        titleI18n: titleI18nStr,
        content,
        contentI18n: contentI18nStr,
        imageUrl: imageUrl || null,
        metadata: metadataStr,
        sortOrder,
        isActive,
      },
    })

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESTAURANT_ENTERTAINMENT_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create entertainment content' },
      { status: 500 }
    )
  }
}
