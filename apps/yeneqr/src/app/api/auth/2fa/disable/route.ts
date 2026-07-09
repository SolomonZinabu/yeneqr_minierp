// ============================================================
// Yene QR — 2FA Disable API
// POST: Disable 2FA (requires current password verification)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { verifyPassword } from '@/lib/auth'

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA for the authenticated user.
 * Body: { password }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)

    const body = await request.json()
    const { password } = body as { password: string }

    if (!password) {
      return NextResponse.json(
        { error: 'Current password is required to disable 2FA' },
        { status: 400 }
      )
    }

    // Verify current password
    let storedHash: string | null = null

    if (auth.type === 'staff') {
      const user = await db.restaurantUser.findUnique({ where: { id: auth.userId } })
      storedHash = user?.password || null
    } else if (auth.type === 'admin') {
      const admin = await db.superAdmin.findUnique({ where: { id: auth.userId } })
      storedHash = admin?.password || null
    }

    if (!storedHash) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isPasswordValid = await verifyPassword(password, storedHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 401 }
      )
    }

    // Disable 2FA and clear secret
    if (auth.type === 'staff') {
      await db.restaurantUser.update({
        where: { id: auth.userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
        },
      })
    } else if (auth.type === 'admin') {
      await db.superAdmin.update({
        where: { id: auth.userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
        },
      })
    }

    return NextResponse.json({
      message: '2FA has been disabled successfully.',
      enabled: false,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[2FA_DISABLE]', error)
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    )
  }
}
