// ============================================================
// Yene QR — StarPay Settings API (Admin)
// Configure StarPay credentials per restaurant
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { createStarPayClient, STARPAY_SANDBOX_URL } from '@/lib/starpay'

/**
 * GET /api/restaurants/[id]/settings/starpay
 * Get StarPay configuration for a restaurant (masks sensitive fields).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'settings:manage', restaurantId)
    if (permErr) return permErr

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        starPayEnabled: true,
        starPayApiUrl: true,
        starPayApiSecret: true,
        starPayMerchantId: true,
        starPayWebhookSecret: true,
        // Fee rate is now on the restaurant itself (decoupled from subscription)
        feeRate: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Mask sensitive fields for display
    return NextResponse.json({
      data: {
        enabled: restaurant.starPayEnabled,
        apiUrl: restaurant.starPayApiUrl || STARPAY_SANDBOX_URL,
        apiSecret: restaurant.starPayApiSecret
          ? `${restaurant.starPayApiSecret.substring(0, 4)}${'*'.repeat(12)}`
          : null,
        merchantId: restaurant.starPayMerchantId,
        webhookSecret: restaurant.starPayWebhookSecret
          ? `${restaurant.starPayWebhookSecret.substring(0, 4)}${'*'.repeat(12)}`
          : null,
        // Fee rate (decoupled from subscription — set per-restaurant by admin)
        feeRatePercent: (restaurant.feeRate ?? 0.03) * 100,
        hasCredentials: !!(restaurant.starPayApiSecret && restaurant.starPayMerchantId),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STARPAY_SETTINGS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch StarPay settings' }, { status: 500 })
  }
}

/**
 * PUT /api/restaurants/[id]/settings/starpay
 * Update StarPay configuration for a restaurant.
 *
 * Body: {
 *   enabled: boolean,
 *   apiUrl?: string,
 *   apiSecret?: string,  // Only send if changing — null = keep existing
 *   merchantId?: string,
 *   webhookSecret?: string, // Only send if changing — null = keep existing
 *   testConnection?: boolean // If true, tests the connection before saving
 * }
 *
 * NOTE: The platform fee rate is no longer set here — it comes from the
 * restaurant's subscription plan (feeRatePercent). To change the fee rate,
 * change the subscription plan via /api/restaurants/[id]/subscription.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'settings:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const {
      enabled,
      apiUrl,
      apiSecret,
      merchantId,
      webhookSecret,
      testConnection,
    } = body as {
      enabled?: boolean
      apiUrl?: string
      apiSecret?: string | null
      merchantId?: string
      webhookSecret?: string | null
      testConnection?: boolean
    }

    // If enabling, validate that credentials are provided
    if (enabled) {
      const existing = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          starPayApiSecret: true,
          starPayMerchantId: true,
        },
      })

      const finalSecret = apiSecret === null ? undefined : (apiSecret || existing?.starPayApiSecret)
      const finalMerchantId = merchantId || existing?.starPayMerchantId

      if (!finalSecret || !finalMerchantId) {
        return NextResponse.json(
          { error: 'API Secret and Merchant ID are required to enable StarPay' },
          { status: 400 }
        )
      }

      // Test connection if requested
      if (testConnection) {
        try {
          const client = createStarPayClient({
            apiUrl: apiUrl || STARPAY_SANDBOX_URL,
            apiSecret: finalSecret,
            merchantId: finalMerchantId,
            webhookSecret: webhookSecret || '',
          })
          const testResult = await client.testConnection()
          if (!testResult.connected) {
            return NextResponse.json(
              { error: `Connection test failed: ${testResult.error || 'Could not connect to StarPay API'}` },
              { status: 400 }
            )
          }
        } catch (testError) {
          return NextResponse.json(
            { error: `Connection test failed: ${testError instanceof Error ? testError.message : 'Unknown error'}` },
            { status: 400 }
          )
        }
      }
    }

    // Build update data — only update fields that are explicitly provided
    const updateData: Record<string, unknown> = {}
    if (enabled !== undefined) updateData.starPayEnabled = enabled
    if (apiUrl !== undefined) updateData.starPayApiUrl = apiUrl
    if (apiSecret) updateData.starPayApiSecret = apiSecret  // Only update if new value provided
    if (merchantId !== undefined) updateData.starPayMerchantId = merchantId
    if (webhookSecret) updateData.starPayWebhookSecret = webhookSecret  // Only update if new value provided

    await db.restaurant.update({
      where: { id: restaurantId },
      data: updateData,
    })

    console.info('[STARPAY_SETTINGS_UPDATED]', {
      restaurantId,
      updatedFields: Object.keys(updateData),
    })

    return NextResponse.json({
      data: { success: true, message: 'StarPay settings updated' },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[STARPAY_SETTINGS_PUT]', error)
    return NextResponse.json({ error: 'Failed to update StarPay settings' }, { status: 500 })
  }
}
