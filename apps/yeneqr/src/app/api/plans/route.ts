// ============================================================
// Yene QR — Public Subscription Plans API
// Returns active plans for the landing page pricing section.
// No authentication required.
// ============================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/plans
 * Public endpoint — returns active subscription plans for the landing page.
 * Only returns plans that are active, ordered by sortOrder.
 */
export async function GET() {
  try {
    const plans = await db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        priceCents: true,
        yearlyPriceCents: true,
        feeRatePercent: true,
        features: true,
        limits: true,
        sortOrder: true,
      },
    })

    const planData = plans.map(plan => {
      // Parse features — handle both array and object-with-boolean-keys formats
      const features = (() => {
        if (!plan.features) return []
        try {
          const parsed = JSON.parse(plan.features)
          if (Array.isArray(parsed)) return parsed
          if (typeof parsed === 'object' && parsed !== null) {
            return Object.keys(parsed).filter(k => parsed[k] === true).map(k => {
              // Convert snake_case to Title Case: qr_codes → QR Codes, all_payments → All Payments
              return k.split('_').map(word => {
                // Common abbreviations to uppercase fully
                if (['qr', 'api', 'kds', 'sdk'].includes(word.toLowerCase())) return word.toUpperCase()
                return word.charAt(0).toUpperCase() + word.slice(1)
              }).join(' ')
            })
          }
          return []
        } catch { return [] }
      })()

      // Parse limits
      const limits = (() => {
        if (!plan.limits) return {}
        try { return JSON.parse(plan.limits); } catch { return {}; }
      })()

      return {
        id: plan.slug, // Use slug as the public-facing ID
        name: plan.name,
        description: plan.description,
        price: plan.priceCents / 100,
        priceCents: plan.priceCents,
        yearlyPrice: plan.yearlyPriceCents ? plan.yearlyPriceCents / 100 : null,
        yearlyPriceCents: plan.yearlyPriceCents,
        feeRatePercent: plan.feeRatePercent ?? 3.0,
        features,
        limits: {
          maxBranches: limits.maxBranches ?? 1,
          maxTables: limits.maxTables ?? limits.maxQRCodes ?? 20,
          maxStaff: limits.maxStaff ?? 5,
          maxMenuItems: limits.maxMenuItems ?? 50,
        },
        isFree: plan.priceCents === 0,
        isPopular: plan.slug === 'pro', // Pro is the default popular plan
        sortOrder: plan.sortOrder,
      }
    })

    return NextResponse.json({ data: planData })
  } catch (error) {
    console.error('[PUBLIC_PLANS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription plans' },
      { status: 500 }
    )
  }
}
