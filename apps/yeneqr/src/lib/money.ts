// ============================================================
// Yene QR — Money Utility
// All monetary values stored as Int (cents) in the database.
// 1 ETB = 100 cents. This eliminates Float precision issues.
// ============================================================

/** Convert ETB amount (e.g., 150.50) to cents (15050) */
export function toCents(etb: number): number {
  return Math.round(etb * 100)
}

/** Convert cents (e.g., 15050) to ETB amount (150.50) */
export function fromCents(cents: number): number {
  return cents / 100
}

/** Format cents as ETB currency string (e.g., "ETB 150.50") */
export function formatCents(cents: number, currency: string = 'ETB'): string {
  const etb = fromCents(cents)
  return `${currency} ${etb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Format cents as a number string with 2 decimal places (e.g., "150.50") */
export function formatCentsAsNumber(cents: number): string {
  return fromCents(cents).toFixed(2)
}

/** 
 * Convert a promotion discount value to cents.
 * For "fixed" type: the value is in ETB, so multiply by 100.
 * For "percentage" type: the value is a percentage (e.g., 10.5 = 10.5%), stored as basis points (1050).
 */
export function discountToCents(value: number, discountType: string): number {
  if (discountType === 'percentage') {
    // Store as basis points: 10.50% = 1050
    return Math.round(value * 100)
  }
  // Fixed: store as cents
  return toCents(value)
}

/**
 * Convert a promotion discount value from cents back to display value.
 * For "fixed" type: divide by 100 to get ETB.
 * For "percentage" type: divide by 100 to get percentage (1050 → 10.50%).
 */
export function discountFromCents(cents: number, discountType: string): number {
  return cents / 100
}

/**
 * Calculate discount amount in cents from a subtotal (in cents) and a promotion.
 * Returns the discount amount in cents.
 */
export function calculateDiscountAmountCents(
  subtotalCents: number,
  discountValueCents: number,
  discountType: string,
  maxDiscountCents?: number | null
): number {
  let discountCents = 0
  
  if (discountType === 'percentage') {
    // discountValueCents is in basis points (1050 = 10.50%)
    const percentage = discountValueCents / 100
    discountCents = Math.round(subtotalCents * percentage / 100)
  } else {
    // Fixed amount, already in cents
    discountCents = discountValueCents
  }
  
  // Cap the discount if maxDiscount is set
  if (maxDiscountCents && maxDiscountCents > 0 && discountCents > maxDiscountCents) {
    discountCents = maxDiscountCents
  }
  
  // Discount cannot exceed subtotal
  if (discountCents > subtotalCents) {
    discountCents = subtotalCents
  }
  
  return discountCents
}

/**
 * Calculate order totals in cents from line items.
 * All inputs and outputs are in cents.
 */
export function calculateOrderTotalsCents(params: {
  subtotalCents: number
  taxRate: number          // e.g., 0.15 for 15%
  serviceChargeRate: number // e.g., 0.10 for 10%
  discountAmountCents: number
  tipAmountCents: number
  packagingChargeCents?: number // Packaging fee for takeaway (default 0)
}): {
  taxAmountCents: number
  serviceChargeCents: number
  totalAmountCents: number
} {
  const { subtotalCents, taxRate, serviceChargeRate, discountAmountCents, tipAmountCents, packagingChargeCents = 0 } = params
  
  const taxAmountCents = Math.round(subtotalCents * taxRate)
  const serviceChargeCents = Math.round(subtotalCents * serviceChargeRate)
  
  const totalAmountCents = Math.max(0,
    subtotalCents + taxAmountCents + serviceChargeCents + packagingChargeCents - discountAmountCents + tipAmountCents
  )
  
  return { taxAmountCents, serviceChargeCents, totalAmountCents }
}

/**
 * Phase 2.15: Calculate order totals with per-item tax flexibility.
 * Each item can have its own tax rate (or be tax-exempt).
 *
 * Usage:
 *   const result = calculateOrderTotalsWithPerItemTax({
 *     items: [
 *       { priceCents: 5000, quantity: 2, isTaxExempt: false, taxRate: null },
 *       { priceCents: 3000, quantity: 1, isTaxExempt: true, taxRate: null },
 *       { priceCents: 4000, quantity: 1, isTaxExempt: false, taxRate: 0.10 },
 *     ],
 *     restaurantTaxRate: 0.15,
 *     serviceChargeRate: 0.10,
 *     discountAmountCents: 0,
 *     tipAmountCents: 0,
 *   })
 */
export function calculateOrderTotalsWithPerItemTax(params: {
  items: Array<{
    priceCents: number
    quantity: number
    isTaxExempt?: boolean
    taxRate?: number | null
  }>
  restaurantTaxRate: number
  serviceChargeRate: number
  discountAmountCents: number
  tipAmountCents: number
  packagingChargeCents?: number
}): {
  subtotalCents: number
  taxAmountCents: number
  serviceChargeCents: number
  totalAmountCents: number
} {
  const { items, restaurantTaxRate, serviceChargeRate, discountAmountCents, tipAmountCents, packagingChargeCents = 0 } = params

  let subtotalCents = 0
  let taxAmountCents = 0

  for (const item of items) {
    const lineTotal = item.priceCents * item.quantity
    subtotalCents += lineTotal

    if (item.isTaxExempt) continue
    const effectiveTaxRate = item.taxRate !== null && item.taxRate !== undefined ? item.taxRate : restaurantTaxRate
    taxAmountCents += Math.round(lineTotal * effectiveTaxRate)
  }

  const serviceChargeCents = Math.round(subtotalCents * serviceChargeRate)
  const totalAmountCents = Math.max(0,
    subtotalCents + taxAmountCents + serviceChargeCents + packagingChargeCents - discountAmountCents + tipAmountCents
  )

  return { subtotalCents, taxAmountCents, serviceChargeCents, totalAmountCents }
}
