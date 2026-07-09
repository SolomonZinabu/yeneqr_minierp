// ============================================================
// Yene QR — Token Verification API Route
// POST /api/auth/verify
// Verifies a token is still valid and returns the payload
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, type TokenPayload, type CustomerTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const decoded = verifyToken(token)

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // For customer tokens, also verify the session is still active in DB
    if (decoded.type === 'customer') {
      const customerPayload = decoded as CustomerTokenPayload

      const session = await db.customerSession.findUnique({
        where: { id: customerPayload.sessionId },
        select: {
          id: true,
          isActive: true,
          expiresAt: true,
        },
      })

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 401 }
        )
      }

      if (!session.isActive) {
        return NextResponse.json(
          { error: 'Session has been deactivated' },
          { status: 401 }
        )
      }

      if (new Date() > session.expiresAt) {
        // Auto-deactivate expired session
        await db.customerSession.update({
          where: { id: session.id },
          data: { isActive: false },
        })
        return NextResponse.json(
          { error: 'Session has expired' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        valid: true,
        type: 'customer',
        payload: {
          sessionId: customerPayload.sessionId,
          restaurantId: customerPayload.restaurantId,
          branchId: customerPayload.branchId,
          tableId: customerPayload.tableId,
          customerId: customerPayload.customerId,
          language: customerPayload.language,
          type: customerPayload.type,
        },
      })
    }

    // For staff/admin tokens, verify the user still exists and is active
    const staffPayload = decoded as TokenPayload

    if (staffPayload.role === 'super_admin') {
      const superAdmin = await db.superAdmin.findUnique({
        where: { id: staffPayload.userId },
        select: { id: true, isActive: true },
      })

      if (!superAdmin || !superAdmin.isActive) {
        return NextResponse.json(
          { error: 'Account deactivated or not found' },
          { status: 401 }
        )
      }
    } else if (staffPayload.role === 'support_admin') {
      const supportAdmin = await db.supportAdmin.findUnique({
        where: { id: staffPayload.userId },
        select: { id: true, isActive: true },
      })

      if (!supportAdmin || !supportAdmin.isActive) {
        return NextResponse.json(
          { error: 'Account deactivated or not found' },
          { status: 401 }
        )
      }
    } else {
      // Restaurant staff
      const restaurantUser = await db.restaurantUser.findUnique({
        where: { id: staffPayload.userId },
        select: { id: true, isActive: true, restaurant: { select: { isActive: true, isSuspended: true } } },
      })

      if (!restaurantUser || !restaurantUser.isActive) {
        return NextResponse.json(
          { error: 'Account deactivated or not found' },
          { status: 401 }
        )
      }

      if (!restaurantUser.restaurant.isActive || restaurantUser.restaurant.isSuspended) {
        return NextResponse.json(
          { error: 'Restaurant account is inactive or suspended' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({
      valid: true,
      type: staffPayload.type,
      payload: {
        userId: staffPayload.userId,
        email: staffPayload.email,
        role: staffPayload.role,
        restaurantId: staffPayload.restaurantId,
        branchId: staffPayload.branchId,
        type: staffPayload.type,
      },
    })
  } catch (error) {
    console.error('[AUTH_VERIFY_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred during token verification.' },
      { status: 500 }
    )
  }
}
