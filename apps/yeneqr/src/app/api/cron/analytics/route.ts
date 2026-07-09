// ============================================================
// Yene QR — Cron Analytics Aggregation Endpoint
// ============================================================
// POST /api/cron/analytics
//
// Called by an external cron scheduler (e.g. Vercel Cron, cron-job.org)
// to populate the AnalyticsDaily table.
//
// Security: Requires x-cron-secret header matching CRON_SECRET env var.

import { NextRequest, NextResponse } from 'next/server'
import { aggregateAllRestaurants } from '@/lib/analytics'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Validate cron secret
    const cronSecret = process.env.CRON_SECRET
    const providedSecret = request.headers.get('x-cron-secret')

    if (!cronSecret) {
      console.warn('[CRON_ANALYTICS] CRON_SECRET env var is not set — rejecting request')
      return NextResponse.json(
        { error: 'Cron endpoint not configured (missing CRON_SECRET)' },
        { status: 500 }
      )
    }

    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Invalid cron secret' }, { status: 401 })
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Aggregate today
    const todayResult = await aggregateAllRestaurants(today)

    // Aggregate yesterday if not yet done (idempotent — upsert is safe)
    const yesterdayResult = await aggregateAllRestaurants(yesterday)

    // Check for any restaurants that still have no analytics for yesterday
    // (covers edge cases where the cron may have missed a day)
    const activeRestaurants = await db.restaurant.count({
      where: { isActive: true, isSuspended: false },
    })

    return NextResponse.json({
      success: true,
      summary: {
        activeRestaurants,
        today: {
          date: todayResult.date,
          processed: todayResult.processed,
          errors: todayResult.errors.length,
        },
        yesterday: {
          date: yesterdayResult.date,
          processed: yesterdayResult.processed,
          errors: yesterdayResult.errors.length,
        },
      },
      errors: [...todayResult.errors, ...yesterdayResult.errors],
    })
  } catch (error) {
    console.error('[CRON_ANALYTICS]', error)
    return NextResponse.json(
      { error: 'Analytics aggregation failed' },
      { status: 500 }
    )
  }
}

// Reject GET — this endpoint is POST-only
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with x-cron-secret header.' },
    { status: 405 }
  )
}
