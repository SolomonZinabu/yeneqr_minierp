// ============================================================
// Yene QR — Order Routing Resolver
// ============================================================
// Resolves the effective "order routing mode" for a given branch:
//   1. BranchSettings.orderRouting (if set)  — branch-level override
//   2. Restaurant.settings.kitchen.orderRouting (if set) — restaurant default
//   3. 'waiter_first' — safe default
//
// The routing mode controls what happens when a customer places an order:
//   - 'waiter_first':
//       Order is created with status 'pending'. A waiter or manager must
//       accept it (pending → accepted) before kitchen can start preparing.
//       Use case: full-service restaurants where the waiter confirms the
//       order with the customer before firing it to the kitchen.
//
//   - 'direct_to_kitchen':
//       Order is created with status 'accepted' immediately (system
//       performs the pending → accepted transition atomically inside the
//       create transaction). Kitchen can start preparing right away.
//       The waiter is still auto-assigned for delivery, but does not
//       need to "accept" the order.
//       Use case: fast-casual, QSR, self-service kiosks, busy shifts
//       where the waiter would just rubber-stamp every order anyway.
// ============================================================

import { db } from '@/lib/db'

export type OrderRoutingMode = 'waiter_first' | 'direct_to_kitchen'

export const DEFAULT_ORDER_ROUTING: OrderRoutingMode = 'waiter_first'

const VALID_MODES: ReadonlySet<string> = new Set(['waiter_first', 'direct_to_kitchen'])

function normalizeMode(value: unknown): OrderRoutingMode | null {
  if (typeof value !== 'string') return null
  return VALID_MODES.has(value) ? (value as OrderRoutingMode) : null
}

/**
 * Resolve the effective order routing mode for a branch.
 *
 * Resolution order:
 *   1. BranchSettings.orderRouting override (if non-null and valid)
 *   2. Restaurant.settings.kitchen.orderRouting (JSON-parsed; if valid)
 *   3. DEFAULT_ORDER_ROUTING ('waiter_first')
 *
 * This function performs at most 2 DB reads and is safe to call inside
 * the order-creation request path.
 */
export async function resolveOrderRoutingMode(
  restaurantId: string,
  branchId: string
): Promise<OrderRoutingMode> {
  // 1. Try branch-level override first
  const branchSettings = await db.branchSettings.findUnique({
    where: { branchId },
    select: { orderRouting: true },
  })
  const branchMode = normalizeMode(branchSettings?.orderRouting)
  if (branchMode) return branchMode

  // 2. Fall back to restaurant-level setting (stored in Restaurant.settings JSON)
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  })

  if (restaurant?.settings) {
    try {
      const parsed = JSON.parse(restaurant.settings) as Record<string, unknown>
      const kitchen = parsed.kitchen as Record<string, unknown> | undefined
      const restaurantMode = normalizeMode(kitchen?.orderRouting)
      if (restaurantMode) return restaurantMode
    } catch {
      // Swallow parse errors — fall through to default
    }
  }

  // 3. Safe default
  return DEFAULT_ORDER_ROUTING
}

/**
 * Synchronous helper for code paths that already have the raw settings
 * loaded (e.g., the GET settings endpoint returning the effective value
 * to the UI). Pure function — no DB reads.
 */
export function resolveOrderRoutingModeFromSettings(
  branchOrderRouting: string | null | undefined,
  restaurantSettingsJson: string | null | undefined
): OrderRoutingMode {
  const branchMode = normalizeMode(branchOrderRouting)
  if (branchMode) return branchMode

  if (restaurantSettingsJson) {
    try {
      const parsed = JSON.parse(restaurantSettingsJson) as Record<string, unknown>
      const kitchen = parsed.kitchen as Record<string, unknown> | undefined
      const restaurantMode = normalizeMode(kitchen?.orderRouting)
      if (restaurantMode) return restaurantMode
    } catch {
      // fall through
    }
  }

  return DEFAULT_ORDER_ROUTING
}
