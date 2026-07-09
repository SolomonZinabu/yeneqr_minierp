// ============================================================
// Yene QR — Subscription Limit Enforcement Utility
// Checks plan limits before creating tables, branches, staff, etc.
// ============================================================

import { db } from './db'

export interface PlanLimits {
  maxBranches: number   // -1 = unlimited
  maxTables: number     // -1 = unlimited
  maxStaff: number      // -1 = unlimited
  maxMenuItems: number  // -1 = unlimited
  maxQRCodes: number    // -1 = unlimited
}

export interface LimitCheckResult {
  allowed: boolean
  current: number
  limit: number
  resource: string
  message?: string
}

/**
 * Parse plan limits JSON from the SubscriptionPlan model.
 * Handles missing keys gracefully with defaults.
 */
export function parsePlanLimits(limitsJson: string | null | undefined): PlanLimits {
  if (!limitsJson) {
    return { maxBranches: 1, maxTables: 20, maxStaff: 5, maxMenuItems: 50, maxQRCodes: 20 }
  }
  try {
    const parsed = JSON.parse(limitsJson)
    return {
      maxBranches: parsed.maxBranches ?? 1,
      maxTables: parsed.maxTables ?? parsed.maxQRCodes ?? 20,
      maxStaff: parsed.maxStaff ?? 5,
      maxMenuItems: parsed.maxMenuItems ?? 50,
      maxQRCodes: parsed.maxQRCodes ?? 20,
    }
  } catch {
    return { maxBranches: 1, maxTables: 20, maxStaff: 5, maxMenuItems: 50, maxQRCodes: 20 }
  }
}

/**
 * Get the current active subscription plan limits for a restaurant.
 * Returns null if no active subscription found.
 */
export async function getRestaurantPlanLimits(restaurantId: string): Promise<{ limits: PlanLimits; planName: string; planSlug: string; status: string } | null> {
  const subscription = await db.subscription.findUnique({
    where: { restaurantId },
    include: { plan: true },
  })

  if (!subscription || !subscription.plan) return null

  return {
    limits: parsePlanLimits(subscription.plan.limits),
    planName: subscription.plan.name,
    planSlug: subscription.plan.slug,
    status: subscription.status,
  }
}

/**
 * Check if a restaurant can create more of a given resource.
 *
 * NOTE: Subscription limit enforcement has been intentionally DISABLED.
 * All CRUD operations (tables, branches, staff, menu items, QR codes, etc.)
 * are allowed regardless of subscription status or plan tier.
 *
 * The function still returns current count + plan limit info so that
 * dashboards can display usage statistics, but it never blocks creation.
 *
 * Returns a LimitCheckResult indicating the action is allowed (always true)
 * along with the current usage and configured plan limit (for display only).
 */
export async function checkLimit(
  restaurantId: string,
  resource: 'tables' | 'branches' | 'staff' | 'menuItems' | 'qrCodes',
  _increment: number = 1
): Promise<LimitCheckResult> {
  const planInfo = await getRestaurantPlanLimits(restaurantId)

  // No subscription record — still allow (subscription gating is disabled)
  if (!planInfo) {
    return { allowed: true, current: 0, limit: -1, resource }
  }

  const { limits } = planInfo
  let limit: number
  let current: number

  switch (resource) {
    case 'branches': {
      limit = limits.maxBranches
      current = await db.branch.count({ where: { restaurantId, isActive: true } })
      break
    }
    case 'tables': {
      limit = limits.maxTables
      current = await db.table.count({
        where: { branch: { restaurantId }, isActive: true },
      })
      break
    }
    case 'staff': {
      limit = limits.maxStaff
      current = await db.restaurantUser.count({ where: { restaurantId, isActive: true } })
      break
    }
    case 'menuItems': {
      limit = limits.maxMenuItems
      current = await db.menuItem.count({ where: { restaurantId, isAvailable: true } })
      break
    }
    case 'qrCodes': {
      limit = limits.maxQRCodes
      current = await db.qRCode.count({ where: { restaurantId, isActive: true } })
      break
    }
    default:
      return { allowed: true, current: 0, limit: -1, resource }
  }

  // Always allow — subscription gating is disabled.
  // We still surface the configured limit + current count for dashboard display.
  return { allowed: true, current, limit, resource }
}

/**
 * Format a limit check result as a user-friendly error response.
 */
export function limitCheckErrorResponse(result: LimitCheckResult): { error: string; limit: typeof result } {
  return {
    error: result.message || `Subscription limit reached for ${result.resource}`,
    limit: result,
  }
}
