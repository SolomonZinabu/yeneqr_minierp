// ============================================================
// Yene QR — Bill Split Helper Utilities
// Shared logic for updating BillSplit status after payments
// ============================================================

import { db } from '@/lib/db'

/**
 * Update BillSplit paidAmountCents and status after a split payment completes.
 * Adds the payment amount to the existing paidAmountCents and determines
 * whether the split is now 'partial' or 'paid'.
 *
 * Returns true if the bill split is fully paid, false otherwise.
 */
export async function updateBillSplitAfterPayment(
  billSplitId: string,
  paymentAmountCents: number
): Promise<{ fullyPaid: boolean; billSplitId: string }> {
  const billSplit = await db.billSplit.findUnique({
    where: { id: billSplitId },
  })

  if (!billSplit) {
    console.warn('[BILL_SPLIT_UPDATE] BillSplit not found', { billSplitId })
    return { fullyPaid: false, billSplitId }
  }

  const newPaidAmountCents = billSplit.paidAmountCents + paymentAmountCents
  const newStatus: string = newPaidAmountCents >= billSplit.totalAmountCents ? 'paid' : 'partial'

  await db.billSplit.update({
    where: { id: billSplitId },
    data: {
      paidAmountCents: newPaidAmountCents,
      status: newStatus,
      updatedAt: new Date(),
    },
  })

  console.info('[BILL_SPLIT_UPDATED]', {
    billSplitId,
    previousPaidCents: billSplit.paidAmountCents,
    addedCents: paymentAmountCents,
    newPaidCents: newPaidAmountCents,
    totalCents: billSplit.totalAmountCents,
    newStatus,
  })

  return { fullyPaid: newStatus === 'paid', billSplitId }
}

/**
 * Check if all bill splits for an order are fully paid.
 * Returns true only if there are splits AND every one of them is paid.
 */
export async function areAllSplitsPaid(orderId: string): Promise<boolean> {
  const splits = await db.billSplit.findMany({
    where: { orderId },
  })

  if (splits.length === 0) return false

  return splits.every((s) => s.status === 'paid')
}

/**
 * Parse splitData JSON from a BillSplit record.
 * Returns an array of split entries with name, amountCents, etc.
 */
export function parseSplitData(splitDataJson: string | null): {
  name: string
  amountCents: number
  items?: string[]
  percentage?: number
}[] {
  if (!splitDataJson) return []
  try {
    return JSON.parse(splitDataJson)
  } catch {
    console.error('[BILL_SPLIT_PARSE] Failed to parse splitData JSON', { splitDataJson })
    return []
  }
}
