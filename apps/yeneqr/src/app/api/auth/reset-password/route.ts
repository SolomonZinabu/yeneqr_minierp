// ============================================================
// Yene QR — Reset Password API Route
// POST /api/auth/reset-password
// Verifies reset token and updates user password
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
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
    const rateLimitKey = `resetPassword:${clientIp}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.twoFactor)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again later.', retryAfterMs: rateLimitResult.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 300000) / 1000)) } }
      )
    }

    const body = await request.json()
    const { token, password } = body

    // Validate required fields
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Verify and decode the token
    let decoded: PasswordResetToken
    try {
      decoded = jwt.verify(token, JWT_SECRET) as PasswordResetToken
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      )
    }

    // Verify token type
    if (decoded.type !== 'password_reset') {
      return NextResponse.json(
        { error: 'Invalid token type.' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password)

    // Update password based on user type
    switch (decoded.userType) {
      case 'restaurant_user': {
        const user = await db.restaurantUser.findUnique({
          where: { id: decoded.userId },
        })
        if (!user) {
          return NextResponse.json(
            { error: 'User not found.' },
            { status: 404 }
          )
        }
        // Verify email matches for extra security
        if (user.email !== decoded.email) {
          return NextResponse.json(
            { error: 'Token mismatch. Please request a new reset link.' },
            { status: 400 }
          )
        }
        await db.restaurantUser.update({
          where: { id: decoded.userId },
          data: { password: hashedPassword },
        })
        break
      }

      case 'super_admin': {
        const admin = await db.superAdmin.findUnique({
          where: { id: decoded.userId },
        })
        if (!admin) {
          return NextResponse.json(
            { error: 'User not found.' },
            { status: 404 }
          )
        }
        if (admin.email !== decoded.email) {
          return NextResponse.json(
            { error: 'Token mismatch. Please request a new reset link.' },
            { status: 400 }
          )
        }
        await db.superAdmin.update({
          where: { id: decoded.userId },
          data: { password: hashedPassword },
        })
        break
      }

      case 'support_admin': {
        const supportAdmin = await db.supportAdmin.findUnique({
          where: { id: decoded.userId },
        })
        if (!supportAdmin) {
          return NextResponse.json(
            { error: 'User not found.' },
            { status: 404 }
          )
        }
        if (supportAdmin.email !== decoded.email) {
          return NextResponse.json(
            { error: 'Token mismatch. Please request a new reset link.' },
            { status: 400 }
          )
        }
        await db.supportAdmin.update({
          where: { id: decoded.userId },
          data: { password: hashedPassword },
        })
        break
      }

      default:
        return NextResponse.json(
          { error: 'Invalid user type.' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    })
  } catch (error) {
    console.error('[RESET_PASSWORD_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
