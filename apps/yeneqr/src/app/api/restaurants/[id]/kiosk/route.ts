// Phase 5.4 — Self-Service Kiosk Mode
// GET /api/restaurants/[id]/kiosk — get kiosk config (menu + restaurant info, optimized for full-screen terminal)
// This is a read-only endpoint that returns everything a kiosk needs in one request
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId, isActive: true },
      select: {
        id: true,
        name: true,
        nameAm: true,
        slug: true,
        logo: true,
        currency: true,
        taxRate: true,
        serviceCharge: true,
        defaultLanguage: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Get all menus with categories and items in one query
    const menus = await db.menu.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            nameAm: true,
            nameI18n: true,
            items: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                nameAm: true,
                nameI18n: true,
                description: true,
                descriptionAm: true,
                priceCents: true,
                image: true,
                isPopular: true,
                isVegetarian: true,
                isSpicy: true,
                calories: true,
                preparationTime: true,
                menuItemAllergens: {
                  include: {
                    allergen: { select: { name: true, icon: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    // Get branches for kiosk location selection
    const branches = await db.branch.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      restaurant,
      menus,
      branches,
      kioskConfig: {
        fullscreen: true,
        showImages: true,
        showCalories: true,
        showAllergens: true,
        defaultLanguage: restaurant.defaultLanguage || 'en',
        currency: restaurant.currency || 'ETB',
        taxRate: restaurant.taxRate,
        serviceCharge: restaurant.serviceCharge,
      },
    })
  } catch (error) {
    console.error('[KIOSK]', error)
    return NextResponse.json({ error: 'Failed to fetch kiosk data' }, { status: 500 })
  }
}
