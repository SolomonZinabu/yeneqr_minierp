// ============================================================
// Yene QR — 2FA Verify API
// POST: Verify TOTP code during login (after temp token)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, generateStaffToken, resolveUserPermissions, type TokenPayload } from '@/lib/auth'
import { verifyTOTPCode, verifyBackupCode } from '@/lib/two-factor'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/auth/2fa/verify
 * Verify TOTP code or backup code during login.
 * Body: { tempToken, code, isBackupCode? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tempToken, code, isBackupCode } = body as {
      tempToken: string
      code: string
      isBackupCode?: boolean
    }

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: 'tempToken and code are required' },
        { status: 400 }
      )
    }

    // Rate limit
    const clientIp = getClientIp(request)
    const rateLimitKey = `2fa:${clientIp}:${tempToken.slice(0, 20)}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.twoFactor)

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many 2FA attempts. Please try again later.',
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    // Verify temp token
    const payload = verifyToken(tempToken)
    if (!payload || payload.type !== '2fa_pending') {
      return NextResponse.json(
        { error: 'Invalid or expired temporary token. Please log in again.' },
        { status: 401 }
      )
    }

    const { userId, type: userType } = payload as { userId: string; type: string; email: string; role: string; restaurantId?: string }

    // Get user details and 2FA secret
    let secret: string | null = null
    let backupCodesJson: string | null = null
    let userData: {
      id: string
      name: string
      email: string
      phone: string | null
      avatar: string | null
      role: string
      restaurantId?: string
      branchId?: string | null
      permissions?: string | null
      additionalPermissions?: string | null
      revokedPermissions?: string | null
      restaurant?: { id: string; name: string; slug: string }
      branch?: { id: string; name: string } | null
    } | null = null

    if (userType === 'staff') {
      const user = await db.restaurantUser.findUnique({
        where: { id: userId },
        include: {
          restaurant: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
        },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      secret = user.twoFactorSecret
      backupCodesJson = user.twoFactorBackupCodes
      userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
        permissions: user.permissions,
        additionalPermissions: user.additionalPermissions,
        revokedPermissions: user.revokedPermissions,
        restaurant: user.restaurant,
        branch: user.branch,
      }
    } else if (userType === 'admin') {
      const admin = await db.superAdmin.findUnique({ where: { id: userId } })

      if (!admin) {
        return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
      }

      secret = admin.twoFactorSecret
      backupCodesJson = admin.twoFactorBackupCodes
      userData = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        avatar: admin.avatar,
        role: 'super_admin',
      }
    }

    if (!secret) {
      return NextResponse.json(
        { error: '2FA not configured for this account' },
        { status: 400 }
      )
    }

    // Verify the code
    let isVerified = false

    if (isBackupCode && backupCodesJson) {
      const result = verifyBackupCode(backupCodesJson, code)
      if (result.valid) {
        isVerified = true
        // Update backup codes (remove used one)
        if (userType === 'staff') {
          await db.restaurantUser.update({
            where: { id: userId },
            data: { twoFactorBackupCodes: JSON.stringify(result.remaining) },
          })
        } else if (userType === 'admin') {
          await db.superAdmin.update({
            where: { id: userId },
            data: { twoFactorBackupCodes: JSON.stringify(result.remaining) },
          })
        }
      }
    } else {
      isVerified = verifyTOTPCode(secret, code)
    }

    if (!isVerified) {
      return NextResponse.json(
        { error: isBackupCode ? 'Invalid backup code' : 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Generate the real authentication token
    const tokenPayload: TokenPayload = {
      userId: userData!.id,
      email: userData!.email,
      role: userData!.role,
      restaurantId: userData!.restaurantId,
      branchId: userData!.branchId || undefined,
      type: userType === 'admin' ? 'admin' : 'staff',
      permissions: resolveUserPermissions(userData!.role, userData!.permissions ? { permissions: JSON.parse(userData!.permissions), additionalPermissions: userData!.additionalPermissions ? JSON.parse(userData!.additionalPermissions) : undefined, revokedPermissions: userData!.revokedPermissions ? JSON.parse(userData!.revokedPermissions) : undefined } : undefined),
    }

    const token = generateStaffToken(tokenPayload)

    // Update last login
    if (userType === 'staff') {
      await db.restaurantUser.update({
        where: { id: userId },
        data: { lastLogin: new Date() },
      })
    } else if (userType === 'admin') {
      await db.superAdmin.update({
        where: { id: userId },
        data: { lastLogin: new Date() },
      })
    }

    return NextResponse.json({
      message: '2FA verification successful',
      token,
      user: {
        id: userData!.id,
        name: userData!.name,
        email: userData!.email,
        phone: userData!.phone,
        avatar: userData!.avatar,
        role: userData!.role,
        resolvedPermissions: tokenPayload.permissions,
        restaurant: userData!.restaurant || null,
        branch: userData!.branch || null,
      },
    })
  } catch (error) {
    console.error('[2FA_VERIFY_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred during 2FA verification.' },
      { status: 500 }
    )
  }
}
