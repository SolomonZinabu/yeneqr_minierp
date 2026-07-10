// src/lib/services/stock-service.ts
// Stock ledger — the single source of truth for inventory movements.

import { db, getCurrentTenantId } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface StockMovementInput {
  orgNodeId: string;
  itemId: string;
  movementType: "receive" | "issue" | "transfer_in" | "transfer_out" | "adjust" | "wastage" | "sale" | "return" | "production";
  quantity: number;
  unitCost?: number;
  refType?: string;
  refId?: string;
  batchNo?: string;
  expiryDate?: Date;
  notes?: string;
  createdBy?: string;
}

export class StockService {
  static async recordMovement(input: StockMovementInput): Promise<{ movementId: string; balanceAfter: number; newUnitCost?: number }> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("StockService.recordMovement requires tenant context");

    return db.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: input.itemId },
        include: { movements: { where: { orgNodeId: input.orgNodeId }, orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!item.isStockable && !["adjust", "wastage"].includes(input.movementType)) {
        throw new Error(`Item ${item.sku} is not stockable — cannot record movement`);
      }
      const lastBalance = item.movements[0]?.balanceAfter ?? 0;
      const newBalance = lastBalance + input.quantity;
      let unitCost = input.unitCost ?? item.costPrice;
      let newUnitCost: number | undefined;

      if (input.movementType === "receive" && input.quantity > 0 && input.unitCost !== undefined) {
        const totalQty = lastBalance + input.quantity;
        const totalValue = lastBalance * item.costPrice + input.quantity * input.unitCost;
        newUnitCost = totalQty > 0 ? totalValue / totalQty : input.unitCost;
        unitCost = input.unitCost;
        await tx.inventoryItem.update({ where: { id: input.itemId }, data: { costPrice: newUnitCost } });
      }

      const movement = await tx.stockMovement.create({
        data: {
          tenantId, orgNodeId: input.orgNodeId, itemId: input.itemId,
          movementType: input.movementType, quantity: input.quantity, balanceAfter: newBalance,
          unitCost, totalCost: unitCost * Math.abs(input.quantity),
          refType: input.refType, refId: input.refId, batchNo: input.batchNo,
          expiryDate: input.expiryDate, notes: input.notes, createdBy: input.createdBy,
        },
      });

      const today = new Date(); today.setHours(0, 0, 0, 0);
      await tx.itemCostSnapshot.upsert({
        where: { tenantId_orgNodeId_itemId_snapshotDate: { tenantId, orgNodeId: input.orgNodeId, itemId: input.itemId, snapshotDate: today } },
        create: { tenantId, orgNodeId: input.orgNodeId, itemId: input.itemId, qtyOnHand: newBalance, unitCost: newUnitCost ?? item.costPrice, totalValue: newBalance * (newUnitCost ?? item.costPrice), snapshotDate: today },
        update: { qtyOnHand: newBalance, unitCost: newUnitCost ?? item.costPrice, totalValue: newBalance * (newUnitCost ?? item.costPrice) },
      });

      return { movementId: movement.id, balanceAfter: newBalance, newUnitCost };
    });
  }

  static async getStockOnHand(itemId: string, orgNodeId?: string) {
    const where: Prisma.StockMovementWhereInput = { itemId };
    if (orgNodeId) where.orgNodeId = orgNodeId;
    const movements = await db.stockMovement.findMany({ where, select: { orgNodeId: true, quantity: true, unitCost: true } });
    const byNode = new Map<string, { qty: number; totalCost: number }>();
    for (const m of movements) {
      const cur = byNode.get(m.orgNodeId) ?? { qty: 0, totalCost: 0 };
      cur.qty += m.quantity; cur.totalCost += Math.abs(m.quantity) * m.unitCost;
      byNode.set(m.orgNodeId, cur);
    }
    return Array.from(byNode.entries()).map(([node, { qty, totalCost }]) => ({
      itemId, orgNodeId: node, qtyOnHand: qty,
      unitCost: qty > 0 ? totalCost / Math.abs(qty) : 0, totalValue: qty * (qty > 0 ? totalCost / Math.abs(qty) : 0),
    }));
  }

  static async consumeBomForProduction(orgNodeId: string, finishedItemId: string, producedQty: number, refType: string, refId: string, createdBy?: string) {
    const bom = await db.billOfMaterial.findFirst({
      where: { itemId: finishedItemId, isActive: true },
      include: { lines: { include: { ingredient: true } } },
    });
    if (!bom) return [];
    const scale = producedQty / bom.yieldQty;
    const consumed = [];
    for (const line of bom.lines) {
      const qty = -1 * line.quantity * scale;
      const result = await this.recordMovement({
        orgNodeId, itemId: line.itemId, movementType: "production", quantity: qty,
        refType, refId, notes: `BOM consumption for ${producedQty} × ${bom.name}`, createdBy,
      });
      consumed.push({ ingredient: line.itemId, consumedQty: Math.abs(qty), movementId: result.movementId });
    }
    return consumed;
  }

  static async getLowStockItems(orgNodeId?: string) {
    const items = await db.inventoryItem.findMany({
      where: { isStockable: true, isActive: true },
      include: { movements: orgNodeId ? { where: { orgNodeId }, select: { quantity: true } } : { select: { quantity: true, orgNodeId: true } } },
    });
    return items.filter(item => {
      const total = item.movements.reduce((sum, m) => sum + m.quantity, 0);
      return total <= item.reorderPoint;
    }).map(item => ({
      itemId: item.id, sku: item.sku, name: item.name,
      qtyOnHand: item.movements.reduce((s, m) => s + m.quantity, 0),
      reorderPoint: item.reorderPoint, reorderQty: item.reorderQty,
    }));
  }
}

export { Prisma };
