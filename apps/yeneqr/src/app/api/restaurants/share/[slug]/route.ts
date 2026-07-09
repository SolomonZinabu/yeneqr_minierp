// ============================================================
// Yene QR — Public Share Menu API
// GET /api/restaurants/share/[slug]
// Returns public restaurant info + menu for share pages (no auth required)
// Optional ?item=<itemId> to highlight a specific item
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
        slug: true,
        logo: true,
        banner: true,
        cuisineType: true,
        description: true,
        descriptionAm: true,
        descriptionI18n: true,
        city: true,
        address: true,
        phone: true,
        defaultLanguage: true,
        enabledLanguages: true,
        currency: true,
        taxRate: true,
        serviceCharge: true,
        isActive: true,
        isSuspended: true,
        settings: true,
      },
    })

    if (!restaurant || !restaurant.isActive || restaurant.isSuspended) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // Fetch menus with categories and items
    const menus = await db.menu.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
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
                descriptionI18n: true,
                image: true,
                priceCents: true,
                preparationTime: true,
                isPopular: true,
                isVegetarian: true,
                isSpicy: true,
                isDairyFree: true,
                isGlutenFree: true,
                isHalal: true,
                isVegan: true,
                calories: true,
                categoryId: true,
                modifierGroups: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    nameAm: true,
                    isRequired: true,
                    minSelection: true,
                    maxSelection: true,
                    options: {
                      orderBy: { sortOrder: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        nameAm: true,
                        priceDeltaCents: true,
                      },
                    },
                  },
                },
                menuItemAllergens: {
                  include: {
                    allergen: { select: { id: true, name: true, icon: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    // Flatten categories and items for easy consumption
    const categories = menus.flatMap((menu: any) =>
      (menu.categories || menu.menuCategories || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        nameAm: cat.nameAm,
        nameI18n: cat.nameI18n,
        icon: cat.icon,
        items: (cat.items || cat.menuItems || []).map((item: any) => ({
          ...item,
          allergens: item.menuItemAllergens || item.allergens || [],
        })),
      }))
    )

    // If ?item= is provided, find and highlight that item
    const { searchParams } = new URL(request.url)
    const highlightItemId = searchParams.get('item') || undefined
    let highlightItem = null
    if (highlightItemId) {
      for (const cat of categories) {
        const found = cat.items.find(i => i.id === highlightItemId)
        if (found) {
          highlightItem = found
          break
        }
      }
    }

    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        nameAm: restaurant.nameAm,
        nameI18n: restaurant.nameI18n,
        slug: restaurant.slug,
        logo: restaurant.logo,
        banner: restaurant.banner,
        cuisineType: restaurant.cuisineType,
        description: restaurant.description,
        descriptionAm: restaurant.descriptionAm,
        descriptionI18n: restaurant.descriptionI18n,
        city: restaurant.city,
        address: restaurant.address,
        phone: restaurant.phone,
        defaultLanguage: restaurant.defaultLanguage,
        enabledLanguages: restaurant.enabledLanguages,
        currency: restaurant.currency,
        taxRate: restaurant.taxRate,
        serviceCharge: restaurant.serviceCharge,
        settings: restaurant.settings,
      },
      categories,
      highlightItem,
    })
  } catch (error) {
    console.error('[SHARE_MENU_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to fetch shared menu' },
      { status: 500 }
    )
  }
}
