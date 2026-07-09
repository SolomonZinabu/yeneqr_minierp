// ============================================================
// Yene QR — Staff API (List, Create)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm, resolveBranchScope } from '@/lib/api-auth'
import { hashPassword } from '@/lib/auth'
import { checkLimit, limitCheckErrorResponse } from '@/lib/subscription-limits'

/**
 * GET /api/restaurants/[id]/staff
 * List staff members for a restaurant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    const permErr = requirePerm(auth, 'staff:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive')
    const branchId = resolveBranchScope(auth, searchParams.get('branchId'))
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { restaurantId }

    if (role) where.role = role
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'
    if (branchId) where.branchId = branchId

    const [staff, total] = await Promise.all([
      db.restaurantUser.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          role: true,
          permissions: true,
          additionalPermissions: true,
          revokedPermissions: true,
          isActive: true,
          branchId: true,
          lastLogin: true,
          createdAt: true,
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      db.restaurantUser.count({ where }),
    ])

    return NextResponse.json({
      data: staff,
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
    console.error('[STAFF_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/restaurants/[id]/staff
 * Create a staff member.
 * Body: { email, name, password, phone?, role, branchId? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Must have staff:manage permission for this restaurant
    const permErr = requirePerm(auth, 'staff:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { email, name, password, phone, role = 'waiter', branchId, avatar, permissions, additionalPermissions, revokedPermissions } = body as {
      email: string
      name: string
      password: string
      phone?: string
      role?: string
      branchId?: string
      avatar?: string
      permissions?: string[]
      additionalPermissions?: string[]
      revokedPermissions?: string[]
    }

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'email, name, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const validRoles = ['owner', 'manager', 'cashier', 'waiter', 'kitchen_staff']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Non-super_admin cannot create owner accounts
    if (role === 'owner' && auth.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can create owner accounts' },
        { status: 403 }
      )
    }

    // ── Subscription Limit Check ──────────────────────
    const limitCheck = await checkLimit(restaurantId, 'staff')
    if (!limitCheck.allowed) {
      return NextResponse.json(limitCheckErrorResponse(limitCheck), { status: 403 })
    }

    // Check for duplicate email within this restaurant
    const existing = await db.restaurantUser.findUnique({
      where: {
        restaurantId_email: {
          restaurantId,
          email,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A staff member with this email already exists for this restaurant' },
        { status: 409 }
      )
    }

    // Validate branchId if provided
    if (branchId) {
      const branch = await db.branch.findFirst({
        where: { id: branchId, restaurantId },
      })
      if (!branch) {
        return NextResponse.json(
          { error: 'Branch not found' },
          { status: 400 }
        )
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    const staff = await db.restaurantUser.create({
      data: {
        restaurantId,
        branchId: branchId || null,
        email,
        name,
        password: hashedPassword,
        phone: phone || null,
        role,
        avatar: avatar || null,
        permissions: permissions ? JSON.stringify(permissions) : null,
        additionalPermissions: additionalPermissions ? JSON.stringify(additionalPermissions) : null,
        revokedPermissions: revokedPermissions ? JSON.stringify(revokedPermissions) : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        permissions: true,
        additionalPermissions: true,
        revokedPermissions: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ data: staff }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STAFF_CREATE]', error)
    return NextResponse.json(
      { error: 'Failed to create staff member' },
      { status: 500 }
    )
  }
}
