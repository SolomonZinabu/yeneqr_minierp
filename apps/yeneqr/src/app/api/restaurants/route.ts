// ============================================================
// Yene QR — Restaurants API (List & Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, hasPerm } from '@/lib/api-auth'

/**
 * GET /api/restaurants
 * List restaurants. Super admins see all; restaurant staff see their own.
 * Query params: page, limit, search, isActive
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const isActiveFilter = searchParams.get('isActive')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    // Non-platform-support users can only see their own restaurant
    if (!hasPerm(auth, 'platform:support')) {
      where.id = auth.restaurantId
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { email: { contains: search } },
        { city: { contains: search } },
      ]
    }

    if (isActiveFilter !== null && isActiveFilter !== undefined && isActiveFilter !== '') {
      where.isActive = isActiveFilter === 'true'
    }

    const [restaurants, total] = await Promise.all([
      db.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { branches: true, users: true, menus: true },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              plan: { select: { name: true, slug: true } },
              currentPeriodEnd: true,
            },
          },
        },
      }),
      db.restaurant.count({ where }),
    ])

    return NextResponse.json({
      data: restaurants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[RESTAURANTS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch restaurants' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants
 * Create a new restaurant. Used by register flow or super admin.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)

    // Only users with restaurant:manage permission can create restaurants
    const permErr = requirePerm(auth, 'restaurant:manage')
    if (permErr) return permErr

    const body = await request.json()
    const {
      slug,
      name,
      nameAm,
      description,
      descriptionAm,
      logo,
      banner,
      cuisineType,
      phone,
      email,
      website,
      address,
      city,
      latitude,
      longitude,
      workingHours,
      taxRate,
      serviceCharge,
      currency,
      defaultLanguage,
    } = body

    // Validate required fields
    if (!slug || !name) {
      return NextResponse.json(
        { error: 'Slug and name are required' },
        { status: 400 }
      )
    }

    // Check slug uniqueness
    const existing = await db.restaurant.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json(
        { error: 'A restaurant with this slug already exists' },
        { status: 409 }
      )
    }

    const restaurant = await db.restaurant.create({
      data: {
        slug,
        name,
        nameAm: nameAm || null,
        description: description || null,
        descriptionAm: descriptionAm || null,
        logo: logo || null,
        banner: banner || null,
        cuisineType: cuisineType || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        address: address || null,
        city: city || null,
        latitude: latitude || null,
        longitude: longitude || null,
        workingHours: workingHours ? JSON.stringify(workingHours) : null,
        taxRate: taxRate ?? 0.15,
        serviceCharge: serviceCharge ?? 0.0,
        currency: currency || 'ETB',
        defaultLanguage: defaultLanguage || 'en',
      },
    })

    return NextResponse.json({ data: restaurant }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESTAURANT_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create restaurant' },
      { status: 500 }
    )
  }
}
