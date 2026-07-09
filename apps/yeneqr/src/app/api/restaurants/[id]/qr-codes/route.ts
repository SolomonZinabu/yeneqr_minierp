// ============================================================
// Yene QR — QR Codes API (List & Generate)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { generateQRPayload, generateQRCodeImage, buildQRUrl, type QRPayload, type QRStyleOptions } from '@/lib/qr'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/restaurants/[id]/qr-codes
 * List QR codes for a restaurant.
 * Query params: branchId, type, isActive
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check for non-customer users
    if (auth.type === 'customer') {
      if (auth.restaurantId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const permErr = requirePerm(auth, 'qr:view', id)
      if (permErr) return permErr
    }

    // Verify restaurant exists
    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const type = searchParams.get('type') || undefined
    const isActiveParam = searchParams.get('isActive')
    const withImages = searchParams.get('withImages') !== 'false' // default true

    const where: Record<string, unknown> = { restaurantId: id }
    if (branchId) {
      where.branchId = branchId
    }
    if (type) {
      where.type = type
    }
    if (isActiveParam !== null && isActiveParam !== undefined) {
      where.isActive = isActiveParam === 'true'
    }

    const qrCodes = await db.qRCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        table: {
          select: {
            id: true,
            number: true,
            capacity: true,
            status: true,
            floor: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
        },
        menu: {
          select: {
            id: true,
            name: true,
            nameAm: true,
            isActive: true,
          },
        },
      },
    })

    // Enrich each QR code with qrUrl (lightweight — just string construction)
    // and optionally imageDataUrl (heavy — requires QR image generation)
    const host = request.headers.get('host') || ''
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

    if (withImages) {
      const enriched = await Promise.all(
        qrCodes.map(async (qr) => {
          try {
            const payload: QRPayload = JSON.parse(qr.payload)
            const qrUrl = buildQRUrl(baseUrl, payload, qr.signature)
            const styleOptions: QRStyleOptions = {
              style: (qr.style as QRStyleOptions['style']) || undefined,
              fgColor: qr.fgColor || undefined,
              bgColor: qr.bgColor || undefined,
              logoUrl: qr.logoUrl || undefined,
              errorCorrection: (qr.errorCorrection as QRStyleOptions['errorCorrection']) || undefined,
            }
            const imageDataUrl = await generateQRCodeImage(qrUrl, styleOptions)
            return { ...qr, imageDataUrl, qrUrl }
          } catch {
            // If image generation fails for one QR, still return the record
            return qr
          }
        })
      )

      return NextResponse.json({ data: enriched })
    }

    // Always include qrUrl even without images
    const enrichedNoImages = qrCodes.map((qr) => {
      try {
        const payload: QRPayload = JSON.parse(qr.payload)
        const qrUrl = buildQRUrl(baseUrl, payload, qr.signature)
        return { ...qr, qrUrl }
      } catch {
        return qr
      }
    })

    return NextResponse.json({ data: enrichedNoImages })
  } catch (error) {
    console.error('[QR_CODES_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch QR codes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/qr-codes
 * Generate a QR code for a table.
 * Body: { tableId, type: 'static'|'dynamic'|'temporary' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ── Rate Limiting ──
    const clientIp = getClientIp(request)
    const rateLimitKey = `qrCode:${clientIp}:${id}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.api)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many QR code requests. Please try again later.', retryAfterMs: rateLimitResult.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const auth = requireAuth(request)

    // Permission check: qr:manage required
    const permErr = requirePerm(auth, 'qr:manage', id)
    if (permErr) return permErr

    // Verify restaurant exists
    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { tableId, type, style, fgColor, bgColor, logoUrl, errorCorrection, menuId } = body

    if (!tableId) {
      return NextResponse.json(
        { error: 'tableId is required' },
        { status: 400 }
      )
    }

    const qrType = type || 'static'
    const validTypes = ['static', 'dynamic', 'temporary']
    if (!validTypes.includes(qrType)) {
      return NextResponse.json(
        { error: `Invalid QR type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate style params
    const validStyles = ['classic', 'rounded', 'dots', 'ethiopian', 'branded', 'artistic', 'ethiopian_dam', 'minimal', 'golden', 'coffee']
    const qrStyle = validStyles.includes(style) ? style : 'classic'
    const qrFgColor = fgColor || undefined
    const qrBgColor = bgColor || undefined
    const logoSupportingStyles = ['branded', 'artistic', 'ethiopian_dam', 'golden', 'coffee']
    const qrLogoUrl = logoUrl || (logoSupportingStyles.includes(qrStyle) ? restaurant.logo : undefined)
    const qrErrorCorrection = ['L', 'M', 'Q', 'H'].includes(errorCorrection) ? errorCorrection : 'H'

    // Verify table exists and belongs to this restaurant
    const table = await db.table.findFirst({
      where: {
        id: tableId,
        branch: { restaurantId: id },
        isActive: true,
      },
      include: { branch: true },
    })
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found or inactive' },
        { status: 404 }
      )
    }

    // Check if table already has an active QR code
    const existingActiveQR = await db.qRCode.findFirst({
      where: { tableId, isActive: true },
    })
    if (existingActiveQR) {
      return NextResponse.json(
        { error: 'Table already has an active QR code. Deactivate it first.' },
        { status: 409 }
      )
    }

    // Check if table has an inactive QR code (from previous deactivation)
    // If so, we'll reactivate it with a fresh payload instead of creating a new record
    // (avoids violating the tableId @unique constraint)
    const existingInactiveQR = await db.qRCode.findFirst({
      where: { tableId, isActive: false },
    })

    // Generate QR payload and signature
    const { payload, signature } = generateQRPayload(
      id,
      table.branchId,
      tableId,
      qrType as 'static' | 'dynamic' | 'temporary',
      qrType === 'temporary' ? 4 : null // Temporary QRs expire in 4 hours
    )

    // Build QR URL — derive from request Host header so QR codes work in any deployment
    const host = request.headers.get('host') || ''
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
    const qrUrl = buildQRUrl(baseUrl, payload, signature)

    // Generate QR code image with style
    const styleOptions: QRStyleOptions = {
      style: qrStyle as QRStyleOptions['style'],
      fgColor: qrFgColor,
      bgColor: qrBgColor,
      logoUrl: qrLogoUrl,
      errorCorrection: qrErrorCorrection as QRStyleOptions['errorCorrection'],
    }
    const imageDataUrl = await generateQRCodeImage(qrUrl, styleOptions)

    // Validate menuId if provided, or inherit from table
    let validatedMenuId: string | null = null
    const effectiveMenuId = menuId || table.menuId // Inherit from table if not explicitly provided
    if (effectiveMenuId) {
      const menu = await db.menu.findFirst({
        where: { id: effectiveMenuId, restaurantId: id, isActive: true },
      })
      if (!menu) {
        return NextResponse.json(
          { error: 'Menu not found or inactive' },
          { status: 400 }
        )
      }
      validatedMenuId = effectiveMenuId
    }

    // Create or reactivate QR code record in database
    const expiresAt = payload.exp
      ? new Date(payload.exp * 1000)
      : null

    let qrCode

    if (existingInactiveQR) {
      // Reactivate the existing inactive QR code with a fresh payload
      qrCode = await db.qRCode.update({
        where: { id: existingInactiveQR.id },
        data: {
          isActive: true,
          type: qrType,
          payload: JSON.stringify(payload),
          signature,
          expiresAt,
          menuId: validatedMenuId,
          style: qrStyle,
          fgColor: qrFgColor,
          bgColor: qrBgColor,
          logoUrl: qrLogoUrl,
          errorCorrection: qrErrorCorrection,
          scanCount: 0, // Reset scan count on reactivation
        },
        include: {
          table: {
            select: {
              id: true,
              number: true,
              capacity: true,
              floor: { select: { id: true, name: true } },
            },
          },
        },
      })
    } else {
      // No existing QR code for this table — create a new one
      qrCode = await db.qRCode.create({
        data: {
          tableId,
          restaurantId: id,
          branchId: table.branchId,
          type: qrType,
          payload: JSON.stringify(payload),
          signature,
          expiresAt,
          menuId: validatedMenuId,
          style: qrStyle,
          fgColor: qrFgColor,
          bgColor: qrBgColor,
          logoUrl: qrLogoUrl,
          errorCorrection: qrErrorCorrection,
        },
        include: {
          table: {
            select: {
              id: true,
              number: true,
              capacity: true,
              floor: { select: { id: true, name: true } },
            },
          },
        },
      })
    }

    return NextResponse.json({
      data: {
        ...qrCode,
        imageDataUrl,
        qrUrl,
      },
    }, { status: existingInactiveQR ? 200 : 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[QR_CODE_GENERATE]', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}
