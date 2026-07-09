// ============================================================
// Yene QR — Restaurant List API
// GET /api/restaurants/list
// Returns all active, non-suspended restaurants for dropdowns
// Used by landing page restaurant selector
// ============================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const restaurants = await db.restaurant.findMany({
      where: {
        isActive: true,
        isSuspended: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        cuisineType: true,
        city: true,
        logo: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      restaurants: restaurants.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        cuisineType: r.cuisineType,
        city: r.city,
        logo: r.logo,
      })),
    })
  } catch (error) {
    console.error('[RESTAURANT_LIST_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to fetch restaurants' },
      { status: 500 }
    )
  }
}
