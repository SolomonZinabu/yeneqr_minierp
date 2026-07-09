// ============================================================
// Yene QR — POS Integration Detail API (PATCH, DELETE)
// ============================================================
// PATCH  /api/restaurants/[id]/integrations/[integrationId]
//   Update sync settings (isActive, syncOrders, syncPayments, syncMenu)
//   Body: { isActive?, syncOrders?, syncPayments?, syncMenu?, webhookUrl?, apiKey? }
//
// DELETE /api/restaurants/[id]/integrations/[integrationId]
//   Hard-delete an integration (removes the webhook config entirely)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> }
) {
  try {
    const { id: restaurantId, integrationId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const existing = await db.pOSIntegration.findFirst({
      where: { id: integrationId, restaurantId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const body = await request.json()
    const { isActive, syncOrders, syncPayments, syncMenu, webhookUrl, apiKey } = body as {
      isActive?: boolean
      syncOrders?: boolean
      syncPayments?: boolean
      syncMenu?: boolean
      webhookUrl?: string
      apiKey?: string
    }

    // Build update data — only update fields that are provided
    const updateData: Record<string, unknown> = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (syncOrders !== undefined) updateData.syncOrders = syncOrders
    if (syncPayments !== undefined) updateData.syncPayments = syncPayments
    if (syncMenu !== undefined) updateData.syncMenu = syncMenu
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl || null
    if (apiKey !== undefined) updateData.apiKey = apiKey || null

    // SSRF protection on webhook URL if updating
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

    const updated = await db.pOSIntegration.update({
      where: { id: integrationId },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INTEGRATION_UPDATE]', error)
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> }
) {
  try {
    const { id: restaurantId, integrationId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const existing = await db.pOSIntegration.findFirst({
      where: { id: integrationId, restaurantId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    await db.pOSIntegration.delete({
      where: { id: integrationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[INTEGRATION_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 })
  }
}
