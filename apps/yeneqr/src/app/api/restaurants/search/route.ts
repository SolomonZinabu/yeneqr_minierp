// ============================================================
// Yene QR — Restaurant Search API
// GET /api/restaurants/search?q=query
// Returns matching restaurants for the landing page finder
// Only returns active, non-suspended restaurants with limited info
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ restaurants: [] })
    }

    // SQLite-compatible search: use contains without mode (case-insensitive by default in SQLite)
    const restaurants = await db.restaurant.findMany({
      where: {
        isActive: true,
        isSuspended: false,
        OR: [
          { name: { contains: q } },
          { nameAm: { contains: q } },
          { slug: { startsWith: q } },
          { slug: { contains: q } },
          { cuisineType: { contains: q } },
          { city: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        cuisineType: true,
        city: true,
        logo: true,
      },
      take: 10,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      restaurants: restaurants.map(r => ({
        name: r.name,
        slug: r.slug,
        cuisineType: r.cuisineType,
        city: r.city,
        logo: r.logo,
      })),
    })
  } catch (error) {
    console.error('[RESTAURANT_SEARCH_ERROR]', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
