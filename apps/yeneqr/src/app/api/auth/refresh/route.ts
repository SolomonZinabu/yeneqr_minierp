// ============================================================
// Yene QR — Token Refresh API Route
// POST /api/auth/refresh
// Issues a new JWT token for an active session before the current
// token expires. Prevents session interruption.
//
// Handles both customer and staff tokens:
//   - Customer: checks CustomerSession in DB, extends expiry, issues new token
//   - Staff: decodes the expired token (within 30-min grace), re-issues
//     with the same payload + fresh 24h expiry
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, generateCustomerToken, generateStaffToken, resolveUserPermissions, type CustomerTokenPayload, type TokenPayload } from '@/lib/auth'
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

    // Try normal verification first (token still valid)
    let decoded: CustomerTokenPayload | TokenPayload | null = null
    try {
      decoded = verifyToken(token) as CustomerTokenPayload | TokenPayload | null
    } catch {
      // Token is expired — decode it without verification to get the payload
    }

    // ── If token is still valid, just issue a new one with extended expiry ──
    if (decoded) {
      if (decoded.type === 'customer') {
        // Customer token still valid — re-issue with fresh 4h expiry
        const cp = decoded as CustomerTokenPayload
        const newToken = generateCustomerToken(cp)
        return NextResponse.json({
          token: newToken,
          message: 'Token refreshed successfully',
        })
      } else {
        // Staff token still valid — re-issue with fresh 24h expiry
        // Strip the exp/iat fields from the decoded payload before re-signing
        // (jwt.sign adds its own exp when expiresIn is set)
        const sp = decoded as TokenPayload
        const { exp, iat, ...cleanPayload } = sp as any
        const newToken = generateStaffToken(cleanPayload)
        return NextResponse.json({
          token: newToken,
          message: 'Token refreshed successfully',
        })
      }
    }

    // ── Token is expired — manually decode the JWT payload ──
    let payload: any
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return NextResponse.json({ error: 'Invalid token format' }, { status: 401 })
      }
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      payload = JSON.parse(decodeURIComponent(escape(atob(base64))))
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if token expired more than 30 minutes ago (grace period)
    if (payload.exp && Date.now() / 1000 - payload.exp > 30 * 60) {
      return NextResponse.json(
        { error: 'Token expired too long ago. Please log in again.' },
        { status: 401 }
      )
    }

    // ── Handle customer token refresh ──
    if (payload.type === 'customer') {
      if (!payload.sessionId) {
        return NextResponse.json({ error: 'Invalid customer token' }, { status: 401 })
      }

      const session = await db.customerSession.findUnique({
        where: { id: payload.sessionId },
        select: { id: true, isActive: true, expiresAt: true, language: true, customerId: true, restaurantId: true, branchId: true, tableId: true },
      })

      if (!session || !session.isActive) {
        return NextResponse.json({ error: 'Session not found or inactive' }, { status: 401 })
      }

      if (new Date() > session.expiresAt) {
        await db.customerSession.update({ where: { id: session.id }, data: { isActive: false } })
        return NextResponse.json({ error: 'Session has expired. Please re-scan the QR code.' }, { status: 401 })
      }

      const newExpiresAt = new Date()
      newExpiresAt.setHours(newExpiresAt.getHours() + 4)
      await db.customerSession.update({ where: { id: session.id }, data: { lastActivityAt: new Date(), expiresAt: newExpiresAt } })

      const newToken = generateCustomerToken({
        sessionId: session.id,
        restaurantId: session.restaurantId,
        branchId: session.branchId,
        tableId: session.tableId,
        language: session.language || payload.language || 'en',
        type: 'customer',
        customerId: session.customerId || payload.customerId,
      })

      return NextResponse.json({ token: newToken, expiresAt: newExpiresAt.toISOString(), message: 'Token refreshed successfully' })
    }

    // ── Handle staff token refresh ──
    if (payload.type === 'staff' || payload.type === 'admin') {
      // Re-issue the staff token with the same payload + fresh 24h expiry
      // Strip exp/iat — jwt.sign will add new ones
      const { exp, iat, ...cleanPayload } = payload
      const newToken = generateStaffToken(cleanPayload)

      return NextResponse.json({ token: newToken, message: 'Token refreshed successfully' })
    }

    return NextResponse.json({ error: 'Unknown token type' }, { status: 400 })
  } catch (error) {
    console.error('[AUTH_REFRESH_ERROR]', error)
    return NextResponse.json({ error: 'An unexpected error occurred during token refresh.' }, { status: 500 })
  }
}
