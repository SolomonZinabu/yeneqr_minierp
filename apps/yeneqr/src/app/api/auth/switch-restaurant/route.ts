// ============================================================
// Yene QR — Switch Restaurant API Route
// POST /api/auth/switch-restaurant
// Reissues a JWT for a different restaurant context.
// Works for both restaurant staff (who belong to multiple
// restaurants) and platform admins (who can enter any restaurant).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, generateStaffToken, resolveUserPermissions, type TokenPayload } from '@/lib/auth'

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await request.json()
    const { restaurantId } = body

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'restaurantId is required' },
        { status: 400 }
      )
    }

    const staffPayload = decoded as TokenPayload

    // ── Platform Admin: Can switch to ANY restaurant ──────
    if (staffPayload.role === 'super_admin' || staffPayload.role === 'support_admin') {
      const restaurant = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          nameAm: true,
          slug: true,
          cuisineType: true,
          logo: true,
          defaultLanguage: true,
          currency: true,
          isActive: true,
          isSuspended: true,
          branches: {
            where: { isMainBranch: true },
            select: { id: true, name: true },
            take: 1,
          },
        },
      })

      if (!restaurant || !restaurant.isActive) {
        return NextResponse.json({ error: 'Restaurant not found or inactive' }, { status: 404 })
      }

      // Generate new token with the target restaurant
      const newTokenPayload: TokenPayload = {
        userId: staffPayload.userId,
        email: staffPayload.email,
        role: staffPayload.role,
        restaurantId: restaurant.id,
        branchId: restaurant.branches[0]?.id || undefined,
        type: 'staff', // Switch to staff type so dashboard works
        // Preserve admin context for back-navigation
        originalRole: staffPayload.role,
        originalType: staffPayload.type,
        permissions: resolveUserPermissions(staffPayload.role),
      }

      const newToken = generateStaffToken(newTokenPayload)

      return NextResponse.json({
        message: 'Switched restaurant successfully',
        token: newToken,
        user: {
          id: staffPayload.userId,
          name: staffPayload.email.split('@')[0], // Admin name from token
          email: staffPayload.email,
          role: staffPayload.role,
          twoFactorEnabled: false,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            nameAm: restaurant.nameAm,
            slug: restaurant.slug,
            cuisineType: restaurant.cuisineType,
            logo: restaurant.logo,
            defaultLanguage: restaurant.defaultLanguage,
            currency: restaurant.currency,
          },
          branch: restaurant.branches[0]
            ? { id: restaurant.branches[0].id, name: restaurant.branches[0].name }
            : null,
        },
        // Admin context for "Back to Admin" button
        isAdminImpersonation: true,
        originalRole: staffPayload.role,
      })
    }

    // ── Restaurant Staff: Can only switch to restaurants they belong to ──
    const userRecord = await db.restaurantUser.findFirst({
      where: {
        email: staffPayload.email,
        restaurantId: restaurantId,
        isActive: true,
        restaurant: { isActive: true, isSuspended: false },
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            nameAm: true,
            slug: true,
            cuisineType: true,
            logo: true,
            defaultLanguage: true,
            currency: true,
            isActive: true,
            isSuspended: true,
          },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    })

    if (!userRecord) {
      return NextResponse.json(
        { error: 'You do not have access to this restaurant' },
        { status: 403 }
      )
    }

    // Generate new token for the target restaurant
    const newTokenPayload: TokenPayload = {
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      restaurantId: userRecord.restaurantId,
      branchId: userRecord.branchId || undefined,
      type: 'staff',
      permissions: resolveUserPermissions(userRecord.role, {
        permissions: userRecord.permissions ? JSON.parse(userRecord.permissions) : undefined,
        additionalPermissions: userRecord.additionalPermissions ? JSON.parse(userRecord.additionalPermissions) : undefined,
        revokedPermissions: userRecord.revokedPermissions ? JSON.parse(userRecord.revokedPermissions) : undefined,
      }),
    }

    const newToken = generateStaffToken(newTokenPayload)

    // Update last login for this user record
    await db.restaurantUser.update({
      where: { id: userRecord.id },
      data: { lastLogin: new Date() },
    })

    return NextResponse.json({
      message: 'Switched restaurant successfully',
      token: newToken,
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        phone: userRecord.phone,
        avatar: userRecord.avatar,
        role: userRecord.role,
        twoFactorEnabled: userRecord.twoFactorEnabled,
        restaurant: {
          id: userRecord.restaurant.id,
          name: userRecord.restaurant.name,
          nameAm: userRecord.restaurant.nameAm,
          slug: userRecord.restaurant.slug,
          cuisineType: userRecord.restaurant.cuisineType,
          logo: userRecord.restaurant.logo,
          defaultLanguage: userRecord.restaurant.defaultLanguage,
          currency: userRecord.restaurant.currency,
        },
        branch: userRecord.branch
          ? { id: userRecord.branch.id, name: userRecord.branch.name }
          : null,
      },
    })
  } catch (error) {
    console.error('[SWITCH_RESTAURANT_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
