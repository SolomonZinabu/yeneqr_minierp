// ============================================================
// Yene QR — QR Code Detail API (GET, PUT, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { generateQRPayload, generateQRCodeImage, buildQRUrl, type QRPayload, type QRStyleOptions } from '@/lib/qr'

/**
 * GET /api/restaurants/[id]/qr-codes/[qrId]
 * Get QR code details with image.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qrId: string }> }
) {
  try {
    const { id, qrId } = await params
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
      const permErr = requirePerm(auth, 'qr:manage', id)
      if (permErr) return permErr
    }

    const qrCode = await db.qRCode.findFirst({
      where: { id: qrId, restaurantId: id },
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
      },
    })

    if (!qrCode) {
      return NextResponse.json(
        { error: 'QR code not found' },
        { status: 404 }
      )
    }

    // Reconstruct QR URL — derive from request Host header
    const payload: QRPayload = JSON.parse(qrCode.payload)
    const host = request.headers.get('host') || ''
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
    const qrUrl = buildQRUrl(baseUrl, payload, qrCode.signature)
    const styleOptions: QRStyleOptions = {
      style: (qrCode.style as QRStyleOptions['style']) || undefined,
      fgColor: qrCode.fgColor || undefined,
      bgColor: qrCode.bgColor || undefined,
      logoUrl: qrCode.logoUrl || undefined,
      errorCorrection: (qrCode.errorCorrection as QRStyleOptions['errorCorrection']) || undefined,
    }
    const imageDataUrl = await generateQRCodeImage(qrUrl, styleOptions)

    return NextResponse.json({
      data: {
        ...qrCode,
        imageDataUrl,
        qrUrl,
        isExpired: qrCode.expiresAt ? new Date() > qrCode.expiresAt : false,
      },
    })
  } catch (error) {
    console.error('[QR_CODE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch QR code' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/qr-codes/[qrId]
 * Regenerate a QR code (now supports all types including static) and/or update style.
 * Body: { action: 'regenerate', style?, fgColor?, bgColor?, logoUrl?, errorCorrection? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qrId: string }> }
) {
  try {
    const { id, qrId } = await params
    const auth = requireAuth(request)

    // Permission check: qr:manage required
    const permErr = requirePerm(auth, 'qr:manage', id)
    if (permErr) return permErr

    const existing = await db.qRCode.findFirst({
      where: { id: qrId, restaurantId: id, isActive: true },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'QR code not found or inactive' },
        { status: 404 }
      )
    }

    // Verify branch access — branch-scoped staff can only manage QR codes at their branch
    if (existing.branchId) {
      const branchErr = verifyBranchAccess(auth, existing.branchId, id)
      if (branchErr) return branchErr
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const action = body.action as string | undefined

    // Parse style update fields
    const validStyles = ['classic', 'rounded', 'dots', 'ethiopian', 'branded', 'artistic', 'ethiopian_dam', 'minimal', 'golden', 'coffee']
    const newStyle = validStyles.includes(body.style as string) ? body.style as string : existing.style
    const newFgColor = (body.fgColor as string) || existing.fgColor
    const newBgColor = (body.bgColor as string) || existing.bgColor
    const restaurant = await db.restaurant.findUnique({ where: { id }, select: { logo: true } })
    const logoSupportingStyles = ['branded', 'artistic', 'ethiopian_dam', 'golden', 'coffee']
    const newLogoUrl = (body.logoUrl as string) || existing.logoUrl || (logoSupportingStyles.includes(newStyle) ? restaurant?.logo : undefined)
    const validEC = ['L', 'M', 'Q', 'H']
    const newErrorCorrection = validEC.includes(body.errorCorrection as string) ? body.errorCorrection as string : existing.errorCorrection

    // Parse menuId update (can be set to null to clear assignment)
    let newMenuId: string | null = existing.menuId
    if (body.menuId !== undefined) {
      if (body.menuId === null || body.menuId === '') {
        newMenuId = null
      } else {
        // Validate the menu exists and is active
        const menu = await db.menu.findFirst({
          where: { id: body.menuId as string, restaurantId: id, isActive: true },
        })
        if (!menu) {
          return NextResponse.json(
            { error: 'Menu not found or inactive' },
            { status: 400 }
          )
        }
        newMenuId = body.menuId as string
      }
    }

    // ── Regenerate payload (all types including static) ──
    if (action === 'regenerate') {
      const qrType = existing.type as 'static' | 'dynamic' | 'temporary'
      const { payload, signature } = generateQRPayload(
        existing.restaurantId,
        existing.branchId,
        existing.tableId,
        qrType,
        qrType === 'temporary' ? 4 : qrType === 'dynamic' ? 24 : null
      )

      const host = request.headers.get('host') || ''
      const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
      const baseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      const qrUrl = buildQRUrl(baseUrl, payload, signature)

      const styleOptions: QRStyleOptions = {
        style: newStyle as QRStyleOptions['style'],
        fgColor: newFgColor || undefined,
        bgColor: newBgColor || undefined,
        logoUrl: newLogoUrl || undefined,
        errorCorrection: newErrorCorrection as QRStyleOptions['errorCorrection'],
      }
      const imageDataUrl = await generateQRCodeImage(qrUrl, styleOptions)

      const expiresAt = payload.exp
        ? new Date(payload.exp * 1000)
        : null

      const updated = await db.qRCode.update({
        where: { id: qrId },
        data: {
          payload: JSON.stringify(payload),
          signature,
          expiresAt,
          menuId: newMenuId,
          style: newStyle,
          fgColor: newFgColor,
          bgColor: newBgColor,
          logoUrl: newLogoUrl,
          errorCorrection: newErrorCorrection,
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

      return NextResponse.json({
        data: {
          ...updated,
          imageDataUrl,
          qrUrl,
        },
        message: 'QR code regenerated successfully',
      })
    }

    // ── Style update only (no payload regeneration) ──
    const currentPayload: QRPayload = JSON.parse(existing.payload)
    const host = request.headers.get('host') || ''
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
    const qrUrl = buildQRUrl(baseUrl, currentPayload, existing.signature)

    const styleOptions: QRStyleOptions = {
      style: newStyle as QRStyleOptions['style'],
      fgColor: newFgColor || undefined,
      bgColor: newBgColor || undefined,
      logoUrl: newLogoUrl || undefined,
      errorCorrection: newErrorCorrection as QRStyleOptions['errorCorrection'],
    }
    const imageDataUrl = await generateQRCodeImage(qrUrl, styleOptions)

    const updated = await db.qRCode.update({
      where: { id: qrId },
      data: {
        menuId: newMenuId,
        style: newStyle,
        fgColor: newFgColor,
        bgColor: newBgColor,
        logoUrl: newLogoUrl,
        errorCorrection: newErrorCorrection,
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

    return NextResponse.json({
      data: {
        ...updated,
        imageDataUrl,
        qrUrl,
      },
      message: 'QR code style updated',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[QR_CODE_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update QR code' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/restaurants/[id]/qr-codes/[qrId]
 * Reactivate a deactivated QR code, or toggle its active status.
 * Body: { action: 'activate' | 'deactivate' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qrId: string }> }
) {
  try {
    const { id, qrId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'qr:manage', id)
    if (permErr) return permErr

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const action = body.action as string | undefined

    if (!action || !['activate', 'deactivate'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "activate" or "deactivate"' },
        { status: 400 }
      )
    }

    const existing = await db.qRCode.findFirst({
      where: { id: qrId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'QR code not found' },
        { status: 404 }
      )
    }

    // Determine the new active state
    const newIsActive = action === 'activate'

    if (existing.isActive === newIsActive) {
      return NextResponse.json(
        { error: `QR code is already ${newIsActive ? 'active' : 'inactive'}` },
        { status: 400 }
      )
    }

    if (newIsActive) {
      // ── Activating ──
      // Just flip isActive back to true. We do NOT regenerate the payload/signature
      // because the printed QR codes on tables still encode the old signature.
      // Regenerating would break them (the session API cross-checks the scanned
      // signature against the DB record). The old signature is still cryptographically
      // valid (same IDs, same secret).
      const updated = await db.qRCode.update({
        where: { id: qrId },
        data: { isActive: true },
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

      // Rebuild the QR URL + image with the EXISTING payload & signature
      const existingPayload: QRPayload = JSON.parse(existing.payload)
      const host = request.headers.get('host') || ''
      const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
      const baseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      const qrUrl = buildQRUrl(baseUrl, existingPayload, existing.signature)

      const styleOptions: QRStyleOptions = {
        style: (updated.style as QRStyleOptions['style']) || undefined,
        fgColor: updated.fgColor || undefined,
        bgColor: updated.bgColor || undefined,
        logoUrl: updated.logoUrl || undefined,
        errorCorrection: (updated.errorCorrection as QRStyleOptions['errorCorrection']) || undefined,
      }
      const imageDataUrl = await generateQRCodeImage(qrUrl, styleOptions)

      return NextResponse.json({
        data: {
          ...updated,
          imageDataUrl,
          qrUrl,
        },
        message: 'QR code activated successfully. Existing printed QR codes will continue to work.',
      })
    }

    // ── Deactivating ──
    const updated = await db.qRCode.update({
      where: { id: qrId },
      data: { isActive: false },
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

    return NextResponse.json({
      data: updated,
      message: 'QR code deactivated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[QR_CODE_PATCH]', error)
    return NextResponse.json(
      { error: 'Failed to update QR code status' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]/qr-codes/[qrId]
 * Deactivate a QR code.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qrId: string }> }
) {
  try {
    const { id, qrId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'qr:manage', id)
    if (permErr) return permErr

    const existing = await db.qRCode.findFirst({
      where: { id: qrId, restaurantId: id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'QR code not found' },
        { status: 404 }
      )
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: 'QR code is already inactive' },
        { status: 400 }
      )
    }

    const updated = await db.qRCode.update({
      where: { id: qrId },
      data: { isActive: false },
    })

    return NextResponse.json({
      data: updated,
      message: 'QR code deactivated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[QR_CODE_DEACTIVATE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate QR code' },
      { status: 500 }
    )
  }
}
