// ============================================================
// Yene QR — POS Webhook Dispatcher (Phase 3.4)
// ============================================================
// Sends order/payment events to external POS systems via webhook.
// Called after order creation, payment received, and order status changes.
// ============================================================

import { db } from '@/lib/db'

interface WebhookPayload {
  event: string  // order.created, payment.received, order.status_changed
  restaurantId: string
  data: Record<string, unknown>
  timestamp: string
}

/**
 * Dispatch a webhook event to all active POS integrations for a restaurant.
 * Fire-and-forget — errors are logged but don't break the primary operation.
 */
export async function dispatchPOSWebhook(
  restaurantId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const integrations = await db.pOSIntegration.findMany({
      where: {
        restaurantId,
        isActive: true,
        webhookUrl: { not: null },
      },
    })

    if (integrations.length === 0) return

    const payload: WebhookPayload = {
      event,
      restaurantId,
      data,
      timestamp: new Date().toISOString(),
    }

    // Send to each integration in parallel
    await Promise.allSettled(
      integrations.map(async (integration) => {
        // Check if this integration should receive this event type
        if (event.startsWith('order.') && !integration.syncOrders) return
        if (event.startsWith('payment.') && !integration.syncPayments) return
        if (event.startsWith('menu.') && !integration.syncMenu) return

        try {
          const response = await fetch(integration.webhookUrl!, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(integration.apiKey ? { 'X-API-Key': integration.apiKey } : {}),
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000), // 10s timeout
          })

          if (!response.ok) {
            console.error(`[POS_WEBHOOK] ${integration.name} returned ${response.status}`)
          }

          // Update last sync time
          await db.pOSIntegration.update({
            where: { id: integration.id },
            data: { lastSyncAt: new Date() },
          })
        } catch (err) {
          console.error(`[POS_WEBHOOK] ${integration.name} failed:`, err)
        }
      })
    )
  } catch (error) {
    console.error('[POS_WEBHOOK_DISPATCH]', error)
  }
}
