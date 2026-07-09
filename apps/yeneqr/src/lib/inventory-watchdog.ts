// ============================================================
// Yene QR — Inventory Watchdog
// ============================================================
// Monitors inventory stock levels and automatically propagates
// stock-out events through the ingredient chain to menu items.
//
// Flow: InventoryItem.currentStock → 0
//         → Ingredient.isAvailable = false
//           → MenuItem.isAvailable = false (for items requiring that ingredient)
//             → SSE "item_availability_changed" event
//               → Notification to managers
//
// Reverse flow: InventoryItem restocked
//         → Ingredient.isAvailable = true
//           → MenuItem.isAvailable = true (if ALL ingredients are now available)

import { db } from '@/lib/db'
import { emitEvent } from '@/lib/realtime'

interface AvailabilityChange {
  menuItemId: string
  menuItemName: string
  wasAvailable: boolean
  isAvailable: boolean
  reason: string
  ingredientId?: string
  ingredientName?: string
  inventoryItemId?: string
}

/**
 * Handle inventory stock change — check if stock crossed the zero threshold
 * and propagate availability changes through the ingredient → menu item chain.
 *
 * @param restaurantId The restaurant ID
 * @param inventoryItemId The inventory item that changed
 * @param previousStock The stock level before the change
 * @param newStock The stock level after the change
 */
export async function handleInventoryStockChange(
  restaurantId: string,
  inventoryItemId: string,
  previousStock: number,
  newStock: number
): Promise<AvailabilityChange[]> {
  const wentOutOfStock = previousStock > 0 && newStock <= 0
  const wasRestocked = previousStock <= 0 && newStock > 0

  // Only act on threshold crossings
  if (!wentOutOfStock && !wasRestocked) return []

  const changes: AvailabilityChange[] = []

  // Phase 6.4: look up the inventory item's branchId so events and notifications
  // are scoped to the correct branch. InventoryItem.branchId is required in the
  // schema, so this will always return a value. Previously the watchdog emitted
  // restaurant-wide events, so a low-stock alert at Branch A reached Branch B's
  // managers.
  const inventoryItemRecord = await db.inventoryItem.findUnique({
    where: { id: inventoryItemId },
    select: { branchId: true, name: true },
  })
  const branchId = inventoryItemRecord?.branchId || undefined

  try {
    if (wentOutOfStock) {
      // Find all ingredients linked to this inventory item
      const affectedIngredients = await db.ingredient.findMany({
        where: {
          inventoryItemId,
          isAvailable: true, // Only update ingredients that are currently available
        },
        include: {
          menuItems: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  isAvailable: true,
                },
              },
            },
          },
        },
      })

      for (const ingredient of affectedIngredients) {
        // Mark ingredient as unavailable
        await db.ingredient.update({
          where: { id: ingredient.id },
          data: { isAvailable: false },
        })

        // Find all menu items that use this ingredient as a default (required) ingredient
        const menuItemIds = ingredient.menuItems
          .filter((mi) => mi.isDefault) // Only affect items where ingredient is required
          .map((mi) => mi.menuItem.id)

        // For each affected menu item, check if it should be marked unavailable
        // (it should be unavailable if ANY of its required ingredients are unavailable)
        for (const menuItemId of menuItemIds) {
          const menuItem = ingredient.menuItems.find(
            (mi) => mi.menuItem.id === menuItemId
          )?.menuItem

          if (!menuItem || !menuItem.isAvailable) continue

          // Check if this menu item has any other unavailable required ingredients
          const allRequiredIngredients = await db.menuItemIngredient.findMany({
            where: {
              menuItemId,
              isDefault: true,
            },
            include: {
              ingredient: {
                select: { id: true, name: true, isAvailable: true },
              },
            },
          })

          const hasUnavailableIngredient = allRequiredIngredients.some(
            (mi) => !mi.ingredient.isAvailable
          )

          if (hasUnavailableIngredient) {
            await db.menuItem.update({
              where: { id: menuItemId },
              data: { isAvailable: false },
            })

            const change: AvailabilityChange = {
              menuItemId,
              menuItemName: menuItem.name,
              wasAvailable: true,
              isAvailable: false,
              reason: 'ingredient_out_of_stock',
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              inventoryItemId,
            }
            changes.push(change)

            // Emit real-time event
            // Phase 6.4: include branchId so SSE filters (Phase 3.3) scope this
            // to the affected branch only.
            emitEvent({
              type: 'item_availability_changed',
              restaurantId,
              branchId,
              menuItemId,
              menuItemName: menuItem.name,
              isAvailable: false,
              reason: 'ingredient_out_of_stock',
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              inventoryItemId,
            })
          }
        }
      }

      // Send notification to managers if items were affected
      if (changes.length > 0) {
        const itemNames = changes.map((c) => c.menuItemName).join(', ')
        await createNotification(
          restaurantId,
          branchId,
          'Items Marked Unavailable',
          `Stock-out of "${inventoryItemRecord?.name}" has automatically marked ${changes.length} menu item(s) as unavailable: ${itemNames}`,
          'system'
        )
      }
    } else if (wasRestocked) {
      // Find all ingredients linked to this inventory item
      const affectedIngredients = await db.ingredient.findMany({
        where: {
          inventoryItemId,
          isAvailable: false, // Only update ingredients that are currently unavailable
        },
        include: {
          menuItems: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  isAvailable: true,
                },
              },
            },
          },
        },
      })

      for (const ingredient of affectedIngredients) {
        // Mark ingredient as available again
        await db.ingredient.update({
          where: { id: ingredient.id },
          data: { isAvailable: true },
        })

        // For each menu item that was using this ingredient and is currently unavailable,
        // check if ALL its required ingredients are now available
        const menuItemIds = ingredient.menuItems
          .filter((mi) => mi.isDefault)
          .map((mi) => mi.menuItem.id)

        // Get unique menu item IDs (a menu item might appear multiple times)
        const uniqueMenuItemIds = [...new Set(menuItemIds)]

        for (const menuItemId of uniqueMenuItemIds) {
          const menuItem = ingredient.menuItems.find(
            (mi) => mi.menuItem.id === menuItemId
          )?.menuItem

          if (!menuItem || menuItem.isAvailable) continue // Skip items already available

          // Check if ALL required ingredients are now available
          const allRequiredIngredients = await db.menuItemIngredient.findMany({
            where: {
              menuItemId,
              isDefault: true,
            },
            include: {
              ingredient: {
                select: { id: true, isAvailable: true },
              },
            },
          })

          const allIngredientsAvailable = allRequiredIngredients.every(
            (mi) => mi.ingredient.isAvailable
          )

          if (allIngredientsAvailable) {
            await db.menuItem.update({
              where: { id: menuItemId },
              data: { isAvailable: true },
            })

            const change: AvailabilityChange = {
              menuItemId,
              menuItemName: menuItem.name,
              wasAvailable: false,
              isAvailable: true,
              reason: 'restocked',
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              inventoryItemId,
            }
            changes.push(change)

            // Emit real-time event
            // Phase 6.4: include branchId for branch-scoped SSE delivery.
            emitEvent({
              type: 'item_availability_changed',
              restaurantId,
              branchId,
              menuItemId,
              menuItemName: menuItem.name,
              isAvailable: true,
              reason: 'restocked',
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              inventoryItemId,
            })
          }
        }
      }

      // Send notification about restocked items
      if (changes.length > 0) {
        const itemNames = changes.map((c) => c.menuItemName).join(', ')
        await createNotification(
          restaurantId,
          branchId,
          'Items Back in Stock',
          `"${inventoryItemRecord?.name}" has been restocked. ${changes.length} menu item(s) are now available again: ${itemNames}`,
          'system'
        )
      }
    }
  } catch (error) {
    console.error('[INVENTORY_WATCHDOG]', error)
    // Don't throw — the inventory update itself should succeed even if propagation fails
  }

  return changes
}

/**
 * Manually toggle a menu item's availability (e.g., from the 86'd button).
 * Emits a real-time event so customer apps update immediately.
 *
 * Phase 6.4: branchId is now included in the emitted event so the SSE filter
 * (Phase 3.3) scopes it to the affected branch. Pass the branchId of the
 * branch where the toggle was triggered.
 */
export async function toggleMenuItemAvailability(
  restaurantId: string,
  menuItemId: string,
  isAvailable: boolean,
  reason: string = 'manual_toggle',
  branchId?: string
): Promise<void> {
  const menuItem = await db.menuItem.update({
    where: { id: menuItemId },
    data: { isAvailable },
    select: { id: true, name: true },
  })

  emitEvent({
    type: 'item_availability_changed',
    restaurantId,
    branchId,
    menuItemId: menuItem.id,
    menuItemName: menuItem.name,
    isAvailable,
    reason,
  })
}

/**
 * Scan all inventory items for a restaurant and sync availability.
 * Useful as a startup job or periodic check.
 * Returns the number of changes made.
 */
export async function syncInventoryToMenuAvailability(
  restaurantId: string
): Promise<number> {
  let changeCount = 0

  // Find all out-of-stock inventory items with linked ingredients
  const outOfStockItems = await db.inventoryItem.findMany({
    where: {
      restaurantId,
      currentStock: { lte: 0 },
      isActive: true,
      ingredients: {
        some: { isAvailable: true },
      },
    },
    include: {
      ingredients: {
        where: { isAvailable: true },
        include: {
          menuItems: {
            where: { isDefault: true },
            include: {
              menuItem: {
                select: { id: true, name: true, isAvailable: true },
              },
            },
          },
        },
      },
    },
  })

  for (const item of outOfStockItems) {
    for (const ingredient of item.ingredients) {
      await db.ingredient.update({
        where: { id: ingredient.id },
        data: { isAvailable: false },
      })

      for (const mi of ingredient.menuItems) {
        if (mi.menuItem.isAvailable) {
          await db.menuItem.update({
            where: { id: mi.menuItem.id },
            data: { isAvailable: false },
          })

          emitEvent({
            type: 'item_availability_changed',
            restaurantId,
            branchId: item.branchId || undefined,
            menuItemId: mi.menuItem.id,
            menuItemName: mi.menuItem.name,
            isAvailable: false,
            reason: 'ingredient_out_of_stock',
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            inventoryItemId: item.id,
          })

          changeCount++
        }
      }
    }
  }

  // Find all in-stock inventory items whose ingredients are marked unavailable
  const inStockItems = await db.inventoryItem.findMany({
    where: {
      restaurantId,
      currentStock: { gt: 0 },
      isActive: true,
      ingredients: {
        some: { isAvailable: false },
      },
    },
    include: {
      ingredients: {
        where: { isAvailable: false },
        include: {
          menuItems: {
            where: { isDefault: true },
            include: {
              menuItem: {
                select: { id: true, name: true, isAvailable: true },
              },
            },
          },
        },
      },
    },
  })

  for (const item of inStockItems) {
    for (const ingredient of item.ingredients) {
      // Check if this ingredient's inventory item is actually in stock
      if (item.currentStock > 0) {
        await db.ingredient.update({
          where: { id: ingredient.id },
          data: { isAvailable: true },
        })

        // Check each affected menu item
        for (const mi of ingredient.menuItems) {
          if (!mi.menuItem.isAvailable) {
            // Check if ALL required ingredients are now available
            const allRequiredIngredients = await db.menuItemIngredient.findMany({
              where: {
                menuItemId: mi.menuItem.id,
                isDefault: true,
              },
              include: {
                ingredient: { select: { isAvailable: true } },
              },
            })

            const allAvailable = allRequiredIngredients.every(
              (r) => r.ingredient.isAvailable
            )

            if (allAvailable) {
              await db.menuItem.update({
                where: { id: mi.menuItem.id },
                data: { isAvailable: true },
              })

              emitEvent({
                type: 'item_availability_changed',
                restaurantId,
                branchId: item.branchId || undefined,
                menuItemId: mi.menuItem.id,
                menuItemName: mi.menuItem.name,
                isAvailable: true,
                reason: 'restocked',
                ingredientId: ingredient.id,
                ingredientName: ingredient.name,
                inventoryItemId: item.id,
              })

              changeCount++
            }
          }
        }
      }
    }
  }

  return changeCount
}

/**
 * Helper: Create an in-app notification for restaurant staff.
 *
 * Phase 6.4: now accepts branchId so the notification is scoped to the
 * affected branch. Managers at other branches will no longer receive
 * low-stock alerts or availability-change notifications for branches
 * they don't manage.
 */
async function createNotification(
  restaurantId: string,
  branchId: string | undefined,
  title: string,
  message: string,
  type: string
): Promise<void> {
  try {
    // Find all active staff who should be notified (managers and owners).
    // Phase 6.4: if branchId is set, only notify staff assigned to that branch
    // (or staff with no branch assignment = all-branch managers/owners).
    const staffWhere: Record<string, unknown> = {
      restaurantId,
      isActive: true,
      role: { in: ['owner', 'manager'] },
    }
    if (branchId) {
      // Notify staff whose branchId is null (all-branch) OR matches the affected branch
      staffWhere.OR = [
        { branchId: null },
        { branchId },
      ]
    }

    const staff = await db.restaurantUser.findMany({
      where: staffWhere,
      select: { id: true },
    })

    if (staff.length === 0) return

    await db.notification.createMany({
      data: staff.map((s) => ({
        restaurantId,
        branchId: branchId || null,
        userId: s.id,
        type,
        channel: 'in_app',
        title,
        message,
        isRead: false,
      })),
    })
  } catch (error) {
    console.error('[INVENTORY_WATCHDOG_NOTIFICATION]', error)
  }
}

// ============================================================
// Stock Deduction & Restoration on Order Placement/Cancellation
// ============================================================

interface StockDeductionResult {
  inventoryItemId: string
  inventoryItemName: string
  previousStock: number
  newStock: number
  wentOutOfStock: boolean
  hitLowStock: boolean
}

/**
 * Deduct inventory stock for all ingredients consumed by an order.
 * For each order item, finds the linked MenuItemIngredient → Ingredient → InventoryItem chain
 * and decrements currentStock by (quantityRequired × orderItem.quantity).
 *
 * After deduction, if any inventory item crosses the zero or low-stock threshold,
 * the watchdog propagation is triggered.
 *
 * This function is designed to be called AFTER the order is successfully created,
 * so a stock deduction failure should NOT roll back the order. Errors are logged
 * but not thrown.
 */
export async function deductStockForOrder(
  restaurantId: string,
  orderId: string
): Promise<StockDeductionResult[]> {
  const results: StockDeductionResult[] = []

  try {
    // Phase 6.4: look up the order's branchId so events are branch-scoped.
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { branchId: true },
    })
    const orderBranchId = order?.branchId || undefined

    // Fetch all order items with their menu item's ingredient links
    const orderItems = await db.orderItem.findMany({
      where: {
        orderId,
        kitchenStatus: { not: 'cancelled' }, // Skip cancelled items
      },
      select: {
        id: true,
        menuItemId: true,
        quantity: true,
        removedIngredients: true,
      },
    })

    // Build a map of inventory item ID → total quantity to deduct
    const deductions = new Map<string, { name: string; totalDeduction: number; previousStock: number }>()

    for (const item of orderItems) {
      if (!item.menuItemId) continue

      // Parse removed ingredients (customer asked to remove these — don't deduct for them)
      const removedIngredientIds: string[] = []
      if (item.removedIngredients) {
        try {
          const parsed = JSON.parse(item.removedIngredients)
          if (Array.isArray(parsed)) {
            removedIngredientIds.push(...parsed.map((r: { id: string }) => r.id))
          }
        } catch {
          // Invalid JSON — ignore
        }
      }

      // Find all ingredient links for this menu item
      const ingredientLinks = await db.menuItemIngredient.findMany({
        where: {
          menuItemId: item.menuItemId,
          isDefault: true, // Only deduct for default (required) ingredients
          ingredientId: { notIn: removedIngredientIds }, // Skip removed ingredients
        },
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              inventoryItemId: true,
            },
          },
        },
      })

      for (const link of ingredientLinks) {
        const invItemId = link.ingredient.inventoryItemId
        if (!invItemId) continue // Ingredient not linked to inventory

        const qtyRequired = link.quantityRequired || 1
        const totalDeduction = qtyRequired * item.quantity

        const existing = deductions.get(invItemId)
        if (existing) {
          existing.totalDeduction += totalDeduction
        } else {
          deductions.set(invItemId, {
            name: '', // Will be filled during deduction
            totalDeduction,
            previousStock: 0, // Will be filled during deduction
          })
        }
      }
    }

    // Perform all deductions
    for (const [inventoryItemId, deductionInfo] of deductions.entries()) {
      const inventoryItem = await db.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        select: { id: true, name: true, currentStock: true, minimumStock: true, unit: true, branchId: true },
      })

      if (!inventoryItem || !inventoryItem.isActive) continue

      const previousStock = inventoryItem.currentStock
      const newStock = Math.max(0, previousStock - deductionInfo.totalDeduction)

      // Update the stock level
      await db.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          currentStock: newStock,
          lastRestocked: previousStock <= 0 && newStock > 0 ? new Date() : undefined,
        },
      })

      const wentOutOfStock = previousStock > 0 && newStock <= 0
      const hitLowStock = previousStock > inventoryItem.minimumStock && newStock <= inventoryItem.minimumStock && newStock > 0

      results.push({
        inventoryItemId,
        inventoryItemName: inventoryItem.name,
        previousStock,
        newStock,
        wentOutOfStock,
        hitLowStock,
      })

      // Trigger availability propagation if stock crossed zero threshold
      if (wentOutOfStock) {
        await handleInventoryStockChange(restaurantId, inventoryItemId, previousStock, newStock)
      }

      // Phase 6.4: use the inventory item's branchId (fallback to order's branchId)
      // for branch-scoped event emission.
      const eventBranchId = inventoryItem.branchId || orderBranchId

      // Emit low stock alert
      if (hitLowStock || (wentOutOfStock && inventoryItem.minimumStock > 0)) {
        emitEvent({
          type: 'low_stock_alert',
          restaurantId,
          branchId: eventBranchId,
          inventoryItemId,
          inventoryItemName: inventoryItem.name,
          currentStock: newStock,
          minimumStock: inventoryItem.minimumStock,
          unit: inventoryItem.unit,
        })

        // Send in-app notification for low stock
        if (hitLowStock) {
          await createNotification(
            restaurantId,
            eventBranchId,
            'Low Stock Warning',
            `"${inventoryItem.name}" is running low: ${newStock} ${inventoryItem.unit} remaining (minimum: ${inventoryItem.minimumStock} ${inventoryItem.unit})`,
            'low_stock'
          )
        }
      }
    }
  } catch (error) {
    console.error('[INVENTORY_STOCK_DEDUCTION]', error)
    // Don't throw — stock deduction failure should not break order creation
  }

  return results
}

/**
 * Restore inventory stock when an order is cancelled.
 * Reverses the deduction done by deductStockForOrder.
 */
export async function restoreStockForOrder(
  restaurantId: string,
  orderId: string
): Promise<StockDeductionResult[]> {
  const results: StockDeductionResult[] = []

  try {
    // Fetch all order items with their menu item's ingredient links
    const orderItems = await db.orderItem.findMany({
      where: {
        orderId,
        kitchenStatus: { not: 'cancelled' }, // Items that were already cancelled were never deducted
      },
      select: {
        id: true,
        menuItemId: true,
        quantity: true,
        removedIngredients: true,
      },
    })

    // Build a map of inventory item ID → total quantity to restore
    const restorations = new Map<string, { totalRestoration: number }>()

    for (const item of orderItems) {
      if (!item.menuItemId) continue

      // Parse removed ingredients (these were never deducted, so don't restore them)
      const removedIngredientIds: string[] = []
      if (item.removedIngredients) {
        try {
          const parsed = JSON.parse(item.removedIngredients)
          if (Array.isArray(parsed)) {
            removedIngredientIds.push(...parsed.map((r: { id: string }) => r.id))
          }
        } catch {
          // Invalid JSON — ignore
        }
      }

      const ingredientLinks = await db.menuItemIngredient.findMany({
        where: {
          menuItemId: item.menuItemId,
          isDefault: true,
          ingredientId: { notIn: removedIngredientIds },
        },
        include: {
          ingredient: {
            select: {
              id: true,
              inventoryItemId: true,
            },
          },
        },
      })

      for (const link of ingredientLinks) {
        const invItemId = link.ingredient.inventoryItemId
        if (!invItemId) continue

        const qtyRequired = link.quantityRequired || 1
        const totalRestoration = qtyRequired * item.quantity

        const existing = restorations.get(invItemId)
        if (existing) {
          existing.totalRestoration += totalRestoration
        } else {
          restorations.set(invItemId, { totalRestoration })
        }
      }
    }

    // Perform all restorations
    for (const [inventoryItemId, restorationInfo] of restorations.entries()) {
      const inventoryItem = await db.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        select: { id: true, name: true, currentStock: true, minimumStock: true, unit: true },
      })

      if (!inventoryItem) continue

      const previousStock = inventoryItem.currentStock
      const newStock = previousStock + restorationInfo.totalRestoration

      await db.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { currentStock: newStock },
      })

      const wasRestocked = previousStock <= 0 && newStock > 0

      results.push({
        inventoryItemId,
        inventoryItemName: inventoryItem.name,
        previousStock,
        newStock,
        wentOutOfStock: false,
        hitLowStock: false,
      })

      // Trigger availability propagation if stock came back from zero
      if (wasRestocked) {
        await handleInventoryStockChange(restaurantId, inventoryItemId, previousStock, newStock)
      }
    }
  } catch (error) {
    console.error('[INVENTORY_STOCK_RESTORE]', error)
    // Don't throw — stock restoration failure should not break order cancellation
  }

  return results
}
