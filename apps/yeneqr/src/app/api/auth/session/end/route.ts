// ============================================================
// Yene QR — Customer Session End API Route
// POST /api/auth/session/end
// Marks the current customer session as inactive
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, type CustomerTokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Extract Bearer token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (!payload || payload.type !== 'customer') {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 })
    }

    const customerPayload = payload as CustomerTokenPayload
    if (!customerPayload.sessionId) {
      return NextResponse.json({ error: 'No active session' }, { status: 400 })
    }

    // Mark the session as inactive
    await db.customerSession.update({
      where: { id: customerPayload.sessionId },
      data: {
        isActive: false,
        lastActivityAt: new Date(),
      },
    })

    return NextResponse.json({ message: 'Session ended successfully' })
  } catch (error) {
    console.error('[SESSION_END_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    )
  }
}
