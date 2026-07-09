// ============================================================
// Yene QR — Audit Logs API (List)
// ============================================================
// Provides a paginated, filterable endpoint for viewing
// audit log entries in the admin dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'

/**
 * GET /api/restaurants/[id]/audit-logs
 * List audit log entries for a restaurant.
 *
 * Query params:
 *   entityType — filter by entity type (menuItem, order, promotion, user, etc.)
 *   entityId — filter by specific entity ID
 *   action — filter by action type (create, update, delete, etc.)
 *   userId — filter by user who performed the action
 *   dateFrom — ISO date string, inclusive
 *   dateTo — ISO date string, inclusive
 *   page — page number (default: 1)
 *   limit — items per page (default: 50, max: 200)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Only owners and managers can view audit logs
    const permErr = requirePerm(auth, 'settings:manage', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = { restaurantId }

    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (action) where.action = action
    if (userId) where.userId = userId
    if (branchId) where.branchId = branchId

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo)
      where.createdAt = createdAt
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          restaurant: {
            select: { name: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ])

    // Get unique entity types and actions for filter dropdowns
    const [entityTypes, actions] = await Promise.all([
      db.auditLog.findMany({
        where: { restaurantId },
        select: { entityType: true },
        distinct: ['entityType'],
        orderBy: { entityType: 'asc' },
      }),
      db.auditLog.findMany({
        where: { restaurantId },
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      }),
    ])

    return NextResponse.json({
      data: logs,
      filters: {
        entityTypes: entityTypes.map((e) => e.entityType).filter(Boolean),
        actions: actions.map((a) => a.action).filter(Boolean),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[AUDIT_LOGS_LIST]', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
