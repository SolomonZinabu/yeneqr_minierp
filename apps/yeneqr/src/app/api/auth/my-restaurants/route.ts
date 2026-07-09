// ============================================================
// Yene QR — List User's Restaurants API Route
// GET /api/auth/my-restaurants
// Returns all restaurants the authenticated user belongs to.
// For staff: finds all RestaurantUser records with that email.
// For super_admin/support_admin: returns all active restaurants.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, type TokenPayload } from '@/lib/auth'

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
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // For platform admins, return ALL restaurants
    if (decoded.type === 'admin') {
      const staffPayload = decoded as TokenPayload
      if (staffPayload.role === 'super_admin' || staffPayload.role === 'support_admin') {
        const restaurants = await db.restaurant.findMany({
          where: { isActive: true, isSuspended: false },
          select: {
            id: true,
            name: true,
            nameAm: true,
            slug: true,
            cuisineType: true,
            logo: true,
            city: true,
            address: true,
            _count: {
              select: { branches: true, users: true },
            },
          },
          orderBy: { name: 'asc' },
        })

        return NextResponse.json({
          type: 'admin',
          restaurants: restaurants.map(r => ({
            id: r.id,
            name: r.name,
            nameAm: r.nameAm,
            slug: r.slug,
            cuisineType: r.cuisineType,
            logo: r.logo,
            city: r.city,
            address: r.address,
            branchCount: r._count.branches,
            staffCount: r._count.users,
            role: 'super_admin', // Admin has full access to any restaurant
          })),
        })
      }
    }

    // For restaurant staff: find all restaurants this email belongs to
    const staffPayload = decoded as TokenPayload
    const userEmail = staffPayload.email

    const userRecords = await db.restaurantUser.findMany({
      where: {
        email: userEmail,
        isActive: true,
        restaurant: { isActive: true, isSuspended: false },
      },
      select: {
        id: true,
        role: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            nameAm: true,
            slug: true,
            cuisineType: true,
            logo: true,
            city: true,
            address: true,
            _count: {
              select: { branches: true, users: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const restaurants = userRecords.map(ur => ({
      id: ur.restaurant.id,
      name: ur.restaurant.name,
      nameAm: ur.restaurant.nameAm,
      slug: ur.restaurant.slug,
      cuisineType: ur.restaurant.cuisineType,
      logo: ur.restaurant.logo,
      city: ur.restaurant.city,
      address: ur.restaurant.address,
      branchCount: ur.restaurant._count.branches,
      staffCount: ur.restaurant._count.users,
      role: ur.role,
      userId: ur.id,
    }))

    return NextResponse.json({
      type: 'staff',
      currentRestaurantId: staffPayload.restaurantId,
      restaurants,
    })
  } catch (error) {
    console.error('[MY_RESTAURANTS_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
