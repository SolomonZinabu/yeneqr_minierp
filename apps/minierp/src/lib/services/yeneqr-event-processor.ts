// src/lib/services/yeneqr-event-processor.ts
// Processes IntegrationEvent rows from YeneQR webhooks.
// order.created → snapshot only
// order.status_changed → if fulfilled, consume BOM + post GL sale
// refund.issued → reverse GL + return stock

import { db, runWithTenant } from "@/lib/db";
import { GlService } from "./gl-service";
import { StockService } from "./stock-service";
import type { Prisma } from "@prisma/client";

export class YeneqrEventProcessor {
  static async process(eventId: string): Promise<{ ok: boolean; error?: string }> {
    const event = await db.integrationEvent.findUnique({ where: { id: eventId } });
    if (!event) return { ok: false, error: "Event not found" };
    if (event.status === "processed") return { ok: true };
    try {
      await runWithTenant(event.tenantId, async () => {
        switch (event.eventType) {
          case "order.created":
            console.log(`[YENEQR] Order created — event ${event.id}`);
            break;
          case "order.status_changed":
            await this.processOrderStatusChanged(event);
            break;
          case "payment.received":
            console.log(`[YENEQR] Payment received — event ${event.id}`);
            break;
          case "refund.issued":
            await this.processRefundIssued(event);
            break;
          default:
            console.log(`[YENEQR] Unknown event type: ${event.eventType}`);
        }
      });
      await db.integrationEvent.update({ where: { id: eventId }, data: { status: "processed", processedAt: new Date() } });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.integrationEvent.update({ where: { id: eventId }, data: { status: "failed", error: message } });
      return { ok: false, error: message };
    }
  }

  static async processOrderStatusChanged(event: { id: string; payload: Prisma.JsonValue }): Promise<void> {
    const payload = event.payload as unknown as {
      orderId: string; orderNumber: string; branchId: string;
      paymentMethod: "cash" | "telebirr" | "cbe_birr" | "bank_cbe" | "card" | "credit";
      newStatus: string; oldStatus?: string;
      items: { menuItemId: string; name: string; category?: string; quantity: number; unitPrice: number; taxRate?: number }[];
    };
    if (!["fulfilled", "served", "completed"].includes(payload.newStatus)) {
      console.log(`[YENEQR] Order ${payload.orderNumber} status=${payload.newStatus} — no stock action`);
      return;
    }
    if (payload.oldStatus && ["fulfilled", "served", "completed"].includes(payload.oldStatus)) return;

    const orgNode = await db.organizationNode.findFirst({ where: { externalYeneqrBranchId: payload.branchId } });
    if (!orgNode) throw new Error(`No org node linked to YeneQR branch ${payload.branchId}`);

    const glItems: { itemId?: string; name: string; category?: string; qty: number; unitPrice: number; taxRate?: number }[] = [];
    for (const item of payload.items) {
      let inventoryItem = item.menuItemId
        ? await db.inventoryItem.findFirst({ where: { externalYeneqrMenuItemId: item.menuItemId } })
        : null;
      if (inventoryItem) {
        const bom = await db.billOfMaterial.findFirst({ where: { itemId: inventoryItem.id, isActive: true } });
        if (bom) {
          await StockService.consumeBomForProduction(orgNode.id, inventoryItem.id, item.quantity, "sale", payload.orderId);
        } else if (inventoryItem.isStockable) {
          await StockService.recordMovement({
            orgNodeId: orgNode.id, itemId: inventoryItem.id, movementType: "sale",
            quantity: -item.quantity, unitCost: inventoryItem.costPrice,
            refType: "sale", refId: payload.orderId,
            notes: `Sale ${payload.orderNumber} — ${item.name} × ${item.quantity}`,
          });
        }
        glItems.push({ itemId: inventoryItem.id, name: item.name, category: item.category, qty: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate });
      } else {
        glItems.push({ name: item.name, category: item.category, qty: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate });
      }
    }
    await GlService.postSale({ orderId: payload.orderId, paymentMethod: payload.paymentMethod, items: glItems });
    console.log(`[YENEQR] Order ${payload.orderNumber} fulfilled — stock consumed, GL posted`);
  }

  static async processRefundIssued(event: { id: string; payload: Prisma.JsonValue }): Promise<void> {
    const payload = event.payload as unknown as {
      orderId: string; branchId: string; refundAmount: number; reason: string;
      items?: { menuItemId: string; name: string; quantity: number }[];
    };
    const originalEntry = await db.journalEntry.findFirst({
      where: { source: "yeneqr_webhook", sourceRefId: payload.orderId, status: "posted", isReversed: false },
    });
    if (originalEntry) await GlService.reverseEntry(originalEntry.id, `Refund: ${payload.reason}`);
    if (payload.items && payload.items.length > 0) {
      const orgNode = await db.organizationNode.findFirst({ where: { externalYeneqrBranchId: payload.branchId } });
      if (!orgNode) throw new Error(`No org node linked to YeneQR branch ${payload.branchId}`);
      for (const item of payload.items) {
        const inventoryItem = await db.inventoryItem.findFirst({ where: { externalYeneqrMenuItemId: item.menuItemId } });
        if (inventoryItem) {
          await StockService.recordMovement({
            orgNodeId: orgNode.id, itemId: inventoryItem.id, movementType: "return",
            quantity: item.quantity, unitCost: inventoryItem.costPrice,
            refType: "refund", refId: payload.orderId, notes: `Refund for order ${payload.orderId}`,
          });
        }
      }
    }
    console.log(`[YENEQR] Refund processed for order ${payload.orderId}`);
  }
}
