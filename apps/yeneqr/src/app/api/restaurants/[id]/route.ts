// ============================================================
// Yene QR — Restaurant Detail API (GET, PUT, DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]
 * Get restaurant details by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = getAuthContext(request)

    const restaurant = await db.restaurant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            branches: true,
            users: true,
            menus: true,
            promotions: true,
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            plan: { select: { name: true, slug: true } },
            currentPeriodStart: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
          },
        },
        branches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            city: true,
            isMainBranch: true,
            isActive: true,
          },
          orderBy: [{ isMainBranch: 'desc' }, { name: 'asc' }],
        },
      },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // Non-admin staff can only view their own restaurant
    if (auth && auth.type === 'staff') {
      const permErr = requirePerm(auth, 'restaurant:view', id)
      if (permErr) return permErr
    }

    return NextResponse.json({ data: restaurant })
  } catch (error) {
    console.error('[RESTAURANT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch restaurant' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]
 * Update restaurant details.
 * Owners and managers can update their own restaurant; super admins can update any.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    // Check access: must have restaurant:manage permission for this restaurant
    const permErr = requirePerm(auth, 'restaurant:manage', id)
    if (permErr) return permErr

    // Verify restaurant exists
    const existing = await db.restaurant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
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
      isActive,
      isVerified,
      isSuspended,
      settings,
    } = body

    // Build update data — only include fields that are provided
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (nameAm !== undefined) updateData.nameAm = nameAm
    if (description !== undefined) updateData.description = description
    if (descriptionAm !== undefined) updateData.descriptionAm = descriptionAm
    if (logo !== undefined) updateData.logo = logo
    if (banner !== undefined) updateData.banner = banner
    if (cuisineType !== undefined) updateData.cuisineType = cuisineType
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    if (website !== undefined) updateData.website = website
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (workingHours !== undefined) updateData.workingHours = JSON.stringify(workingHours)
    if (taxRate !== undefined) updateData.taxRate = taxRate
    if (serviceCharge !== undefined) updateData.serviceCharge = serviceCharge
    if (currency !== undefined) updateData.currency = currency
    if (defaultLanguage !== undefined) updateData.defaultLanguage = defaultLanguage
    if (settings !== undefined) updateData.settings = typeof settings === 'string' ? settings : JSON.stringify(settings)

    // Only super_admin can toggle these platform-level flags
    if (auth.role === 'super_admin') {
      if (isActive !== undefined) updateData.isActive = isActive
      if (isVerified !== undefined) updateData.isVerified = isVerified
      if (isSuspended !== undefined) updateData.isSuspended = isSuspended
    }

    const updated = await db.restaurant.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESTAURANT_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update restaurant' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/restaurants/[id]
 * Soft delete — sets isActive = false.
 * Only super_admin can delete restaurants.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    // Only super_admin can soft-delete restaurants
    if (auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await db.restaurant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: 'Restaurant is already inactive' },
        { status: 400 }
      )
    }

    const updated = await db.restaurant.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ data: updated, message: 'Restaurant deactivated successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[RESTAURANT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete restaurant' },
      { status: 500 }
    )
  }
}
