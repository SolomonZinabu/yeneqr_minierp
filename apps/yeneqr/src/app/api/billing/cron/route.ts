// ============================================================
// Yene QR — Billing Cron Endpoint
// ============================================================
// Run daily (e.g. via curl from a system cron) to:
//   - Mark overdue subscription invoices across all restaurants
//   - Generate recurring subscription invoices when periods end
//   - Sync subscription status (active / past_due)
//   - Mark overdue platform-fee invoices
//   - Auto-generate platform-fee invoices from unbilled ledger entries
//     older than 7 days
//
// Auth: requires a CRON_SECRET shared secret in the
// `x-cron-secret` header. This avoids exposing the endpoint
// to the public internet without authentication.
//
//   curl -X POST https://app.yeneqr.com/api/billing/cron \
//        -H "x-cron-secret: $CRON_SECRET"
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  syncBillingForAllSubscriptions,
  syncPlatformFeeInvoicesForAllRestaurants,
} from '@/lib/billing'

async function runBillingCron() {
  const [subResult, feeResult] = await Promise.all([
    syncBillingForAllSubscriptions(),
    syncPlatformFeeInvoicesForAllRestaurants(),
  ])
  return {
    subscription: subResult,
    platformFee: feeResult,
    ranAt: new Date().toISOString(),
  }
}

export async function POST(request: NextRequest) {
  // Validate shared secret
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on the server' },
      { status: 500 }
    )
  }
  const provided = request.headers.get('x-cron-secret')
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runBillingCron()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[BILLING_CRON_ERROR]', error)
    return NextResponse.json(
      { error: 'Billing cron failed', detail: String(error) },
      { status: 500 }
    )
  }
}

// Also allow GET for simple "hit this URL" crons that don't set headers
export async function GET(request: NextRequest) {
  // Same secret check but via ?secret= query param
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on the server' },
      { status: 500 }
    )
  }
  const provided = new URL(request.url).searchParams.get('secret')
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runBillingCron()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[BILLING_CRON_ERROR]', error)
    return NextResponse.json(
      { error: 'Billing cron failed', detail: String(error) },
      { status: 500 }
    )
  }
}
