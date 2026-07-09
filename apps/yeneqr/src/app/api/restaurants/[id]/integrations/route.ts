// ============================================================
// Yene QR — POS Integration API (Phase 3.4)
// ============================================================
// GET  /api/restaurants/[id]/integrations — list integrations
// POST /api/restaurants/[id]/integrations — create integration
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const integrations = await db.pOSIntegration.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: integrations })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INTEGRATIONS_LIST]', error)
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const { name, type, webhookUrl, apiKey, isActive = true, syncOrders = true, syncPayments = true, syncMenu = false } = body

    // SSRF protection: validate webhook URL is public HTTPS
    if (webhookUrl) {
      try {
        const parsedUrl = new URL(webhookUrl)
        if (parsedUrl.protocol !== 'https:') {
          return NextResponse.json({ error: 'Webhook URL must use HTTPS' }, { status: 400 })
        }
        const host = parsedUrl.hostname.toLowerCase()
        if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('10.') ||
            host.startsWith('192.168.') || host.startsWith('169.254.') ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '0.0.0.0') {
          return NextResponse.json({ error: 'Webhook URL must be a public address' }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 })
      }
    }

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }

    const integration = await db.pOSIntegration.create({
      data: {
        restaurantId,
        name,
        type,
        webhookUrl: webhookUrl || null,
        apiKey: apiKey || null,
        isActive,
        syncOrders,
        syncPayments,
        syncMenu,
      },
    })

    return NextResponse.json({ data: integration }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INTEGRATION_CREATE]', error)
    return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 })
  }
}
