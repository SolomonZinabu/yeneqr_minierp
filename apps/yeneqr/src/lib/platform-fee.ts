// ============================================================
// Yene QR — Platform Fee Helper
// Centralizes the logic for recording and reversing per-transaction
// platform fees. The fee rate lives on Restaurant.feeRate (decoupled
// from the subscription plan).
//
// Fee basis: subtotal - discount + service charge (the restaurant's
// actual revenue). EXCLUDES: tip (staff money), tax (government
// passthrough), packaging (passthrough).
// ============================================================

import { db } from './db'

/**
 * Default platform fee rate (decimal form) when a restaurant has no
 * feeRate set — always allow the transaction, default to 3%.
 */
export const DEFAULT_FEE_RATE_DECIMAL = 0.03 // 3%

/**
 * Look up a restaurant's current platform fee rate as a DECIMAL
 * (e.g. 0.03 for 3%).
 *
 * DECOUPLED MODEL: The fee rate lives on Restaurant.feeRate, set
 * per-restaurant by the YeneQR admin team. It is NOT tied to the
 * subscription plan — the plan only determines the monthly
 * subscription price + features.
 *
 * Resolution: restaurant.feeRate → 0.03 (3% default)
 */
export async function getRestaurantFeeRate(
  restaurantId: string
): Promise<{ feeRate: number; feeRatePercent: number }> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { feeRate: true },
  })

  const feeRate = restaurant?.feeRate ?? 0.03
  return {
    feeRate,
    feeRatePercent: feeRate * 100,
  }
}

/**
 * Compute the fee basis (the amount the fee should be charged on).
 *
 * The fee should ONLY apply to the restaurant's actual revenue:
 *   subtotal - discount + service charge
 *
 * It should NOT apply to:
 *   - tip (staff money — industry standard: 100% to staff)
 *   - tax (government passthrough — e.g. 15% VAT)
 *   - packaging (passthrough for takeaway containers)
 *   - delivery fee (passthrough)
 *
 * For multi-round payments, the tax/packaging/delivery portions are
 * computed proportionally based on this payment's share of the order.
 *
 * @param paymentAmountCents  Total payment amount (includes tip)
 * @param tipAmountCents      Tip portion of this payment
 * @param order               Order fields needed for proportional calc
 * @returns The fee basis in cents (amount the fee applies to)
 */
function computeFeeBasis(
  paymentAmountCents: number,
  tipAmountCents: number,
  order: {
    totalAmountCents: number
    tipAmountCents: number
    taxAmountCents: number
    packagingChargeCents: number
    deliveryFeeCents: number
  } | null
): number {
  // Start with the payment amount minus tip (tip is always excluded)
  let basis = paymentAmountCents - (tipAmountCents || 0)

  if (!order || order.totalAmountCents <= 0) return Math.max(0, basis)

  // The non-tip portion of the order total
  const orderNonTipTotal = order.totalAmountCents - (order.tipAmountCents || 0)
  if (orderNonTipTotal <= 0) return Math.max(0, basis)

  // This payment's share of the non-tip order total
  const paymentNonTip = paymentAmountCents - (tipAmountCents || 0)
  const paymentShare = paymentNonTip / orderNonTipTotal

  // Proportional tax, packaging, and delivery fee to exclude
  const taxPortion = Math.round(order.taxAmountCents * paymentShare)
  const packagingPortion = Math.round(order.packagingChargeCents * paymentShare)
  const deliveryPortion = Math.round(order.deliveryFeeCents * paymentShare)

  basis = basis - taxPortion - packagingPortion - deliveryPortion

  return Math.max(0, basis)
}

/**
 * Record a platform fee ledger entry for a captured payment.
 * Idempotent — if a ledger entry already exists for this paymentId
 * (unique constraint), the error is swallowed.
 *
 * The fee is calculated on the NET revenue (subtotal + service charge),
 * excluding tip, tax, packaging, and delivery fees.
 *
 * @param params { restaurantId, paymentId, orderId, branchId?, amountCents, tipAmountCents? }
 * @returns the created ledger entry, or null if it already existed / failed
 */
export async function recordPlatformFee(params: {
  restaurantId: string
  paymentId: string
  orderId: string
  branchId?: string | null
  amountCents: number
  tipAmountCents?: number
}): Promise<{ id: string; feeAmountCents: number; feeRate: number } | null> {
  const { restaurantId, paymentId, orderId, branchId, amountCents, tipAmountCents } = params

  if (amountCents <= 0) return null

  // Look up the order to compute the fee basis (exclude tax/packaging/delivery)
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      totalAmountCents: true,
      tipAmountCents: true,
      taxAmountCents: true,
      packagingChargeCents: true,
      deliveryFeeCents: true,
    },
  })

  // Compute the fee basis (net revenue after excluding tip/tax/packaging/delivery)
  const feeBasisCents = computeFeeBasis(amountCents, tipAmountCents || 0, order)

  if (feeBasisCents <= 0) return null

  const { feeRate } = await getRestaurantFeeRate(restaurantId)
  const feeAmountCents = Math.round(feeBasisCents * feeRate)

  if (feeAmountCents <= 0) return null

  try {
    const entry = await db.platformFeeLedger.create({
      data: {
        restaurantId,
        paymentId,
        orderId,
        branchId: branchId || null,
        transactionAmountCents: amountCents, // Full payment amount for audit
        feeRate,
        feeAmountCents, // Fee on net revenue only
        status: 'unbilled',
      },
      select: { id: true, feeAmountCents: true, feeRate: true },
    })
    console.info('[PLATFORM_FEE_RECORDED]', {
      paymentId,
      orderId,
      transactionAmountCents: amountCents,
      tipAmountCents: tipAmountCents || 0,
      feeBasisCents,
      feeRate,
      feeAmountCents,
    })
    return entry
  } catch (err: unknown) {
    // Only swallow Prisma P2002 (unique constraint violation = idempotent)
    // Re-throw other errors so callers can handle real failures
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      // Idempotent — ledger entry already exists for this paymentId
      return null
    }
    console.error('[PLATFORM_FEE_RECORD]', err)
    return null
  }
}

/**
 * Reverse a platform fee ledger entry when a payment is refunded.
 * Sets the ledger entry status to 'reversed' so it's excluded from
 * billing aggregations. If the entry was already invoiced/paid, the
 * reversal still happens — the restaurant will see a credit on the
 * next invoice cycle.
 *
 * @param paymentId The Payment ID whose fee should be reversed
 * @returns true if reversed, false if not found or already reversed
 */
export async function reversePlatformFee(paymentId: string): Promise<boolean> {
  try {
    const entry = await db.platformFeeLedger.findUnique({
      where: { paymentId },
      select: { id: true, status: true },
    })

    if (!entry) return false
    if (entry.status === 'reversed') return true // Idempotent

    await db.platformFeeLedger.update({
      where: { id: entry.id },
      data: { status: 'reversed' },
    })

    console.info('[PLATFORM_FEE_REVERSED]', {
      paymentId,
      ledgerId: entry.id,
      previousStatus: entry.status,
    })
    return true
  } catch (err) {
    console.error('[PLATFORM_FEE_REVERSE]', err)
    return false
  }
}
