// ============================================================
// Yene QR — Menu Item Image Upload API
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

/**
 * In standalone mode, process.cwd() points to .next/standalone/.
 * We also save to the source public/ directory so uploads survive rebuilds.
 */
const ROOT_DIR = process.env.PROJECT_ROOT || path.resolve(process.cwd(), '..', '..') || process.cwd()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: restaurantId, itemId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr
    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Process with sharp: resize to 800x800, convert to webp for efficiency
    const processed = await sharp(buffer)
      .resize(800, 800, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer()

    // Save to public directory (standalone cwd) AND source project root
    // so uploads survive the next `cp -r public .next/standalone/` build step.
    const filename = `${itemId}-${Date.now()}.webp`
    const imageUrl = `/uploads/menu-items/${filename}`

    const dirs = [
      path.join(process.cwd(), 'public', 'uploads', 'menu-items'),
      path.join(ROOT_DIR, 'public', 'uploads', 'menu-items'),
    ]

    for (const dir of dirs) {
      try {
        await mkdir(dir, { recursive: true })
        await writeFile(path.join(dir, filename), processed)
      } catch {
        // Destination may not exist — that's fine
      }
    }

    // Update menu item in database
    const { db } = await import('@/lib/db')

    // Verify the item belongs to this restaurant
    const existing = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await db.menuItem.update({
      where: { id: itemId },
      data: { image: imageUrl },
    })

    return NextResponse.json({ data: { imageUrl } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload image'
    console.error('[IMAGE_UPLOAD]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
