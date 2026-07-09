// ============================================================
// Yene QR — Staff Login API Route
// POST /api/auth/login
// Authenticates RestaurantUser, SuperAdmin, or SupportAdmin
// Supports 2FA — if enabled, returns tempToken for 2FA verify
// Accepts optional restaurantSlug to scope login to a specific restaurant
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, generateStaffToken, resolveUserPermissions, type TokenPayload } from '@/lib/auth'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build'
    ? (() => { throw new Error('FATAL: JWT_SECRET env var required in production') })()
    : 'yene-qr-dev-secret-change-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, restaurantSlug } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // ── Rate Limiting ──────────────────────────────────
    const clientIp = getClientIp(request)
    const rateLimitKey = `login:${clientIp}:${email}${restaurantSlug ? `:${restaurantSlug}` : ''}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.login)

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 900000) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    // ── Restaurant-scoped login ──────────────────────────
    // If restaurantSlug is provided, only look for users in THAT restaurant.
    // This resolves the ambiguity when the same email exists across restaurants.
    if (restaurantSlug) {
      const restaurant = await db.restaurant.findUnique({
        where: { slug: restaurantSlug },
        select: { id: true, name: true, slug: true, isActive: true, isSuspended: true },
      })

      if (!restaurant) {
        return NextResponse.json(
          { error: 'Restaurant not found. Please check your restaurant URL.' },
          { status: 404 }
        )
      }

      if (!restaurant.isActive) {
        return NextResponse.json(
          { error: 'Restaurant account is inactive.' },
          { status: 403 }
        )
      }

      if (restaurant.isSuspended) {
        return NextResponse.json(
          { error: 'Restaurant account is suspended. Contact support.' },
          { status: 403 }
        )
      }

      // Find user in this specific restaurant
      const restaurantUser = await db.restaurantUser.findFirst({
        where: { email, restaurantId: restaurant.id },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              isSuspended: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (restaurantUser) {
        // Check if user is active
        if (!restaurantUser.isActive) {
          return NextResponse.json(
            { error: 'Account is deactivated. Contact your administrator.' },
            { status: 403 }
          )
        }

        // Verify password
        const isValid = await verifyPassword(password, restaurantUser.password)
        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          )
        }

        // ── 2FA Check ──────────────────────────────────
        if (restaurantUser.twoFactorEnabled) {
          const tempToken = jwt.sign(
            {
              userId: restaurantUser.id,
              email: restaurantUser.email,
              role: restaurantUser.role,
              restaurantId: restaurantUser.restaurantId,
              branchId: restaurantUser.branchId || undefined,
              type: '2fa_pending',
            },
            JWT_SECRET,
            { expiresIn: '5m' }
          )

          return NextResponse.json({
            requires2FA: true,
            tempToken,
            message: 'Two-factor authentication is required. Please enter your verification code.',
            user: {
              email: restaurantUser.email,
              name: restaurantUser.name,
            },
          })
        }

        // Update last login
        await db.restaurantUser.update({
          where: { id: restaurantUser.id },
          data: { lastLogin: new Date() },
        })

        // Generate token with resolved permissions
        const userOverrides = {
          permissions: restaurantUser.permissions ? JSON.parse(restaurantUser.permissions) : undefined,
          additionalPermissions: restaurantUser.additionalPermissions ? JSON.parse(restaurantUser.additionalPermissions) : undefined,
          revokedPermissions: restaurantUser.revokedPermissions ? JSON.parse(restaurantUser.revokedPermissions) : undefined,
        }
        const resolvedPermissions = resolveUserPermissions(restaurantUser.role, userOverrides)

        const tokenPayload: TokenPayload = {
          userId: restaurantUser.id,
          email: restaurantUser.email,
          role: restaurantUser.role,
          restaurantId: restaurantUser.restaurantId,
          branchId: restaurantUser.branchId || undefined,
          type: 'staff',
          permissions: resolvedPermissions,
        }

        const token = generateStaffToken(tokenPayload)

        return NextResponse.json({
          message: 'Login successful',
          token,
          user: {
            id: restaurantUser.id,
            name: restaurantUser.name,
            email: restaurantUser.email,
            phone: restaurantUser.phone,
            avatar: restaurantUser.avatar,
            role: restaurantUser.role,
            permissions: restaurantUser.permissions ? JSON.parse(restaurantUser.permissions) : undefined,
            additionalPermissions: restaurantUser.additionalPermissions ? JSON.parse(restaurantUser.additionalPermissions) : undefined,
            revokedPermissions: restaurantUser.revokedPermissions ? JSON.parse(restaurantUser.revokedPermissions) : undefined,
            resolvedPermissions,
            twoFactorEnabled: restaurantUser.twoFactorEnabled,
            restaurant: {
              id: restaurantUser.restaurant.id,
              name: restaurantUser.restaurant.name,
              slug: restaurantUser.restaurant.slug,
            },
            branch: restaurantUser.branch
              ? {
                  id: restaurantUser.branch.id,
                  name: restaurantUser.branch.name,
                }
              : null,
          },
        })
      }

      // User not found in this restaurant — DON'T fall through to other tables
      // This prevents information leakage about other restaurants
      return NextResponse.json(
        { error: 'Invalid email or password for this restaurant.' },
        { status: 401 }
      )
    }

    // ── Non-scoped login (for SuperAdmin / SupportAdmin) ──
    // When no restaurantSlug is provided, we only check admin tables.
    // This is used when someone visits the platform landing page directly.

    // Try SuperAdmin table
    const superAdmin = await db.superAdmin.findUnique({ where: { email } })

    if (superAdmin) {
      if (!superAdmin.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated.' },
          { status: 403 }
        )
      }

      const isValid = await verifyPassword(password, superAdmin.password)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // ── 2FA Check for SuperAdmin ──────────────────
      if (superAdmin.twoFactorEnabled) {
        const tempToken = jwt.sign(
          {
            userId: superAdmin.id,
            email: superAdmin.email,
            role: 'super_admin',
            type: '2fa_pending',
          },
          JWT_SECRET,
          { expiresIn: '5m' }
        )

        return NextResponse.json({
          requires2FA: true,
          tempToken,
          message: 'Two-factor authentication is required. Please enter your verification code.',
          user: {
            email: superAdmin.email,
            name: superAdmin.name,
          },
        })
      }

      await db.superAdmin.update({
        where: { id: superAdmin.id },
        data: { lastLogin: new Date() },
      })

      const tokenPayload: TokenPayload = {
        userId: superAdmin.id,
        email: superAdmin.email,
        role: 'super_admin',
        type: 'admin',
        permissions: resolveUserPermissions('super_admin'),
      }

      const token = generateStaffToken(tokenPayload)

      return NextResponse.json({
        message: 'Login successful',
        token,
        user: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          phone: superAdmin.phone,
          avatar: superAdmin.avatar,
          role: 'super_admin',
          twoFactorEnabled: superAdmin.twoFactorEnabled,
          restaurant: null,
          branch: null,
        },
      })
    }

    // Try SupportAdmin table
    const supportAdmin = await db.supportAdmin.findUnique({ where: { email } })

    if (supportAdmin) {
      if (!supportAdmin.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated.' },
          { status: 403 }
        )
      }

      const isValid = await verifyPassword(password, supportAdmin.password)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      await db.supportAdmin.update({
        where: { id: supportAdmin.id },
        data: { lastLogin: new Date() },
      })

      const tokenPayload: TokenPayload = {
        userId: supportAdmin.id,
        email: supportAdmin.email,
        role: 'support_admin',
        type: 'admin',
        permissions: resolveUserPermissions('support_admin'),
      }

      const token = generateStaffToken(tokenPayload)

      return NextResponse.json({
        message: 'Login successful',
        token,
        user: {
          id: supportAdmin.id,
          name: supportAdmin.name,
          email: supportAdmin.email,
          phone: supportAdmin.phone,
          avatar: supportAdmin.avatar,
          role: 'support_admin',
          twoFactorEnabled: false,
          restaurant: null,
          branch: null,
        },
      })
    }

    // No user found — don't leak info about restaurant users
    return NextResponse.json(
      { error: 'Invalid email or password. If you are restaurant staff, please use your restaurant-specific URL to log in.' },
      { status: 401 }
    )
  } catch (error) {
    console.error('[AUTH_LOGIN_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
