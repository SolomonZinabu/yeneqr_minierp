// POST /api/integrations/yeneqr/webhook
//
// Inbound webhook receiver for events coming from YeneQR.
// YeneQR's dispatchPOSWebhook() sends events here whenever an order is created,
// a payment is received, an order status changes, or a refund is issued.
//
// Auth: X-API-Key header must match the TenantIntegration.apiKey for the
// matching tenant. The tenant is resolved by looking up the API key, then
// the event is stored in IntegrationEvent for async processing.
//
// For Phase 0B, we ONLY store the event — no business logic processing yet.
// Phase 1 (SCM) will add processing: order.created → snapshot, payment.received
// → journal entry, etc.

import { NextRequest, NextResponse } from "next/server";
import { db, dbRaw, runWithTenant } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // 1) Auth — X-API-Key header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing X-API-Key header" },
        { status: 401 },
      );
    }

    // 2) Look up the TenantIntegration by API key (bypass tenant filter —
    //    we don't have a tenant context yet, that's what we're resolving)
    const integration = await dbRaw.tenantIntegration.findFirst({
      where: { apiKey, isActive: true, provider: "yeneqr" },
      include: { tenant: true },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 },
      );
    }

    if (!integration.tenant.erpEnabled) {
      return NextResponse.json(
        { error: "ERP not enabled for this tenant" },
        { status: 402 },
      );
    }

    // 3) Parse the payload
    const body = await req.json();
    const { event: eventType, restaurantId, data, timestamp } = body ?? {};

    if (!eventType || !data) {
      return NextResponse.json(
        { error: "Missing 'event' or 'data' in payload" },
        { status: 400 },
      );
    }

    // 4) Store the event (within tenant context so IntegrationEvent is auto-scoped)
    await runWithTenant(integration.tenantId, async () => {
      const externalId =
        (data as { id?: string; orderId?: string; paymentId?: string }).id ??
        (data as { orderId?: string }).orderId ??
        (data as { paymentId?: string }).paymentId ??
        null;

      // Dedup on (provider, externalId) — if we've already received this event,
      // ack it without re-storing
      const existing = await db.integrationEvent.findFirst({
        where: { provider: "yeneqr", externalId },
      });

      if (existing) {
        return;
      }

      await db.integrationEvent.create({
        data: {
          tenantId: integration.tenantId, // explicit for TS; middleware also injects (same value)
          provider: "yeneqr",
          eventType,
          externalId,
          payload: {
            ...data,
            _meta: { restaurantId, timestamp, receivedAt: new Date().toISOString() },
          },
          status: "received",
        },
      });
    });

    // 5) Ack immediately — async processing happens in a background job (Phase 1)
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[YENEQR_WEBHOOK_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}
