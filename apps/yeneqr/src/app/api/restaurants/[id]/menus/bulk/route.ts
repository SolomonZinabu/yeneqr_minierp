// ============================================================
// Yene QR — Bulk Menu Operations API
// ============================================================
// Provides endpoints for bulk importing, exporting, and
// updating menu items. Essential for large restaurants that
// need to manage hundreds of items efficiently.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { logStaffAction } from '@/lib/audit-log'

/**
 * GET /api/restaurants/[id]/menus/bulk
 * Export all menu items as a flat array suitable for CSV/JSON export.
 *
 * Query params:
 *   menuId (required) — which menu to export
 *   format — 'json' (default) or 'csv'
 *   includeUnavailable — 'true' to include unavailable items (default: true)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')
    const includeUnavailable = searchParams.get('includeUnavailable') !== 'false'

    if (!menuId) {
      return NextResponse.json({ error: 'menuId query parameter is required' }, { status: 400 })
    }

    // Verify menu belongs to this restaurant
    const menu = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })
    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Fetch all categories and items
    const categories = await db.menuCategory.findMany({
      where: { menuId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: includeUnavailable ? {} : { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItemIngredients: {
              include: {
                ingredient: {
                  select: { id: true, name: true, isAvailable: true },
                },
              },
            },
            modifierGroups: {
              include: {
                options: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })

    // Flatten to export-friendly format
    const exportItems = categories.flatMap((cat) =>
      cat.items.map((item) => ({
        id: item.id,
        category: cat.name,
        categoryId: cat.id,
        name: item.name,
        nameAm: item.nameAm || '',
        description: item.description || '',
        priceCents: item.priceCents,
        emoji: item.emoji || '',
        isAvailable: item.isAvailable,
        isVegetarian: item.isVegetarian,
        isVegan: item.isVegan,
        isGlutenFree: item.isGlutenFree,
        isHalal: item.isHalal,
        isSpicy: item.isSpicy,
        isPopular: item.isPopular,
        availabilityType: item.availabilityType,
        availableFrom: item.availableFrom || '',
        availableTo: item.availableTo || '',
        availableDays: item.availableDays || '',
        sortOrder: item.sortOrder,
        ingredients: item.menuItemIngredients.map((mi) => ({
          name: mi.ingredient.name,
          isDefault: mi.isDefault,
          isRemovable: mi.isRemovable,
          quantityRequired: mi.quantityRequired,
        })),
        modifierGroups: item.modifierGroups.map((mg) => ({
          name: mg.name,
          isRequired: mg.isRequired,
          minSelections: mg.minSelections,
          maxSelections: mg.maxSelections,
          options: mg.options.map((opt) => ({
            name: opt.name,
            priceDeltaCents: opt.priceDeltaCents,
          })),
        })),
      }))
    )

    return NextResponse.json({
      data: {
        menuId,
        menuName: menu.name,
        exportedAt: new Date().toISOString(),
        totalItems: exportItems.length,
        totalCategories: categories.length,
        items: exportItems,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BULK_EXPORT]', error)
    return NextResponse.json({ error: 'Failed to export menu items' }, { status: 500 })
  }
}

/**
 * POST /api/restaurants/[id]/menus/bulk
 * Bulk import or update menu items.
 *
 * Body:
 *   menuId (required) — target menu
 *   operation — 'import' | 'update_availability' | 'update_prices' | 'delete'
 *   items — array of items (format depends on operation)
 *
 * Import format: [{ category, name, nameAm?, priceCents, description?, ... }]
 * Update availability: [{ id, isAvailable }]
 * Update prices: [{ id, priceCents }]
 * Delete: [{ id }]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'menu:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { menuId, operation, items } = body

    if (!menuId || !operation || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'menuId, operation, and items array are required' },
        { status: 400 }
      )
    }

    const validOperations = ['import', 'update_availability', 'update_prices', 'delete']
    if (!validOperations.includes(operation)) {
      return NextResponse.json(
        { error: `Invalid operation. Must be one of: ${validOperations.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify menu belongs to this restaurant
    const menu = await db.menu.findFirst({
      where: { id: menuId, restaurantId },
    })
    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    let result: Record<string, unknown> = {}

    switch (operation) {
      case 'import': {
        // Bulk import — create categories and items from flat list
        let created = 0
        let updated = 0
        let skipped = 0
        const errors: string[] = []

        // Batch limit
        if (items.length > 500) {
          return NextResponse.json(
            { error: 'Maximum 500 items per bulk import' },
            { status: 400 }
          )
        }

        for (const item of items) {
          try {
            if (!item.name || item.priceCents === undefined) {
              skipped++
              errors.push(`Item "${item.name || 'unnamed'}": missing name or priceCents`)
              continue
            }

            // Find or create category
            let categoryId: string | null = item.categoryId || null
            if (!categoryId && item.category) {
              const existing = await db.menuCategory.findFirst({
                where: { menuId, name: item.category },
              })
              if (existing) {
                categoryId = existing.id
              } else {
                const newCat = await db.menuCategory.create({
                  data: {
                    menuId,
                    restaurantId,
                    name: item.category,
                    nameAm: item.categoryAm || null,
                    sortOrder: item.categorySortOrder || 0,
                    isActive: true,
                  },
                })
                categoryId = newCat.id
              }
            }

            if (!categoryId) {
              skipped++
              errors.push(`Item "${item.name}": no category specified`)
              continue
            }

            // Check if item with same name exists in this category
            const existingItem = await db.menuItem.findFirst({
              where: {
                categoryId,
                name: item.name,
                restaurantId,
              },
            })

            if (existingItem) {
              // Update existing item
              await db.menuItem.update({
                where: { id: existingItem.id },
                data: {
                  priceCents: item.priceCents,
                  description: item.description ?? existingItem.description,
                  nameAm: item.nameAm ?? existingItem.nameAm,
                  emoji: item.emoji ?? existingItem.emoji,
                  isVegetarian: item.isVegetarian ?? existingItem.isVegetarian,
                  isVegan: item.isVegan ?? existingItem.isVegan,
                  isGlutenFree: item.isGlutenFree ?? existingItem.isGlutenFree,
                  isHalal: item.isHalal ?? existingItem.isHalal,
                  isSpicy: item.isSpicy ?? existingItem.isSpicy,
                  isAvailable: item.isAvailable ?? existingItem.isAvailable,
                },
              })
              updated++
            } else {
              // Create new item
              await db.menuItem.create({
                data: {
                  restaurantId,
                  categoryId,
                  name: item.name,
                  nameAm: item.nameAm || null,
                  description: item.description || null,
                  priceCents: item.priceCents,
                  emoji: item.emoji || null,
                  isAvailable: item.isAvailable !== false,
                  isVegetarian: item.isVegetarian || false,
                  isVegan: item.isVegan || false,
                  isGlutenFree: item.isGlutenFree || false,
                  isHalal: item.isHalal || false,
                  isSpicy: item.isSpicy || false,
                  isPopular: item.isPopular || false,
                  availabilityType: item.availabilityType || 'always',
                  availableFrom: item.availableFrom || null,
                  availableTo: item.availableTo || null,
                  availableDays: item.availableDays || null,
                  sortOrder: item.sortOrder || 0,
                },
              })
              created++
            }
          } catch (itemError) {
            skipped++
            errors.push(`Item "${item.name || 'unnamed'}": ${itemError instanceof Error ? itemError.message : 'Unknown error'}`)
          }
        }

        result = { created, updated, skipped, errors: errors.length > 0 ? errors : undefined }

        // Audit log
        await logStaffAction({
          restaurantId,
          userId: auth.userId,
          performedByType: auth.type,
          action: 'bulk_import_menu_items',
          entityType: 'menuItem',
          newData: { menuId, created, updated, skipped, totalItems: items.length },
        })
        break
      }

      case 'update_availability': {
        // Bulk update availability
        let updated = 0
        const errors: string[] = []

        if (items.length > 1000) {
          return NextResponse.json(
            { error: 'Maximum 1000 items per bulk availability update' },
            { status: 400 }
          )
        }

        for (const item of items) {
          if (!item.id || item.isAvailable === undefined) {
            errors.push(`Item ${item.id || 'unknown'}: missing id or isAvailable`)
            continue
          }
          try {
            const existing = await db.menuItem.findFirst({
              where: { id: item.id, restaurantId },
            })
            if (!existing) {
              errors.push(`Item ${item.id}: not found`)
              continue
            }
            await db.menuItem.update({
              where: { id: item.id },
              data: { isAvailable: !!item.isAvailable },
            })
            updated++
          } catch (err) {
            errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        }

        result = { updated, errors: errors.length > 0 ? errors : undefined }

        await logStaffAction({
          restaurantId,
          userId: auth.userId,
          performedByType: auth.type,
          action: 'bulk_update_availability',
          entityType: 'menuItem',
          newData: { menuId, updated, totalItems: items.length },
        })
        break
      }

      case 'update_prices': {
        // Bulk price update
        let updated = 0
        const errors: string[] = []

        if (items.length > 1000) {
          return NextResponse.json(
            { error: 'Maximum 1000 items per bulk price update' },
            { status: 400 }
          )
        }

        for (const item of items) {
          if (!item.id || item.priceCents === undefined) {
            errors.push(`Item ${item.id || 'unknown'}: missing id or priceCents`)
            continue
          }
          try {
            const existing = await db.menuItem.findFirst({
              where: { id: item.id, restaurantId },
            })
            if (!existing) {
              errors.push(`Item ${item.id}: not found`)
              continue
            }
            await db.menuItem.update({
              where: { id: item.id },
              data: { priceCents: Math.max(0, Math.round(item.priceCents)) },
            })
            updated++
          } catch (err) {
            errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        }

        result = { updated, errors: errors.length > 0 ? errors : undefined }

        await logStaffAction({
          restaurantId,
          userId: auth.userId,
          performedByType: auth.type,
          action: 'bulk_update_prices',
          entityType: 'menuItem',
          newData: { menuId, updated, totalItems: items.length },
        })
        break
      }

      case 'delete': {
        // Bulk delete — soft delete (set isAvailable = false)
        let deleted = 0
        const errors: string[] = []

        if (items.length > 500) {
          return NextResponse.json(
            { error: 'Maximum 500 items per bulk delete' },
            { status: 400 }
          )
        }

        for (const item of items) {
          if (!item.id) {
            errors.push('Item missing id')
            continue
          }
          try {
            const existing = await db.menuItem.findFirst({
              where: { id: item.id, restaurantId },
            })
            if (!existing) {
              errors.push(`Item ${item.id}: not found`)
              continue
            }
            // Soft delete — mark as unavailable
            await db.menuItem.update({
              where: { id: item.id },
              data: { isAvailable: false },
            })
            deleted++
          } catch (err) {
            errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        }

        result = { deleted, errors: errors.length > 0 ? errors : undefined }

        await logStaffAction({
          restaurantId,
          userId: auth.userId,
          performedByType: auth.type,
          action: 'bulk_delete_menu_items',
          entityType: 'menuItem',
          newData: { menuId, deleted, totalItems: items.length },
        })
        break
      }
    }

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[BULK_OPERATION]', error)
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 })
  }
}
