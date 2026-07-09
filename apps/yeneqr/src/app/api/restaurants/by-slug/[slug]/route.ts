// ============================================================
// Yene QR — Restaurant Lookup by Slug
// GET /api/restaurants/by-slug/[slug]
// Returns public restaurant info for login page branding
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const restaurant = await db.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        nameAm: true,
        nameI18n: true,
        descriptionI18n: true,
        slug: true,
        cuisineType: true,
        logo: true,
        city: true,
        address: true,
        defaultLanguage: true,
        enabledLanguages: true,
        currency: true,
        taxRate: true,
        serviceCharge: true,
        isActive: true,
        isSuspended: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    if (!restaurant.isActive) {
      return NextResponse.json(
        { error: 'Restaurant is inactive' },
        { status: 403 }
      )
    }

    if (restaurant.isSuspended) {
      return NextResponse.json(
        { error: 'Restaurant is suspended' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        nameAm: restaurant.nameAm,
        nameI18n: restaurant.nameI18n,
        descriptionI18n: restaurant.descriptionI18n,
        slug: restaurant.slug,
        cuisineType: restaurant.cuisineType,
        logo: restaurant.logo,
        city: restaurant.city,
        address: restaurant.address,
        defaultLanguage: restaurant.defaultLanguage,
        enabledLanguages: restaurant.enabledLanguages,
        currency: restaurant.currency,
        taxRate: restaurant.taxRate,
        serviceCharge: restaurant.serviceCharge,
      },
    })
  } catch (error) {
    console.error('[RESTAURANT_BY_SLUG_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to fetch restaurant' },
      { status: 500 }
    )
  }
}
