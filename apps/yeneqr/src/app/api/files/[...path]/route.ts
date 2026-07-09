// ============================================================
// Yene QR — File Serving API (for uploaded images)
// ============================================================
// In standalone mode, Next.js does NOT serve runtime-created
// files from public/. This route bridges that gap by reading
// uploaded files from disk and returning them as responses.
//
// Handles URLs like:
//   /api/files/uploads/menu-items/xxx.webp  (from rewrite of /uploads/...)
//   /api/files/images/menu/xxx.png          (direct access)

import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import path from 'path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
// Fallback: also check the source project root (in case cwd is .next/standalone/)
const ROOT_DIR = process.env.PROJECT_ROOT || path.resolve(process.cwd(), '..', '..') || process.cwd()
const ROOT_PUBLIC_DIR = path.join(ROOT_DIR, 'public')

const MIME_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

// Allowed subdirectories under public/
const ALLOWED_DIRS = ['uploads', 'images']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params
    const filePath = segments.join('/')

    // Security: only serve files from allowed subdirectories
    const firstSegment = segments[0]
    if (!firstSegment || !ALLOWED_DIRS.includes(firstSegment)) {
      return NextResponse.json({ error: 'Forbidden path' }, { status: 403 })
    }

    // Build full path — try standalone cwd first, then source project root as fallback
    const standalonePath = path.join(PUBLIC_DIR, filePath)
    const sourcePath = path.join(ROOT_PUBLIC_DIR, filePath)

    // Try standalone first, then source root
    let normalizedPath: string | null = null
    let fileStat: Awaited<ReturnType<typeof stat>> | null = null

    for (const candidate of [standalonePath, sourcePath]) {
      const normalized = path.normalize(candidate)
      const normalizedPublicDir = candidate === standalonePath
        ? path.normalize(PUBLIC_DIR)
        : path.normalize(ROOT_PUBLIC_DIR)

      if (!normalized.startsWith(normalizedPublicDir)) continue

      try {
        const stat_ = await stat(normalized)
        if (stat_.isFile()) {
          normalizedPath = normalized
          fileStat = stat_
          break
        }
      } catch {
        // Not found in this location — try the next
      }
    }

    if (!normalizedPath || !fileStat) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const buffer = await readFile(normalizedPath)

    // Determine content type
    const ext = path.extname(normalizedPath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to serve file'
    console.error('[FILE_SERVE]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
