// ============================================================
// Yene QR — Admin Support Tickets API
// List, create, and update support tickets with filters.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/admin/tickets
 * List support tickets with filters (status, priority, category).
 * Query params: page, limit, status, priority, category, search
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const statusFilter = searchParams.get('status') || ''
    const priorityFilter = searchParams.get('priority') || ''
    const categoryFilter = searchParams.get('category') || ''
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (statusFilter) {
      where.status = statusFilter
    }

    if (priorityFilter) {
      where.priority = priorityFilter
    }

    if (categoryFilter) {
      where.category = categoryFilter
    }

    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          // Resolve restaurant name for display
        },
      }),
      db.supportTicket.count({ where }),
    ])

    // Get restaurant names for tickets that have a restaurantId
    const restaurantIds = tickets
      .map(t => t.restaurantId)
      .filter((id): id is string => id !== null)

    const restaurants = await db.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, name: true },
    })

    const restaurantMap = new Map(restaurants.map(r => [r.id, r.name]))

    // Get assigned admin names
    const assignedToIds = tickets
      .map(t => t.assignedTo)
      .filter((id): id is string => id !== null)

    let assignedAdmins: any[] = []
    if (assignedToIds.length > 0) {
      const [superAdmins, supportAdmins] = await Promise.all([
        db.superAdmin.findMany({
          where: { id: { in: assignedToIds } },
          select: { id: true, name: true },
        }),
        db.supportAdmin.findMany({
          where: { id: { in: assignedToIds } },
          select: { id: true, name: true },
        }),
      ])
      assignedAdmins = [...superAdmins, ...supportAdmins]
    }

    const adminMap = new Map(assignedAdmins.map(a => [a.id, a.name]))

    const data = tickets.map(t => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      restaurantId: t.restaurantId || null,
      restaurantName: t.restaurantId ? restaurantMap.get(t.restaurantId) || 'Unknown' : null,
      status: t.status,
      priority: t.priority,
      category: t.category || 'General',
      assignedTo: t.assignedTo ? adminMap.get(t.assignedTo) || null : null,
      assignedToId: t.assignedTo || null,
      resolution: t.resolution || null,
      createdById: t.createdBy,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))

    // Get available categories for filter dropdown
    const categories = await db.supportTicket.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    })

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        categories: categories.map(c => c.category).filter(Boolean),
        statuses: ['open', 'in_progress', 'resolved', 'closed'],
        priorities: ['low', 'medium', 'high', 'critical'],
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_TICKETS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/tickets
 * Create a new support ticket.
 * Body: { subject, description, restaurantId?, priority?, category?, assignedTo? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const body = await request.json()
    const { subject, description, restaurantId, priority, category, assignedTo } = body

    if (!subject || !description) {
      return NextResponse.json(
        { error: 'Subject and description are required' },
        { status: 400 }
      )
    }

    // Validate restaurant exists if provided
    if (restaurantId) {
      const restaurant = await db.restaurant.findUnique({
        where: { id: restaurantId },
      })
      if (!restaurant) {
        return NextResponse.json(
          { error: 'Restaurant not found' },
          { status: 404 }
        )
      }
    }

    const ticket = await db.supportTicket.create({
      data: {
        subject,
        description,
        restaurantId: restaurantId || null,
        priority: priority || 'medium',
        category: category || null,
        assignedTo: assignedTo || null,
        createdBy: auth.userId,
        status: 'open',
      },
    })

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_TICKETS_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create support ticket' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/tickets
 * Update a support ticket (assign, change status, add resolution).
 * Body: { ticketId, status?, priority?, assignedTo?, resolution?, category? }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const body = await request.json()
    const { ticketId, status, priority, assignedTo, resolution, category } = body

    if (!ticketId) {
      return NextResponse.json(
        { error: 'ticketId is required' },
        { status: 400 }
      )
    }

    const existing = await db.supportTicket.findUnique({
      where: { id: ticketId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Support ticket not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}

    if (status !== undefined) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = status

      // Auto-assign to current admin when moving to in_progress
      if (status === 'in_progress' && !existing.assignedTo) {
        updateData.assignedTo = auth.userId
      }
    }

    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'critical']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.priority = priority
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo
    }

    if (resolution !== undefined) {
      updateData.resolution = resolution
      // Auto-close if resolution is provided
      if (resolution && existing.status !== 'closed') {
        updateData.status = 'resolved'
      }
    }

    if (category !== undefined) {
      updateData.category = category
    }

    const updated = await db.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_TICKETS_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update support ticket' },
      { status: 500 }
    )
  }
}
