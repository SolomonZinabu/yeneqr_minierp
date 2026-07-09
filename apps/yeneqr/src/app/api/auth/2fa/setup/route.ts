// ============================================================
// Yene QR — 2FA Setup API
// POST: Enable 2FA, returns secret + QR code URL
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { generateTOTPSecret, generateTOTPQRCodeUrl, generateBackupCodes, verifyTOTPCode } from '@/lib/two-factor'

/**
 * POST /api/auth/2fa/setup
 * Step 1: Generate TOTP secret and QR code URL for the user.
 * Body: { }  (just needs auth)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)

    // Generate TOTP secret
    const secret = generateTOTPSecret()

    // Generate backup codes
    const backupCodes = generateBackupCodes(10)

    // Get user email for the QR code
    let email = auth.userId // fallback
    if (auth.type === 'staff') {
      const user = await db.restaurantUser.findUnique({ where: { id: auth.userId } })
      if (user) email = user.email
    } else if (auth.type === 'admin') {
      const admin = await db.superAdmin.findUnique({ where: { id: auth.userId } })
      if (admin) email = admin.email
    }

    // Generate QR code URL for authenticator app
    const qrCodeUrl = generateTOTPQRCodeUrl(email, secret)

    // Store secret temporarily (NOT enabling 2FA yet — user must verify first)
    if (auth.type === 'staff') {
      await db.restaurantUser.update({
        where: { id: auth.userId },
        data: {
          twoFactorSecret: secret,
          twoFactorBackupCodes: JSON.stringify(backupCodes),
        },
      })
    } else if (auth.type === 'admin') {
      await db.superAdmin.update({
        where: { id: auth.userId },
        data: {
          twoFactorSecret: secret,
          twoFactorBackupCodes: JSON.stringify(backupCodes),
        },
      })
    }

    return NextResponse.json({
      secret,
      qrCodeUrl,
      backupCodes,
      message: 'Scan the QR code with your authenticator app, then verify with a code to enable 2FA.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[2FA_SETUP]', error)
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/auth/2fa/setup
 * Step 2: Verify the TOTP code and enable 2FA.
 * Body: { code: "123456" }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)

    const body = await request.json()
    const { code } = body as { code: string }

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      )
    }

    // Get the stored secret
    let secret: string | null = null
    if (auth.type === 'staff') {
      const user = await db.restaurantUser.findUnique({ where: { id: auth.userId } })
      secret = user?.twoFactorSecret || null
    } else if (auth.type === 'admin') {
      const admin = await db.superAdmin.findUnique({ where: { id: auth.userId } })
      secret = admin?.twoFactorSecret || null
    }

    if (!secret) {
      return NextResponse.json(
        { error: '2FA setup not initiated. Please start setup first.' },
        { status: 400 }
      )
    }

    // Verify the TOTP code
    const isValid = verifyTOTPCode(secret, code)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      )
    }

    // Enable 2FA
    if (auth.type === 'staff') {
      await db.restaurantUser.update({
        where: { id: auth.userId },
        data: { twoFactorEnabled: true },
      })
    } else if (auth.type === 'admin') {
      await db.superAdmin.update({
        where: { id: auth.userId },
        data: { twoFactorEnabled: true },
      })
    }

    return NextResponse.json({
      message: '2FA has been enabled successfully!',
      enabled: true,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[2FA_SETUP_VERIFY]', error)
    return NextResponse.json(
      { error: 'Failed to verify and enable 2FA' },
      { status: 500 }
    )
  }
}
