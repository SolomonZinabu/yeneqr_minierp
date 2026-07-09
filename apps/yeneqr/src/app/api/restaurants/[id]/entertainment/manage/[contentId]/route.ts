// ============================================================
// Yene QR — Restaurant Entertainment Content Detail API
// PUT: Update restaurant-specific content
// DELETE: Delete restaurant-specific content
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

const VALID_TYPES = ['fact', 'story', 'read', 'trivia_question', 'game_config']
const VALID_CATEGORIES = ['food', 'culture', 'science', 'history', 'general']

/**
 * PUT /api/restaurants/[id]/entertainment/manage/[contentId]
 * Update restaurant-specific entertainment content.
 *
 * Body: {
 *   type?, category?, title?, titleI18n?, content?, contentI18n?,
 *   imageUrl?, metadata?, sortOrder?, isActive?
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  try {
    const { id: restaurantId, contentId } = await params
    const auth = requireAuth(request)

    // Require restaurant:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    // Find the content item
    const existing = await db.entertainmentContent.findUnique({
      where: { id: contentId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      )
    }

    // Verify it belongs to this restaurant
    if (existing.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
      sortOrder,
      isActive,
    } = body as {
      type?: string
      category?: string | null
      title?: string | null
      titleI18n?: Record<string, string> | string | null
      content?: string
      contentI18n?: Record<string, string> | string | null
      imageUrl?: string | null
      metadata?: Record<string, unknown> | string | null
      sortOrder?: number
      isActive?: boolean
    }

    // Validate type if provided
    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    // For trivia_question type, validate content is valid JSON
    const effectiveType = type || existing.type
    const effectiveContent = content || existing.content
    if (effectiveType === 'trivia_question' && content) {
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
      } catch {
        return NextResponse.json(
          { error: 'Trivia content must be valid JSON with question, options, and correctIndex' },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (type !== undefined) updateData.type = type
    if (category !== undefined) updateData.category = category || null
    if (title !== undefined) updateData.title = title || null
    if (content !== undefined) updateData.content = content
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (isActive !== undefined) updateData.isActive = isActive

    // Handle JSON fields
    if (titleI18n !== undefined) {
      updateData.titleI18n = titleI18n
        ? (typeof titleI18n === 'string' ? titleI18n : JSON.stringify(titleI18n))
        : null
    }
    if (contentI18n !== undefined) {
      updateData.contentI18n = contentI18n
        ? (typeof contentI18n === 'string' ? contentI18n : JSON.stringify(contentI18n))
        : null
    }
    if (metadata !== undefined) {
      updateData.metadata = metadata
        ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
        : null
    }

    const updated = await db.entertainmentContent.update({
      where: { id: contentId },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESTAURANT_ENTERTAINMENT_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update entertainment content' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/entertainment/manage/[contentId]
 * Delete restaurant-specific entertainment content.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  try {
    const { id: restaurantId, contentId } = await params
    const auth = requireAuth(request)

    // Require restaurant:manage permission + restaurant scope
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    // Find the content item
    const existing = await db.entertainmentContent.findUnique({
      where: { id: contentId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      )
    }

    // Verify it belongs to this restaurant
    if (existing.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.entertainmentContent.delete({
      where: { id: contentId },
    })

    return NextResponse.json({
      data: { id: contentId },
      message: 'Entertainment content deleted successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESTAURANT_ENTERTAINMENT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete entertainment content' },
      { status: 500 }
    )
  }
}
