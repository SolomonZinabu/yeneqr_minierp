// ============================================================
// Yene QR — Two-Factor Authentication (TOTP)
// ============================================================
// TOTP (Time-based One-Time Password) implementation compatible
// with Google Authenticator, Authy, etc.

import { createHmac, randomBytes } from 'crypto'

const TOTP_WINDOW = 30 // 30 seconds
const TOTP_DIGITS = 6

// -------------------------------------------------------
// TOTP Secret & Code Generation
// -------------------------------------------------------

export function generateTOTPSecret(): string {
  return randomBytes(20).toString('base64')
}

export function generateTOTPCode(secret: string, time?: number): string {
  const t = Math.floor((time || Date.now()) / 1000 / TOTP_WINDOW)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(t / 0x100000000), 0)
  buffer.writeUInt32BE(t & 0xffffffff, 4)

  const hmac = createHmac('sha1', Buffer.from(secret, 'base64'))
  hmac.update(buffer)
  const digest = hmac.digest()

  const offset = digest[digest.length - 1] & 0x0f
  const code = digest.readUInt32BE(offset) & 0x7fffffff
  return (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0')
}

// -------------------------------------------------------
// TOTP Verification
// -------------------------------------------------------

export function verifyTOTPCode(secret: string, code: string, window: number = 1): boolean {
  const now = Date.now()
  for (let i = -window; i <= window; i++) {
    const testTime = now + i * TOTP_WINDOW * 1000
    if (generateTOTPCode(secret, testTime) === code) return true
  }
  return false
}

// -------------------------------------------------------
// Backup Codes
// -------------------------------------------------------

export function generateBackupCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(4).toString('hex').toUpperCase().match(/.{4}/g)?.join('-') || ''
  )
}

export function verifyBackupCode(backupCodesJson: string, code: string): { valid: boolean; remaining: string[] } {
  try {
    const codes: string[] = JSON.parse(backupCodesJson)
    const index = codes.indexOf(code.toUpperCase())
    if (index === -1) {
      return { valid: false, remaining: codes }
    }
    // Remove the used backup code
    const remaining = [...codes.slice(0, index), ...codes.slice(index + 1)]
    return { valid: true, remaining }
  } catch {
    return { valid: false, remaining: [] }
  }
}

// -------------------------------------------------------
// QR Code URL for Authenticator Apps
// -------------------------------------------------------

export function generateTOTPQRCodeUrl(email: string, secret: string, issuer: string = 'Yene QR'): string {
  // otpauth://totp/Issuer:email?secret=BASE32&issuer=Issuer
  // Note: Google Authenticator expects base32-encoded secrets
  const base32Secret = base64ToBase32(secret)
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${base32Secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_WINDOW}`
}

// -------------------------------------------------------
// Base64 → Base32 conversion
// -------------------------------------------------------

function base64ToBase32(base64: string): string {
  const buffer = Buffer.from(base64, 'base64')
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  let result = ''

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0')
  }

  for (let i = 0; i + 5 <= bits.length; i += 5) {
    const chunk = parseInt(bits.slice(i, i + 5), 2)
    result += base32Chars[chunk]
  }

  return result
}
