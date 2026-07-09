// Phase 4.3 — CRM Dashboard
// GET /api/restaurants/[id]/crm — customer profiles, segmentation, LTV
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const segment = searchParams.get('segment') // new, regular, vip, at_risk
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = { restaurantId }

    // Get customers with order stats
    const customers = await db.customer.findMany({
      where,
      orderBy: { totalSpentCents: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        loyaltyPoints: true,
        totalSpentCents: true,
        visitCount: true,
        lastVisitAt: true,
        createdAt: true,
      },
    })

    // Segmentation logic
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const segmentedCustomers = customers.map(c => {
      let seg = 'new'
      if (c.visitCount >= 10 && c.totalSpentCents >= 50000) seg = 'vip'
      else if (c.visitCount >= 3) seg = 'regular'
      else if (c.lastVisitAt && c.lastVisitAt < thirtyDaysAgo) seg = 'at_risk'
      return { ...c, segment: seg }
    })

    const filtered = segment ? segmentedCustomers.filter(c => c.segment === segment) : segmentedCustomers

    // Summary stats
    const totalCustomers = await db.customer.count({ where })
    const totalRevenue = await db.customer.aggregate({ where, _sum: { totalSpentCents: true } })
    const avgLTV = totalCustomers > 0 ? Math.round((totalRevenue._sum.totalSpentCents || 0) / totalCustomers) : 0

    const segmentCounts = {
      new: segmentedCustomers.filter(c => c.segment === 'new').length,
      regular: segmentedCustomers.filter(c => c.segment === 'regular').length,
      vip: segmentedCustomers.filter(c => c.segment === 'vip').length,
      at_risk: segmentedCustomers.filter(c => c.segment === 'at_risk').length,
    }

    return NextResponse.json({
      data: filtered,
      pagination: { page, limit, total: totalCustomers, totalPages: Math.ceil(totalCustomers / limit) },
      summary: {
        totalCustomers,
        avgLTVCents: avgLTV,
        totalRevenueCents: totalRevenue._sum.totalSpentCents || 0,
        segments: segmentCounts,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[CRM]', error)
    return NextResponse.json({ error: 'Failed to fetch CRM data' }, { status: 500 })
  }
}
