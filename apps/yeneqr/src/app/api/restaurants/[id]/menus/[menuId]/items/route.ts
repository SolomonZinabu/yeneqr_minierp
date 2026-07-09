import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isItemCurrentlyAvailable } from '@/lib/menu-scheduling'
import { requireAuth, requirePerm, getAuthContext } from '@/lib/api-auth'

// GET /api/restaurants/[id]/menus/[menuId]/items — List all items across categories in a menu
//
// Phase 6.1: when the caller is a customer (has a session token with branchId),
// applies branch-specific price and availability overrides. This implements
// the Toast LSP (Location-Specific Pricing) pattern — base menu is restaurant-
// level, branches can override per-item price and 86 items locally.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> }
) {
  try {
    const { id: restaurantId, menuId } = await params

    const menu = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Phase 6.1: detect customer token to apply branch overrides
    const auth = getAuthContext(request)
    const customerBranchId = auth?.type === 'customer' ? auth.branchId : null

    // Get all categories for this menu, then all items across those categories
    const categories = await db.menuCategory.findMany({
      where: { menuId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    })

    const categoryIds = categories.map((c) => c.id)

    // Parse dietary filters from query params
    const { searchParams } = new URL(request.url)
    const dietaryParam = searchParams.get('dietary')
    const dietaryFilters = dietaryParam
      ? dietaryParam.split(',').map((d) => d.trim().toLowerCase())
      : []

    // Phase 3.6: Advanced search filters
    const priceMin = searchParams.get('priceMin') ? parseInt(searchParams.get('priceMin')!, 10) : undefined
    const priceMax = searchParams.get('priceMax') ? parseInt(searchParams.get('priceMax')!, 10) : undefined
    const sortBy = searchParams.get('sortBy') || 'default' // default, priceAsc, priceDesc, popular
    const searchQuery = searchParams.get('q')?.toLowerCase().trim() || ''

    // Build where clause with dietary filters
    const dietaryConditions: Record<string, Record<string, boolean>> = {
      'vegan': { isVegan: true },
      'vegetarian': { isVegetarian: true },
      'gluten-free': { isGlutenFree: true },
      'dairy-free': { isDairyFree: true },
      'halal': { isHalal: true },
      'nut-free': {}, // Handled separately via allergen exclusion
    }

    const whereClause: Record<string, unknown> = {
      categoryId: { in: categoryIds },
      isAvailable: true,
    }

    // Phase 3.6: Apply price range filter
    if (priceMin !== undefined || priceMax !== undefined) {
      const priceFilter: Record<string, number> = {}
      if (priceMin !== undefined) priceFilter.gte = priceMin
      if (priceMax !== undefined) priceFilter.lte = priceMax
      whereClause.priceCents = priceFilter
    }

    // Phase 3.6: Apply text search filter
    if (searchQuery) {
      whereClause.OR = [
        { name: { contains: searchQuery } },
        { nameAm: { contains: searchQuery } },
        { description: { contains: searchQuery } },
      ]
    }

    // Apply dietary filters
    if (dietaryFilters.length > 0) {
      const dietaryWhere: Record<string, boolean>[] = []
      let excludeNutAllergen = false

      for (const filter of dietaryFilters) {
        const condition = dietaryConditions[filter]
        if (condition) {
          if (Object.keys(condition).length > 0) {
            dietaryWhere.push(condition)
          }
          if (filter === 'nut-free') {
            excludeNutAllergen = true
          }
        }
      }

      // All dietary filters must match (AND logic)
      if (dietaryWhere.length > 0) {
        whereClause.AND = dietaryWhere
      }

      // For nut-free, we need to exclude items with "Nuts" allergen
      if (excludeNutAllergen) {
        // We'll filter in-memory after fetching since Prisma doesn't easily support
        // "items that do NOT have a specific allergen" in a single query with SQLite
      }
    }

    // Phase 3.6: Apply sorting
    const orderByClause: Record<string, string> = sortBy === 'priceAsc'
      ? { priceCents: 'asc' }
      : sortBy === 'priceDesc'
        ? { priceCents: 'desc' }
        : sortBy === 'popular'
          ? { isPopular: 'desc' as string, sortOrder: 'asc' as string }
          : { sortOrder: 'asc' }

    const items = await db.menuItem.findMany({
      where: whereClause,
      orderBy: orderByClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameAm: true,
            nameI18n: true,
          },
        },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        translations: true,
        // Include ingredient links so customer menu can render toggle switches
        // for ingredient removal (e.g., "No cheese" on a burger).
        // Only include ingredients that are marked isRemovable=true — those are
        // the ones the customer is allowed to toggle off.
        menuItemIngredients: {
          where: { isRemovable: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
                nameAm: true,
                nameI18n: true,
                isAvailable: true,
              },
            },
          },
        },
        menuItemAllergens: {
          include: {
            allergen: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
        // Phase 6.1: include branch overrides for the customer's branch
        ...(customerBranchId ? {
          branchOverrides: {
            where: { branchId: customerBranchId },
            select: { priceCents: true, isAvailable: true, notes: true },
          },
        } : {}),
      },
    })

    // Add currentAvailable field based on schedule enforcement
    let enrichedItems = items.map((item) => {
      const availabilityResult = isItemCurrentlyAvailable({
        isAvailable: item.isAvailable,
        availabilityType: item.availabilityType,
        availabilitySchedule: item.availabilitySchedule,
        availableFrom: item.availableFrom,
        availableTo: item.availableTo,
        availableDays: item.availableDays,
      });

      // Phase 6.1: apply branch override if present
      // override.isAvailable=false means "86'd at this branch" — hide the item
      // override.priceCents (if set) replaces the base price for this branch
      const branchOverride = customerBranchId && (item as { branchOverrides?: Array<{ priceCents: number | null; isAvailable: boolean; notes: string | null }> }).branchOverrides?.[0]
      const effectivePriceCents = branchOverride?.priceCents ?? item.priceCents
      const effectiveIsAvailable = branchOverride ? branchOverride.isAvailable : item.isAvailable

      return {
        ...item,
        priceCents: effectivePriceCents,
        isAvailable: effectiveIsAvailable,
        currentAvailable: effectiveIsAvailable && availabilityResult.available,
        currentAvailableReason: branchOverride && !branchOverride.isAvailable
          ? (branchOverride.notes || 'Currently unavailable at this branch')
          : availabilityResult.reason,
        // Surface override metadata so the customer app can show "branch price" badge if desired
        hasBranchOverride: !!branchOverride,
      };
    })

    // Phase 6.1: filter out items that are 86'd at the customer's branch
    // (only for customer tokens — staff/dashboard should see all items)
    if (customerBranchId) {
      enrichedItems = enrichedItems.filter((item) => item.isAvailable !== false)
    }

    // Post-filter for nut-free: exclude items that contain "Nuts" allergen
    if (dietaryFilters.includes('nut-free')) {
      enrichedItems = enrichedItems.filter(
        (item) =>
          !item.menuItemAllergens.some(
            (ma: { allergen: { name: string } }) =>
              ma.allergen.name.toLowerCase().includes('nut')
          )
      )
    }

    return NextResponse.json({ items: enrichedItems })
  } catch (error) {
    console.error('[MENU_ITEMS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    )
  }
}

// POST /api/restaurants/[id]/menus/[menuId]/items — Create a menu item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> }
) {
  try {
    // Auth check — only authorized staff/admin can create items
    const auth = requireAuth(request)
    const { id: restaurantId, menuId } = await params
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()

    // Verify menu belongs to restaurant
    const menu = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    const {
      categoryId,
      name,
      nameAm,
      description,
      descriptionAm,
      image,
      images,
      price: bodyPrice,
      priceCents: bodyPriceCents,
      originalPrice,
      originalPriceCents: bodyOriginalPriceCents,
      preparationTime = 15,
      calories,
      isAvailable = true,
      isPopular = false,
      isVegetarian = false,
      isSpicy = false,
      isVegan = false,
      isHalal = false,
      isGlutenFree = false,
      isDairyFree = false,
      showServingSize = null,
      availabilityType = 'always',
      availabilitySchedule,
      availableFrom,
      availableTo,
      availableDays,
      sortOrder = 0,
      ingredients,
      ingredientsI18n,
      allergenIds,
    } = body

    // Accept price in either 'priceCents' (preferred, from frontend) or 'price' (legacy)
    const priceCents = bodyPriceCents ?? bodyPrice

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Item name is required' },
        { status: 400 }
      )
    }

    if (priceCents === undefined || priceCents === null) {
      return NextResponse.json(
        { error: 'Price is required' },
        { status: 400 }
      )
    }

    // Ensure priceCents is a valid integer
    const finalPriceCents = typeof priceCents === 'number' ? Math.round(priceCents) : Math.round(Number(priceCents))
    if (isNaN(finalPriceCents) || finalPriceCents < 0) {
      return NextResponse.json(
        { error: 'Invalid price value' },
        { status: 400 }
      )
    }

    // originalPriceCents: accept from either 'originalPriceCents' or 'originalPrice'
    const originalPriceCentsValue = bodyOriginalPriceCents ?? originalPrice
    const finalOriginalPriceCents = originalPriceCentsValue != null ? Math.round(Number(originalPriceCentsValue)) : undefined

    // Verify category belongs to this menu
    const category = await db.menuCategory.findFirst({
      where: { id: categoryId, menuId },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found in this menu' },
        { status: 404 }
      )
    }

    const item = await db.menuItem.create({
      data: {
        categoryId,
        restaurantId,
        name,
        nameAm,
        description,
        descriptionAm,
        image,
        images,
        priceCents: finalPriceCents,
        originalPriceCents: finalOriginalPriceCents,
        preparationTime,
        calories,
        isAvailable,
        isPopular,
        isVegetarian,
        isSpicy,
        isVegan,
        isHalal,
        isGlutenFree,
        isDairyFree,
        showServingSize,
        availabilityType,
        availabilitySchedule,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
        availableDays: availableDays || null,
        sortOrder,
        ingredients,
        ingredientsI18n,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create allergen associations if provided
    if (allergenIds && Array.isArray(allergenIds) && allergenIds.length > 0) {
      for (const allergenId of allergenIds) {
        await db.menuItemAllergen.create({
          data: {
            menuItemId: item.id,
            allergenId: String(allergenId),
          },
        }).catch(() => {
          // Skip duplicates
        })
      }
    }

    // Fetch the item again with allergens to return the full object
    const itemWithAllergens = await db.menuItem.findFirst({
      where: { id: item.id },
      include: {
        category: {
          select: { id: true, name: true },
        },
        menuItemAllergens: {
          include: {
            allergen: {
              select: { id: true, name: true, icon: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ item: itemWithAllergens }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[MENU_ITEM_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    )
  }
}
