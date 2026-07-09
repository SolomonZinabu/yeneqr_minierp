// ============================================================
// Yene QR — QR Code Generation & Validation
// ============================================================

import crypto from 'crypto'
import QRCode from 'qrcode'

const QR_SECRET = (() => {
  // QR code signing is server-only; if running in the browser, no secret needed.
  if (typeof window !== 'undefined') return ''
  if (process.env.QR_SECRET) return process.env.QR_SECRET
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('FATAL: QR_SECRET env var required in production')
  }
  return 'yene-qr-hmac-secret-change-in-production'
})()

export interface QRPayload {
  rid: string  // restaurant ID
  bid: string  // branch ID
  tid: string  // table ID
  type: 'static' | 'dynamic' | 'temporary'
  iat: number  // issued at (epoch)
  exp: number | null  // expiration (epoch, null for static)
}

// ============================================================
// QR Code Generation
// ============================================================

export function generateQRPayload(
  restaurantId: string,
  branchId: string,
  tableId: string,
  type: 'static' | 'dynamic' | 'temporary' = 'static',
  expiresInHours: number | null = null
): { payload: QRPayload; signature: string } {
  const iat = Math.floor(Date.now() / 1000)
  const exp = type === 'temporary' && expiresInHours
    ? iat + (expiresInHours * 3600)
    : type === 'dynamic'
      ? iat + (24 * 3600) // Dynamic QRs expire in 24h by default
      : null

  const payload: QRPayload = { rid: restaurantId, bid: branchId, tid: tableId, type, iat, exp }
  const signature = signPayload(payload)

  return { payload, signature }
}

export function signPayload(payload: QRPayload): string {
  const data = `${payload.rid}:${payload.bid}:${payload.tid}:${payload.type}:${payload.iat}:${payload.exp || 'none'}`
  return crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex')
}

export function verifyQRSignature(payload: QRPayload, signature: string): boolean {
  const expected = signPayload(payload)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export function isQRExpired(payload: QRPayload): boolean {
  if (!payload.exp) return false
  return Math.floor(Date.now() / 1000) > payload.exp
}

// ============================================================
// QR Code Image Generation
// ============================================================

export interface QRStyleOptions {
  style?: 'classic' | 'rounded' | 'dots' | 'ethiopian' | 'branded' | 'artistic' | 'ethiopian_dam' | 'minimal' | 'golden' | 'coffee'
  fgColor?: string
  bgColor?: string
  logoUrl?: string
  errorCorrection?: 'L' | 'M' | 'Q' | 'H'
}

/** Predefined QR style templates */
const QR_TEMPLATES: Record<string, { fgColor: string; bgColor: string; errorCorrection: 'L' | 'M' | 'Q' | 'H' }> = {
  classic:       { fgColor: '#039D55', bgColor: '#FFFFFF', errorCorrection: 'H' },
  rounded:       { fgColor: '#1E293B', bgColor: '#FFFFFF', errorCorrection: 'H' },
  dots:          { fgColor: '#7C3AED', bgColor: '#FFFFFF', errorCorrection: 'H' },
  ethiopian:     { fgColor: '#078930', bgColor: '#FCDD09', errorCorrection: 'H' }, // Green on Gold (Ethiopian flag)
  branded:       { fgColor: '#039D55', bgColor: '#FFFFFF', errorCorrection: 'H' }, // Logo overlay, same brand green
  artistic:      { fgColor: '#1E293B', bgColor: '#FFFFFF', errorCorrection: 'H' }, // Creative with image overlay
  ethiopian_dam: { fgColor: '#078930', bgColor: '#E8F5E9', errorCorrection: 'H' }, // Ethiopian Renaissance Dam theme
  minimal:       { fgColor: '#374151', bgColor: '#F9FAFB', errorCorrection: 'H' }, // Ultra-clean minimal
  golden:        { fgColor: '#D4AF37', bgColor: '#1A1A1A', errorCorrection: 'H' }, // Luxurious gold on black
  coffee:        { fgColor: '#6F4E37', bgColor: '#FFF8F0', errorCorrection: 'H' }, // Warm Ethiopian coffee tones
}

/**
 * Overlay a logo image onto the center of a QR code PNG buffer.
 * Uses sharp for compositing — the QR code must use error correction H
 * to remain scannable after the logo overlay.
 */
async function overlayLogo(qrBuffer: Buffer, logoBuffer: Buffer, qrSize: number): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  // Logo should be ~25% of the QR code size, with padding
  const logoSize = Math.floor(qrSize * 0.25)
  const padding = Math.floor(qrSize * 0.02)

  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: 'cover' })
    .png()
    .toBuffer()

  // Create a white rounded background for the logo
  const bgSize = logoSize + padding * 2
  const logoBg = await sharp({
    create: {
      width: bgSize,
      height: bgSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    }
  })
    .composite([{
      input: resizedLogo,
      left: padding,
      top: padding,
    }])
    .png()
    .toBuffer()

  // Composite logo onto center of QR code
  const centerOffset = Math.floor((qrSize - bgSize) / 2)
  return sharp(qrBuffer)
    .composite([{
      input: logoBg,
      left: centerOffset,
      top: centerOffset,
    }])
    .png()
    .toBuffer()
}

export async function generateQRCodeImage(data: string, styleOptions?: QRStyleOptions): Promise<string> {
  const template = QR_TEMPLATES[styleOptions?.style || 'classic'] || QR_TEMPLATES.classic
  const fgColor = styleOptions?.fgColor || template.fgColor
  const bgColor = styleOptions?.bgColor || template.bgColor
  const errorCorrection = styleOptions?.errorCorrection || template.errorCorrection
  const width = 512

  // Generate base QR code as PNG buffer
  const qrBuffer = await QRCode.toBuffer(data, {
    width,
    margin: 2,
    errorCorrectionLevel: errorCorrection,
    color: {
      dark: fgColor,
      light: bgColor,
    },
  })

  // If logo is provided, overlay it
  if (styleOptions?.logoUrl) {
    try {
      const logoRes = await fetch(styleOptions.logoUrl)
      if (logoRes.ok) {
        const arrayBuf = await logoRes.arrayBuffer()
        const logoBuffer = Buffer.from(arrayBuf)
        const finalBuffer = await overlayLogo(qrBuffer, logoBuffer, width)
        return `data:image/png;base64,${finalBuffer.toString('base64')}`
      }
    } catch {
      // Logo fetch/overlay failed — return QR without logo
    }
  }

  return `data:image/png;base64,${qrBuffer.toString('base64')}`
}

export async function generateQRCodeBuffer(data: string, styleOptions?: QRStyleOptions): Promise<Buffer> {
  const template = QR_TEMPLATES[styleOptions?.style || 'classic'] || QR_TEMPLATES.classic
  const fgColor = styleOptions?.fgColor || template.fgColor
  const bgColor = styleOptions?.bgColor || template.bgColor
  const errorCorrection = styleOptions?.errorCorrection || template.errorCorrection
  const width = 512

  const qrBuffer = await QRCode.toBuffer(data, {
    width,
    margin: 2,
    errorCorrectionLevel: errorCorrection,
    color: {
      dark: fgColor,
      light: bgColor,
    },
  })

  if (styleOptions?.logoUrl) {
    try {
      const logoRes = await fetch(styleOptions.logoUrl)
      if (logoRes.ok) {
        const arrayBuf = await logoRes.arrayBuffer()
        const logoBuffer = Buffer.from(arrayBuf)
        return overlayLogo(qrBuffer, logoBuffer, width)
      }
    } catch {
      // Logo fetch/overlay failed — return QR without logo
    }
  }

  return qrBuffer
}

// ============================================================
// QR Code URL Construction
// ============================================================

export function buildQRUrl(baseUrl: string, payload: QRPayload, signature: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  // Use '--' separator (not '.') to avoid Next.js standalone server routing issues
  // where dots in dynamic path segments can be misinterpreted as file extensions
  return `${baseUrl}/menu/${encodedPayload}--${signature}`
}

export function parseQRUrl(qrPath: string): { payload: QRPayload; signature: string } | null {
  try {
    // Format: /menu/<base64payload>--<signature>
    // Legacy format: /menu/<base64payload>.<signature> (also supported for backwards compat)
    let encodedPayload: string | undefined
    let signature: string | undefined

    // Try new '--' separator first
    const dashMatch = qrPath.match(/^\/menu\/(.+)--([a-f0-9]+)$/)
    if (dashMatch) {
      [, encodedPayload, signature] = dashMatch
    } else {
      // Fallback to legacy '.' separator
      const dotMatch = qrPath.match(/^\/menu\/([^.]+)\.(.+)$/)  
      if (dotMatch) {
        [, encodedPayload, signature] = dotMatch
      }
    }

    if (!encodedPayload || !signature) return null

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as QRPayload

    return { payload, signature }
  } catch {
    return null
  }
}

// ============================================================
// Session Token Generation (for customer sessions)
// ============================================================

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
