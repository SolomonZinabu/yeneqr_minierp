// ============================================================
// Yene QR — Billing & Invoice Helpers
// ============================================================
// Centralized logic for:
//   - Auto-marking pending invoices as overdue (past dueDate)
//   - Auto-generating the next period's invoice when a
//     subscription's currentPeriodEnd has passed
//   - Suspending subscriptions when invoices are >7 days overdue
//   - Audit logging for invoice lifecycle events
//   - In-app notification on invoice creation / overdue / paid
//
// All functions are idempotent and safe to call repeatedly
// (they short-circuit when no work is needed).
// ============================================================

import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit-log'
import { sendInvoiceNotification } from '@/lib/notifications'

export const VAT_RATE = 0.15
export const OVERDUE_SUSPEND_DAYS = 7

// ============================================================
// Audit helpers
// ============================================================

interface InvoiceAuditParams {
  restaurantId: string
  userId?: string
  performedByType?: string
  invoiceId: string
  invoiceNumber: string
  amountCents: number
  totalCents: number
  status: string
  reason?: string
}

export async function logInvoiceCreated(p: InvoiceAuditParams): Promise<void> {
  return createAuditLog({
    restaurantId: p.restaurantId,
    userId: p.userId,
    action: 'invoice_created',
    entityType: 'invoice',
    entityId: p.invoiceId,
    performedByType: p.performedByType,
    newData: {
      invoiceNumber: p.invoiceNumber,
      amountCents: p.amountCents,
      totalCents: p.totalCents,
      status: p.status,
    },
  })
}

export async function logInvoicePaid(p: InvoiceAuditParams): Promise<void> {
  return createAuditLog({
    restaurantId: p.restaurantId,
    userId: p.userId,
    action: 'invoice_paid',
    entityType: 'invoice',
    entityId: p.invoiceId,
    performedByType: p.performedByType,
    previousData: { status: 'pending' },
    newData: {
      invoiceNumber: p.invoiceNumber,
      totalCents: p.totalCents,
      status: 'paid',
    },
  })
}

export async function logInvoiceCancelled(p: InvoiceAuditParams): Promise<void> {
  return createAuditLog({
    restaurantId: p.restaurantId,
    userId: p.userId,
    action: 'invoice_cancelled',
    entityType: 'invoice',
    entityId: p.invoiceId,
    performedByType: p.performedByType,
    previousData: { status: 'pending' },
    newData: {
      invoiceNumber: p.invoiceNumber,
      status: 'cancelled',
      reason: p.reason,
    },
  })
}

// ============================================================
// Invoice creation
// ============================================================

interface CreateInvoiceInput {
  subscriptionId: string
  restaurantId: string
  amountCents: number
  dueInDays?: number
  description?: string
  userId?: string
  performedByType?: string
  autoNotify?: boolean
}

/**
 * Create a new invoice. Tax is computed at VAT_RATE (15%).
 * Generates an invoice number, audit log, and (optionally)
 * an in-app notification to the restaurant owner.
 */
export async function createInvoice(input: CreateInvoiceInput) {
  const {
    subscriptionId,
    restaurantId,
    amountCents,
    dueInDays = 7,
    description,
    userId,
    performedByType = 'system',
    autoNotify = true,
  } = input

  if (amountCents <= 0) {
    throw new Error('amountCents must be greater than 0')
  }

  const taxCents = Math.round(amountCents * VAT_RATE)
  const totalCents = amountCents + taxCents
  const now = new Date()
  const dueDate = new Date(now.getTime() + dueInDays * 24 * 60 * 60 * 1000)

  const invoice = await db.invoice.create({
    data: {
      subscriptionId,
      amountCents,
      taxCents,
      totalCents,
      status: 'pending',
      dueDate,
      invoiceNumber: `INV-${Date.now()}`,
    },
    include: {
      subscription: {
        select: {
          id: true,
          plan: {
            select: { id: true, name: true, slug: true, priceCents: true, yearlyPriceCents: true },
          },
        },
      },
    },
  })

  // Audit log (fire-and-forget)
  logInvoiceCreated({
    restaurantId,
    userId,
    performedByType,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amountCents,
    totalCents,
    status: 'pending',
  }).catch((e) => console.error('[AUDIT_INVOICE_CREATE]', e))

  // In-app notification (fire-and-forget)
  if (autoNotify) {
    sendInvoiceNotification(restaurantId, {
      type: 'invoice_created',
      invoiceNumber: invoice.invoiceNumber,
      amountCents: totalCents,
      dueDate: dueDate.toISOString(),
      description,
    }).catch((e) => console.error('[NOTIFY_INVOICE_CREATE]', e))
  }

  return invoice
}

// ============================================================
// Auto-overdue: mark pending invoices as overdue once past dueDate
// ============================================================

/**
 * Mark all pending invoices past their dueDate as 'overdue'.
 * Returns the number of invoices updated.
 *
 * This is safe to call on every GET /invoices request — it
 * short-circuits via the WHERE clause when nothing is overdue.
 */
export async function markOverdueInvoices(subscriptionId?: string): Promise<number> {
  const where: Record<string, unknown> = {
    status: 'pending',
    dueDate: { lt: new Date() },
  }
  if (subscriptionId) where.subscriptionId = subscriptionId

  const result = await db.invoice.updateMany({
    where,
    data: { status: 'overdue' },
  })

  return result.count
}

// ============================================================
// Auto-recurring: generate next-period invoice when period ends
// ============================================================

/**
 * For a given subscription, if currentPeriodEnd has passed,
 * generate the next period's invoice (using the plan's monthly
 * price) and roll the period forward by one month.
 *
 * Idempotent: if there's already a pending invoice created in
 * the last 24h for this subscription, it skips generation.
 *
 * Returns the new invoice (or null if no generation happened).
 */
export async function maybeGenerateRecurringInvoice(
  subscriptionId: string
): Promise<{ invoice: Awaited<ReturnType<typeof createInvoice>> | null; rolledPeriod: boolean }> {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      restaurant: { select: { id: true, name: true } },
    },
  })

  if (!subscription) return { invoice: null, rolledPeriod: false }

  // Only active subscriptions get recurring invoices
  if (subscription.status !== 'active') {
    return { invoice: null, rolledPeriod: false }
  }

  const now = new Date()
  const periodEnd = new Date(subscription.currentPeriodEnd)

  // Period hasn't ended yet — nothing to do
  if (periodEnd > now) {
    return { invoice: null, rolledPeriod: false }
  }

  // Check for an existing pending/overdue invoice created in the last 24h
  // to avoid double-generation if the user hits the endpoint multiple times.
  const recent = await db.invoice.findFirst({
    where: {
      subscriptionId,
      createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  })
  if (recent) {
    return { invoice: null, rolledPeriod: false }
  }

  // Use plan monthly price OR per-restaurant custom override (for Configurable plan / special deals)
  // yearlyPriceCents is optional / not used here
  const amountCents = subscription.customPriceCents != null
    ? subscription.customPriceCents
    : subscription.plan.priceCents
  if (amountCents <= 0) {
    // Free plan (or Configurable with customPriceCents=0) — just roll the period, no invoice needed
    const newStart = new Date(periodEnd)
    const newEnd = new Date(newStart)
    newEnd.setMonth(newEnd.getMonth() + 1)
    await db.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: newStart,
        currentPeriodEnd: newEnd,
      },
    })
    return { invoice: null, rolledPeriod: true }
  }

  // Generate the invoice
  const invoice = await createInvoice({
    subscriptionId,
    restaurantId: subscription.restaurant.id,
    amountCents,
    dueInDays: 7,
    description: `Recurring subscription — ${subscription.plan.name} plan${subscription.customPriceCents != null ? ' (custom price)' : ''} (${periodEnd.toISOString().slice(0, 10)} → +1mo)`,
    performedByType: 'system',
  })

  // Roll the period forward
  const newStart = new Date(periodEnd)
  const newEnd = new Date(newStart)
  newEnd.setMonth(newEnd.getMonth() + 1)
  await db.subscription.update({
    where: { id: subscriptionId },
    data: {
      currentPeriodStart: newStart,
      currentPeriodEnd: newEnd,
    },
  })

  return { invoice, rolledPeriod: true }
}

// ============================================================
// Subscription protection: suspend if invoice overdue > 7 days
// ============================================================

/**
 * For a given subscription, if any invoice is overdue by more
 * than OVERDUE_SUSPEND_DAYS days, mark the subscription as
 * 'past_due' (so the platform can restrict access). When all
 * overdue invoices are paid, the subscription returns to 'active'.
 *
 * Returns the new subscription status (or null if no change).
 */
export async function syncSubscriptionStatus(
  subscriptionId: string
): Promise<string | null> {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, status: true },
  })
  if (!subscription) return null

  // Never touch cancelled / expired subscriptions
  if (subscription.status === 'cancelled' || subscription.status === 'expired') {
    return subscription.status
  }

  const now = new Date()
  const overdueThreshold = new Date(now.getTime() - OVERDUE_SUSPEND_DAYS * 24 * 60 * 60 * 1000)

  const overdueInvoices = await db.invoice.count({
    where: {
      subscriptionId,
      status: 'overdue',
      dueDate: { lt: overdueThreshold },
    },
  })

  const newStatus = overdueInvoices > 0 ? 'past_due' : 'active'
  if (subscription.status !== newStatus) {
    await db.subscription.update({
      where: { id: subscriptionId },
      data: { status: newStatus },
    })
    return newStatus
  }
  return subscription.status
}

// ============================================================
// Billing sync — runs all maintenance for a subscription
// ============================================================

/**
 * Run the full billing maintenance cycle for a subscription:
 *   1. Mark pending invoices as overdue if past dueDate
 *   2. Generate the next period's invoice if period ended
 *   3. Sync subscription status (active / past_due)
 *
 * Call this on:
 *   - GET /invoices (refresh)
 *   - GET /subscription (page load)
 *   - /api/billing/cron (periodic, all subscriptions)
 */
export async function syncBillingForSubscription(subscriptionId: string): Promise<{
  markedOverdue: number
  generatedInvoice: Awaited<ReturnType<typeof createInvoice>> | null
  newStatus: string | null
}> {
  const markedOverdue = await markOverdueInvoices(subscriptionId)
  const { invoice } = await maybeGenerateRecurringInvoice(subscriptionId)
  const newStatus = await syncSubscriptionStatus(subscriptionId)
  return { markedOverdue, generatedInvoice: invoice, newStatus }
}

/**
 * Run billing maintenance for ALL active subscriptions.
 * Intended to be called from a daily cron endpoint.
 */
export async function syncBillingForAllSubscriptions(): Promise<{
  processed: number
  markedOverdue: number
  generated: number
}> {
  const subscriptions = await db.subscription.findMany({
    where: { status: { in: ['active', 'past_due', 'trial'] } },
    select: { id: true },
  })

  let markedOverdueTotal = 0
  let generatedTotal = 0

  for (const sub of subscriptions) {
    try {
      const result = await syncBillingForSubscription(sub.id)
      markedOverdueTotal += result.markedOverdue
      if (result.generatedInvoice) generatedTotal++
    } catch (e) {
      console.error(`[BILLING_SYNC_ERROR] sub=${sub.id}`, e)
    }
  }

  return {
    processed: subscriptions.length,
    markedOverdue: markedOverdueTotal,
    generated: generatedTotal,
  }
}

// ============================================================
// PLATFORM-FEE INVOICE MAINTENANCE
// ============================================================
// Mirrors the subscription billing pipeline but for PlatformFeeLedger
// and PlatformFeeInvoice. Runs alongside the subscription cron.

/**
 * Mark platform-fee invoices as 'overdue' when past their dueDate.
 * Mirrors markOverdueInvoices() but for PlatformFeeInvoice.
 */
export async function markOverduePlatformFeeInvoices(): Promise<number> {
  const result = await db.platformFeeInvoice.updateMany({
    where: {
      status: 'pending',
      dueDate: { lt: new Date() },
    },
    data: { status: 'overdue' },
  })
  return result.count
}

/**
 * Auto-generate a platform-fee invoice for a single restaurant if they
 * have unbilled ledger entries older than 7 days.
 *
 * This runs on the cron so restaurants get a monthly invoice without
 * having to manually click "Generate Invoice" in the UI.
 */
export async function maybeGeneratePlatformFeeInvoice(
  restaurantId: string
): Promise<{ invoice: { id: string; totalFeeCents: number } | null; generated: boolean }> {
  // Find unbilled entries older than 7 days (grace period so we don't
  // invoice on every single transaction)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)

  const unbilledEntries = await db.platformFeeLedger.findMany({
    where: {
      restaurantId,
      status: 'unbilled',
      createdAt: { lte: cutoff },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (unbilledEntries.length === 0) {
    return { invoice: null, generated: false }
  }

  const totalFeeCents = unbilledEntries.reduce((sum, e) => sum + e.feeAmountCents, 0)
  if (totalFeeCents <= 0) {
    return { invoice: null, generated: false }
  }

  const periodStart = unbilledEntries[0].createdAt
  const periodEnd = unbilledEntries[unbilledEntries.length - 1].createdAt
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30) // 30-day payment window

  try {
    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.platformFeeInvoice.create({
        data: {
          restaurantId,
          invoiceNumber: `PFI-${Date.now()}`,
          periodStart,
          periodEnd,
          totalFeeCents,
          transactionCount: unbilledEntries.length,
          status: 'pending',
          dueDate,
        },
      })

      await tx.platformFeeLedger.updateMany({
        where: { id: { in: unbilledEntries.map(e => e.id) } },
        data: { invoiceId: inv.id, status: 'invoiced' },
      })

      return inv
    })

    console.info('[PLATFORM_FEE_INVOICE_GENERATED]', {
      restaurantId,
      invoiceId: invoice.id,
      totalFeeCents,
      transactionCount: unbilledEntries.length,
    })

    return { invoice: { id: invoice.id, totalFeeCents }, generated: true }
  } catch (err) {
    console.error('[PLATFORM_FEE_INVOICE_GENERATE_ERROR]', restaurantId, err)
    return { invoice: null, generated: false }
  }
}

/**
 * Run platform-fee billing maintenance for ALL restaurants that have
 * unbilled ledger entries. Intended to be called from the daily cron
 * alongside syncBillingForAllSubscriptions().
 */
export async function syncPlatformFeeInvoicesForAllRestaurants(): Promise<{
  processed: number
  markedOverdue: number
  generated: number
}> {
  const markedOverdue = await markOverduePlatformFeeInvoices()

  // Find all restaurants with unbilled entries older than 7 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)

  const restaurantsWithUnbilled = await db.platformFeeLedger.findMany({
    where: {
      status: 'unbilled',
      createdAt: { lte: cutoff },
    },
    select: { restaurantId: true },
    distinct: ['restaurantId'],
  })

  let generatedTotal = 0
  for (const { restaurantId } of restaurantsWithUnbilled) {
    try {
      const result = await maybeGeneratePlatformFeeInvoice(restaurantId)
      if (result.generated) generatedTotal++
    } catch (e) {
      console.error(`[PLATFORM_FEE_SYNC_ERROR] restaurant=${restaurantId}`, e)
    }
  }

  return {
    processed: restaurantsWithUnbilled.length,
    markedOverdue,
    generated: generatedTotal,
  }
}

/**
 * Mark a platform-fee invoice as paid and propagate the paid status
 * to all linked ledger entries.
 */
export async function markPlatformFeeInvoicePaid(
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await db.platformFeeInvoice.findUnique({
    where: { id: invoiceId },
  })

  if (!existing) {
    return { success: false, error: 'Invoice not found' }
  }

  if (existing.status === 'paid') {
    return { success: true } // Idempotent
  }

  if (existing.status === 'cancelled') {
    return { success: false, error: 'Cannot mark a cancelled invoice as paid' }
  }

  await db.$transaction([
    db.platformFeeInvoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidAt: new Date() },
    }),
    db.platformFeeLedger.updateMany({
      where: { invoiceId },
      data: { status: 'paid' },
    }),
  ])

  return { success: true }
}
