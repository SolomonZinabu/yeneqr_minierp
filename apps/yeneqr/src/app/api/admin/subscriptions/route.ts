// ============================================================
// Yene QR — Admin Subscriptions API
// CRUD operations for subscription plans.
// GET:    List plans with restaurant counts and revenue.
// POST:   Create a new subscription plan.
// PUT:    Update a subscription plan (price, features, limits).
// DELETE: Delete (deactivate) a subscription plan.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { toCents } from '@/lib/money'

/**
 * Helper to parse and format a plan for API responses.
 */
function formatPlanResponse(plan: {
  id: string; slug: string; name: string; description: string | null;
  priceCents: number; yearlyPriceCents: number | null; feeRatePercent: number; features: string; limits: string;
  isActive: boolean; sortOrder: number; createdAt: Date; updatedAt: Date;
  _count?: { subscriptions: number };
  subscriptions?: { id: string }[];
}) {
  const features = (() => {
    if (!plan.features) return []
    try {
      const parsed = JSON.parse(plan.features)
      if (Array.isArray(parsed)) return parsed
      if (typeof parsed === 'object' && parsed !== null) {
        // Handle object-with-boolean-keys format: { qr_codes: true, ... }
        return Object.keys(parsed).filter(k => parsed[k] === true).map(k => {
          return k.split('_').map(word => {
            if (['qr', 'api', 'kds', 'sdk'].includes(word.toLowerCase())) return word.toUpperCase()
            return word.charAt(0).toUpperCase() + word.slice(1)
          }).join(' ')
        })
      }
      return []
    } catch { return [] }
  })()
  const limits = (() => {
    if (!plan.limits) return {}
    try { return JSON.parse(plan.limits); } catch { return {}; }
  })()

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    yearlyPriceCents: plan.yearlyPriceCents,
    feeRatePercent: plan.feeRatePercent ?? 3.0,
    features,
    limits,
    maxTables: limits.maxTables || limits.maxQRCodes || 20,
    maxBranches: limits.maxBranches || 1,
    maxStaff: limits.maxStaff || 5,
    maxMenuItems: limits.maxMenuItems || 50,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    totalSubscriptions: plan._count?.subscriptions ?? 0,
    activeSubscriptions: plan.subscriptions?.length ?? 0,
    revenueCents: plan.priceCents * (plan.subscriptions?.length ?? 0),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

/**
 * GET /api/admin/subscriptions
 * List ALL subscription plans (including inactive) with restaurant counts and revenue.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    // Admin can see ALL plans, including inactive ones
    const plans = await db.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
        subscriptions: {
          where: { status: 'active' },
          select: { id: true },
        },
      },
    })

    const planData = plans.map(formatPlanResponse)

    // Calculate total MRR
    const totalMRRCents = planData.reduce((sum, p) => sum + p.revenueCents, 0)

    return NextResponse.json({
      data: planData,
      meta: {
        totalMRRCents,
        totalPlans: planData.length,
        totalActiveSubscriptions: planData.reduce((sum, p) => sum + p.activeSubscriptions, 0),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTIONS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription plans' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/subscriptions
 * Create a new subscription plan.
 * Body: { name, slug, description?, price, yearlyPrice?, features, limits, sortOrder? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const body = await request.json()
    const { name, slug, description, price, yearlyPrice, feeRatePercent, features, limits, sortOrder } = body

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      )
    }

    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        { error: 'price must be a non-negative number' },
        { status: 400 }
      )
    }

    // Validate feeRatePercent if provided (0-100, default 3.0)
    const feeRate = typeof feeRatePercent === 'number' && feeRatePercent >= 0 && feeRatePercent <= 100
      ? feeRatePercent
      : 3.0

    // Validate slug format
    const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens (no leading/trailing hyphens)' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existing = await db.subscriptionPlan.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json(
        { error: 'A plan with this slug already exists' },
        { status: 409 }
      )
    }

    // Default limits if not provided (decorative — gating is disabled)
    const planLimits = limits || { maxBranches: 1, maxTables: 20, maxStaff: 5, maxMenuItems: 50 }
    const planFeatures = features || []

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        slug,
        description: description || null,
        priceCents: toCents(price),
        yearlyPriceCents: yearlyPrice ? toCents(yearlyPrice) : null,
        feeRatePercent: feeRate,
        features: JSON.stringify(planFeatures),
        limits: JSON.stringify(planLimits),
        isActive: true,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json({
      data: formatPlanResponse({ ...plan, _count: { subscriptions: 0 }, subscriptions: [] }),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTIONS_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create subscription plan' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/subscriptions
 * Update a subscription plan (price, features, limits, etc.).
 * Body: { planId, name?, description?, price?, yearlyPrice?, features?, limits?, isActive?, sortOrder? }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const body = await request.json()
    const { planId, price, yearlyPrice, feeRatePercent, features, limits, name, description, isActive, sortOrder } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    const existing = await db.subscriptionPlan.findUnique({
      where: { id: planId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscription plan not found' },
        { status: 404 }
      )
    }

    // Build update data — only include fields that are provided
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.priceCents = toCents(price)
    if (yearlyPrice !== undefined) updateData.yearlyPriceCents = yearlyPrice ? toCents(yearlyPrice) : null
    if (feeRatePercent !== undefined && typeof feeRatePercent === 'number' && feeRatePercent >= 0 && feeRatePercent <= 100) {
      updateData.feeRatePercent = feeRatePercent
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (features !== undefined) updateData.features = JSON.stringify(features)
    if (limits !== undefined) updateData.limits = JSON.stringify(limits)

    const updated = await db.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
    })

    // Fetch fresh data with counts for the response
    const refreshed = await db.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        _count: { select: { subscriptions: true } },
        subscriptions: { where: { status: 'active' }, select: { id: true } },
      },
    })

    return NextResponse.json({
      data: formatPlanResponse(refreshed!),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTIONS_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update subscription plan' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/subscriptions
 * Deactivate (soft-delete) a subscription plan.
 * Body: { planId }
 * Plans with active subscriptions cannot be deleted — they are deactivated instead.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json(
        { error: 'planId query parameter is required' },
        { status: 400 }
      )
    }

    const existing = await db.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        _count: { select: { subscriptions: true } },
        subscriptions: { where: { status: 'active' }, select: { id: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscription plan not found' },
        { status: 404 }
      )
    }

    // Check if plan has active subscriptions
    const activeCount = existing.subscriptions.length
    if (activeCount > 0) {
      // Soft delete — just deactivate
      const deactivated = await db.subscriptionPlan.update({
        where: { id: planId },
        data: { isActive: false },
      })
      return NextResponse.json({
        data: formatPlanResponse({ ...deactivated, _count: existing._count, subscriptions: existing.subscriptions }),
        message: `Plan deactivated (has ${activeCount} active subscriptions). It will no longer be available for new sign-ups.`,
      })
    }

    // No active subscriptions — can fully remove, but we still soft-delete for data integrity
    const deactivated = await db.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive: false },
    })

    return NextResponse.json({
      data: formatPlanResponse({ ...deactivated, _count: existing._count, subscriptions: [] }),
      message: 'Plan deactivated successfully.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_SUBSCRIPTIONS_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete subscription plan' },
      { status: 500 }
    )
  }
}
