// ============================================================
// Yene QR — Admin Entertainment Content Detail API
// PUT: Update platform-wide content (super admin only)
// DELETE: Delete platform-wide content (super admin only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

const VALID_TYPES = ['fact', 'story', 'read', 'trivia_question', 'game_config']
const VALID_CATEGORIES = ['food', 'culture', 'science', 'history', 'general']

/**
 * PUT /api/admin/entertainment/[contentId]
 * Update platform-wide entertainment content (super admin only).
 *
 * Body: {
 *   type?, category?, title?, titleI18n?, content?, contentI18n?,
 *   imageUrl?, metadata?, sortOrder?, isActive?
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
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

    // Verify it is platform-wide content
    if (existing.restaurantId !== null) {
      return NextResponse.json(
        { error: 'This endpoint is for platform-wide content only. Use the restaurant endpoint for restaurant-specific content.' },
        { status: 400 }
      )
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
    console.error('[ADMIN_ENTERTAINMENT_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update entertainment content' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/entertainment/[contentId]
 * Delete platform-wide entertainment content (super admin only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
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

    // Verify it is platform-wide content
    if (existing.restaurantId !== null) {
      return NextResponse.json(
        { error: 'This endpoint is for platform-wide content only. Use the restaurant endpoint for restaurant-specific content.' },
        { status: 400 }
      )
    }

    await db.entertainmentContent.delete({
      where: { id: contentId },
    })

    return NextResponse.json({
      data: { id: contentId },
      message: 'Platform entertainment content deleted successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_ENTERTAINMENT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete entertainment content' },
      { status: 500 }
    )
  }
}
