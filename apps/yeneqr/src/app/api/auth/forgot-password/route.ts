// ============================================================
// Yene QR — Forgot Password API Route
// POST /api/auth/forgot-password
// Generates a password reset token for any user type
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build'
    ? (() => { throw new Error('FATAL: JWT_SECRET env var required in production') })()
    : 'yene-qr-dev-secret-change-in-production'
)

interface PasswordResetToken {
  userId: string
  email: string
  userType: 'restaurant_user' | 'super_admin' | 'support_admin'
  type: 'password_reset'
}

export async function POST(request: NextRequest) {
  try {
    // ── Rate Limiting ──
    const clientIp = getClientIp(request)
    const rateLimitKey = `forgotPassword:${clientIp}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.register)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.', retryAfterMs: rateLimitResult.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 3600000) / 1000)) } }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Look up user across all user tables
    // We always return success to prevent email enumeration

    let foundUser: { id: string; email: string; name: string } | null = null
    let userType: 'restaurant_user' | 'super_admin' | 'support_admin' | null = null

    // Try RestaurantUser
    const restaurantUser = await db.restaurantUser.findFirst({
      where: { email },
    })
    if (restaurantUser) {
      foundUser = { id: restaurantUser.id, email: restaurantUser.email, name: restaurantUser.name }
      userType = 'restaurant_user'
    }

    // Try SuperAdmin
    if (!foundUser) {
      const superAdmin = await db.superAdmin.findUnique({ where: { email } })
      if (superAdmin) {
        foundUser = { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name }
        userType = 'super_admin'
      }
    }

    // Try SupportAdmin
    if (!foundUser) {
      const supportAdmin = await db.supportAdmin.findUnique({ where: { email } })
      if (supportAdmin) {
        foundUser = { id: supportAdmin.id, email: supportAdmin.email, name: supportAdmin.name }
        userType = 'support_admin'
      }
    }

    if (foundUser && userType) {
      // Generate reset token (JWT with 1h expiry)
      const resetTokenPayload: PasswordResetToken = {
        userId: foundUser.id,
        email: foundUser.email,
        userType,
        type: 'password_reset',
      }

      const resetToken = jwt.sign(resetTokenPayload, JWT_SECRET, { expiresIn: '1h' })

      const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`

      // Send password reset email
      try {
        const htmlBody = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Reset Your Password</h2>
            <p style="color: #4a4a4a; line-height: 1.6;">Hello ${foundUser.name},</p>
            <p style="color: #4a4a4a; line-height: 1.6;">We received a request to reset your password for your Yene QR account. Click the button below to set a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #039D55; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
            </p>
            <p style="color: #4a4a4a; line-height: 1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #039D55; word-break: break-all;">${resetUrl}</p>
            <p style="color: #4a4a4a; line-height: 1.6;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">This is an automated message from Yene QR.</p>
          </div>
        `
        await sendEmail(foundUser.email, 'Yene QR — Reset Your Password', `Reset Your Password\n\nHello ${foundUser.name},\n\nWe received a request to reset your password for your Yene QR account.\n\nReset your password: ${resetUrl}\n\nThis link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.`, htmlBody)
      } catch (emailErr) {
        console.error('[FORGOT_PASSWORD_EMAIL_ERROR]', emailErr)
        // Don't expose email failure to client to prevent enumeration
      }

      // In development mode, still log the reset URL for testing
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FORGOT_PASSWORD] Reset link for ${foundUser.email}: ${resetUrl}`)
      }
    }

    // Always return success message to prevent email enumeration
    return NextResponse.json({
      message: 'If an account exists with this email, a reset link has been sent.',
      // In development mode, include the token for testing
      ...(process.env.NODE_ENV === 'development' && foundUser && {
        _dev_token: jwt.sign(
          { userId: foundUser.id, email: foundUser.email, userType, type: 'password_reset' as const },
          JWT_SECRET,
          { expiresIn: '1h' }
        ),
      }),
    })
  } catch (error) {
    console.error('[FORGOT_PASSWORD_ERROR]', error)
    // Still return success to prevent information leakage
    return NextResponse.json({
      message: 'If an account exists with this email, a reset link has been sent.',
    })
  }
}
