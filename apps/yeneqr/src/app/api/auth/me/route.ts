// ============================================================
// Yene QR — Get Current User API Route
// GET /api/auth/me
// Returns the authenticated user's profile based on JWT token
// Works for both staff/admin and customer token types
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, type TokenPayload, type CustomerTokenPayload } from '@/lib/auth'

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization header required. Format: Bearer <token>' },
        { status: 401 }
      )
    }

    const decoded = verifyToken(token)

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Handle customer token type
    if (decoded.type === 'customer') {
      const customerPayload = decoded as CustomerTokenPayload

      // Verify session still exists and is active
      const session = await db.customerSession.findUnique({
        where: { id: customerPayload.sessionId },
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true, language: true, loyaltyPoints: true },
          },
        },
      })

      if (!session || !session.isActive) {
        return NextResponse.json(
          { error: 'Session expired or invalid' },
          { status: 401 }
        )
      }

      // Check if session has expired
      if (new Date() > session.expiresAt) {
        await db.customerSession.update({
          where: { id: session.id },
          data: { isActive: false },
        })
        return NextResponse.json(
          { error: 'Session has expired. Please scan the QR code again.' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        type: 'customer',
        sessionId: session.id,
        customer: session.customer,
        restaurantId: session.restaurantId,
        branchId: session.branchId,
        tableId: session.tableId,
        language: session.language,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
      })
    }

    // Handle staff/admin token type
    const staffPayload = decoded as TokenPayload

    // Check for platform admins
    if (staffPayload.role === 'super_admin') {
      const superAdmin = await db.superAdmin.findUnique({
        where: { id: staffPayload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      })

      if (!superAdmin || !superAdmin.isActive) {
        return NextResponse.json(
          { error: 'Account not found or deactivated' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        type: 'admin',
        role: 'super_admin',
        user: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          phone: superAdmin.phone,
          avatar: superAdmin.avatar,
          role: 'super_admin',
          lastLogin: superAdmin.lastLogin,
        },
        restaurant: null,
        branch: null,
      })
    }

    if (staffPayload.role === 'support_admin') {
      const supportAdmin = await db.supportAdmin.findUnique({
        where: { id: staffPayload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      })

      if (!supportAdmin || !supportAdmin.isActive) {
        return NextResponse.json(
          { error: 'Account not found or deactivated' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        type: 'admin',
        role: 'support_admin',
        user: {
          id: supportAdmin.id,
          name: supportAdmin.name,
          email: supportAdmin.email,
          phone: supportAdmin.phone,
          avatar: supportAdmin.avatar,
          role: 'support_admin',
          lastLogin: supportAdmin.lastLogin,
        },
        restaurant: null,
        branch: null,
      })
    }

    // Restaurant staff
    const restaurantUser = await db.restaurantUser.findUnique({
      where: { id: staffPayload.userId },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            cuisineType: true,
            logo: true,
            isActive: true,
            isSuspended: true,
            defaultLanguage: true,
            currency: true,
            subscription: {
              select: {
                id: true,
                status: true,
                trialEndsAt: true,
                currentPeriodEnd: true,
                plan: {
                  select: {
                    name: true,
                    slug: true,
                    limits: true,
                  },
                },
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            isMainBranch: true,
            isActive: true,
          },
        },
      },
    })

    if (!restaurantUser || !restaurantUser.isActive) {
      return NextResponse.json(
        { error: 'Account not found or deactivated' },
        { status: 401 }
      )
    }

    if (!restaurantUser.restaurant.isActive || restaurantUser.restaurant.isSuspended) {
      return NextResponse.json(
        { error: 'Restaurant account is inactive or suspended' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      type: 'staff',
      role: restaurantUser.role,
      user: {
        id: restaurantUser.id,
        name: restaurantUser.name,
        email: restaurantUser.email,
        phone: restaurantUser.phone,
        avatar: restaurantUser.avatar,
        role: restaurantUser.role,
        lastLogin: restaurantUser.lastLogin,
      },
      restaurant: {
        id: restaurantUser.restaurant.id,
        name: restaurantUser.restaurant.name,
        slug: restaurantUser.restaurant.slug,
        cuisineType: restaurantUser.restaurant.cuisineType,
        logo: restaurantUser.restaurant.logo,
        defaultLanguage: restaurantUser.restaurant.defaultLanguage,
        currency: restaurantUser.restaurant.currency,
        subscription: restaurantUser.restaurant.subscription,
      },
      branch: restaurantUser.branch,
    })
  } catch (error) {
    console.error('[AUTH_ME_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
