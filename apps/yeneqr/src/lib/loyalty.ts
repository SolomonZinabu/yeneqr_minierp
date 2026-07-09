// ============================================================
// Yene QR — Loyalty Program Engine
// ============================================================

// Default earning rule: 1 point per 100 ETB spent
const DEFAULT_POINTS_PER_AMOUNT = 100
const DEFAULT_POINTS_EARNED = 1
const DEFAULT_POINT_VALUE_ETB = 5 // 1 point = 5 ETB redemption value

export interface LoyaltyConfig {
  pointsPerAmount: number  // Spend this much to earn points
  pointsEarned: number     // Earn this many points
  pointValueETB: number    // Value of 1 point in ETB
  minimumRedemption: number // Minimum points to redeem
  welcomeBonus: number     // Points given on first order
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  pointsPerAmount: DEFAULT_POINTS_PER_AMOUNT,
  pointsEarned: DEFAULT_POINTS_EARNED,
  pointValueETB: DEFAULT_POINT_VALUE_ETB,
  minimumRedemption: 10,
  welcomeBonus: 5,
}

/**
 * Calculate how many loyalty points a customer earns for a given order total.
 */
export function calculatePointsEarned(
  orderTotal: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): number {
  return Math.floor(orderTotal / config.pointsPerAmount) * config.pointsEarned
}

/**
 * Calculate the monetary value of a given number of loyalty points.
 */
export function calculateRedemptionValue(
  points: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): number {
  return points * config.pointValueETB
}

/**
 * Check whether a customer has enough points to redeem.
 */
export function canRedeemPoints(
  points: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): boolean {
  return points >= config.minimumRedemption
}

/**
 * Calculate the maximum redeemable points for a given cart total,
 * so the discount never exceeds the subtotal.
 */
export function getMaxRedeemablePoints(
  availablePoints: number,
  cartSubtotal: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): number {
  if (!canRedeemPoints(availablePoints, config)) return 0

  // The max points we can use such that the discount doesn't exceed the subtotal
  const maxPointsForSubtotal = Math.floor(cartSubtotal / config.pointValueETB)
  return Math.min(availablePoints, maxPointsForSubtotal)
}

// ============================================================
// Loyalty Tiers
// ============================================================

export interface LoyaltyTier {
  name: string
  minPoints: number
  maxPoints: number
  bonusPercent: number  // Bonus on points earned
  benefits: string[]
  color: string
  icon: string
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 99,
    bonusPercent: 0,
    benefits: [
      'Earn 1 point per 100 ETB',
      'Redeem points for discounts',
    ],
    color: '#CD7F32',
    icon: '🥉',
  },
  {
    name: 'Silver',
    minPoints: 100,
    maxPoints: 499,
    bonusPercent: 5,
    benefits: [
      '5% bonus on points earned',
      'Priority seating on request',
      'Birthday reward: 25 bonus points',
    ],
    color: '#C0C0C0',
    icon: '🥈',
  },
  {
    name: 'Gold',
    minPoints: 500,
    maxPoints: 999,
    bonusPercent: 10,
    benefits: [
      '10% bonus on points earned',
      'Priority support',
      'Exclusive menu access',
      'Birthday reward: 50 bonus points',
      'Free dessert once a month',
    ],
    color: '#FFD700',
    icon: '🥇',
  },
  {
    name: 'Platinum',
    minPoints: 1000,
    maxPoints: Infinity,
    bonusPercent: 15,
    benefits: [
      '15% bonus on points earned',
      'Exclusive offers & early access',
      'Priority support',
      'Complimentary appetizer per visit',
      'Birthday reward: 100 bonus points',
      'Invite-only events',
    ],
    color: '#E5E4E2',
    icon: '💎',
  },
]

/**
 * Get the customer's loyalty tier based on their total points.
 * Returns the tier name string (for backwards compatibility).
 */
export function getCustomerTier(points: number): string {
  if (points >= 1000) return 'Platinum'
  if (points >= 500) return 'Gold'
  if (points >= 100) return 'Silver'
  return 'Bronze'
}

/**
 * Get the full tier object with benefits for a given tier name.
 */
export function getTierBenefits(tierName: string): LoyaltyTier {
  return LOYALTY_TIERS.find(t => t.name === tierName) || LOYALTY_TIERS[0]
}

/**
 * Get detailed customer tier info with localized names and color.
 */
export function getCustomerTierInfo(points: number): { tier: string; nameEn: string; nameAm: string; color: string; minPoints: number } {
  if (points >= 1000) return { tier: 'platinum', nameEn: 'Platinum', nameAm: 'ፕላቲነም', color: '#E5E4E2', minPoints: 1000 }
  if (points >= 500) return { tier: 'gold', nameEn: 'Gold', nameAm: 'ወርቅ', color: '#FFD700', minPoints: 500 }
  if (points >= 100) return { tier: 'silver', nameEn: 'Silver', nameAm: 'ብር', color: '#C0C0C0', minPoints: 100 }
  return { tier: 'bronze', nameEn: 'Bronze', nameAm: 'ነሐስ', color: '#CD7F32', minPoints: 0 }
}

/**
 * Get the points bonus multiplier for a given tier.
 */
export function getTierBonus(tier: string): number {
  switch (tier) {
    case 'platinum': return 0.15
    case 'gold': return 0.10
    case 'silver': return 0.05
    default: return 0
  }
}

/**
 * Get the list of benefit descriptions for a given tier.
 */
export function getTierBenefitList(tier: string): string[] {
  switch (tier) {
    case 'platinum': return ['15% points bonus', 'Priority support', 'Exclusive offers', 'Free dessert monthly']
    case 'gold': return ['10% points bonus', 'Priority support', 'Birthday reward']
    case 'silver': return ['5% points bonus', 'Early access to promotions']
    default: return ['Earn 1 point per 100 ETB', 'Redeem points for discounts']
  }
}

/**
 * Calculate points earned with tier bonus applied.
 */
export function calculatePointsWithTierBonus(
  orderTotal: number,
  currentPoints: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): number {
  const basePoints = calculatePointsEarned(orderTotal, config)
  const tier = getTierBenefits(getCustomerTier(currentPoints))
  const bonusPoints = Math.floor(basePoints * (tier.bonusPercent / 100))
  return basePoints + bonusPoints
}

// ============================================================
// Loyalty Point Crediting (used on order completion)
// ============================================================

/**
 * Credit loyalty points to the customer after an order is completed.
 *
 * - Idempotent: checks for an existing `loyalty_points_credited` OrderEvent
 *   to prevent double-crediting if called more than once.
 * - Only credits if the order has an associated customer (customerId).
 * - Applies the customer's tier bonus (Bronze/Silver/Gold/Platinum).
 * - Updates Customer.loyaltyPoints, totalSpent, visitCount, lastVisitAt.
 * - Creates an OrderEvent with type `loyalty_points_credited` for audit trail.
 *
 * @returns The number of points credited, or 0 if none were credited.
 */
export async function creditLoyaltyPoints(
  orderId: string,
  restaurantId: string
): Promise<{ pointsCredited: number; customerId: string | null }> {
  // Dynamic import to avoid circular dependency at module load time
  const { db } = await import('@/lib/db')

  // Fetch the order with customer data
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalAmountCents: true,
      customerId: true,
      restaurantId: true,
    },
  })

  if (!order || !order.customerId) {
    // No customer linked to this order — nothing to credit
    return { pointsCredited: 0, customerId: order?.customerId ?? null }
  }

  // ── Idempotency check: skip if points already credited for this order ──
  const existingCredit = await db.orderEvent.findFirst({
    where: {
      orderId,
      event: 'loyalty_points_credited',
    },
  })
  if (existingCredit) {
    return { pointsCredited: 0, customerId: order.customerId }
  }

  // Fetch current customer state
  const customer = await db.customer.findUnique({
    where: { id: order.customerId },
    select: { id: true, loyaltyPoints: true, totalSpentCents: true, visitCount: true },
  })

  if (!customer) {
    return { pointsCredited: 0, customerId: order.customerId }
  }

  // Calculate points with tier bonus
  // calculatePointsWithTierBonus expects ETB amount, so convert from cents
  const pointsToCredit = calculatePointsWithTierBonus(
    order.totalAmountCents / 100,
    customer.loyaltyPoints
  )

  if (pointsToCredit <= 0) {
    // Order total too low to earn any points — still record the event
    // so we don't recheck every time
    await db.orderEvent.create({
      data: {
        orderId,
        restaurantId,
        event: 'loyalty_points_credited',
        data: JSON.stringify({ pointsCredited: 0, orderTotal: order.totalAmountCents, reason: 'below_threshold' }),
        performedByType: 'system',
      },
    })
    return { pointsCredited: 0, customerId: order.customerId }
  }

  // Update customer loyalty points, total spent, visit count, and last visit
  const now = new Date()
  await db.customer.update({
    where: { id: customer.id },
    data: {
      loyaltyPoints: { increment: pointsToCredit },
      totalSpentCents: { increment: order.totalAmountCents },
      visitCount: { increment: 1 },
      lastVisitAt: now,
    },
  })

  // Create OrderEvent audit trail for the crediting
  await db.orderEvent.create({
    data: {
      orderId,
      restaurantId,
      event: 'loyalty_points_credited',
      data: JSON.stringify({
        pointsCredited: pointsToCredit,
        orderTotal: order.totalAmountCents,
        previousPoints: customer.loyaltyPoints,
        newPoints: customer.loyaltyPoints + pointsToCredit,
        tier: getCustomerTier(customer.loyaltyPoints),
      }),
      performedByType: 'system',
    },
  })

  console.info('[LOYALTY_CREDITED]', {
    orderId,
    customerId: customer.id,
    pointsCredited: pointsToCredit,
    orderTotal: order.totalAmountCents,
    previousPoints: customer.loyaltyPoints,
  })

  return { pointsCredited: pointsToCredit, customerId: order.customerId }
}
