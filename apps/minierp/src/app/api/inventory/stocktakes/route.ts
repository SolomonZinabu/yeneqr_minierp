// GET/POST /api/inventory/stocktakes
import { withTenant, parseAndValidate, db } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { NumberService } from "@/lib/services/number-service";
import { StockService } from "@/lib/services/stock-service";
import { z } from "zod";

const stocktakeSchema = z.object({
  orgNodeId: z.string().min(1), countDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional().nullable(), itemIds: z.array(z.string()).optional(),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const orgNodeId = url.searchParams.get("orgNodeId");
  const stocktakes = await db.stocktake.findMany({
    where: { ...(status ? { status } : {}), ...(orgNodeId ? { orgNodeId } : {}) },
    include: { orgNode: { select: { id: true, name: true, code: true } }, _count: { select: { lines: true } } },
    orderBy: { countDate: "desc" }, take: 100,
  });
  return Response.json({ stocktakes });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, stocktakeSchema);
  const tenantId = getCurrentTenantId()!;
  const stocktakeNumber = await NumberService.next(tenantId, "STK");
  const items = data.itemIds && data.itemIds.length > 0
    ? await db.inventoryItem.findMany({ where: { id: { in: data.itemIds }, isStockable: true, isActive: true } })
    : await db.inventoryItem.findMany({ where: { isStockable: true, isActive: true } });
  const lines = [];
  for (const item of items) {
    const onHand = await StockService.getStockOnHand(item.id, data.orgNodeId);
    const qty = onHand[0]?.qtyOnHand ?? 0;
    const unitCost = onHand[0]?.unitCost ?? item.costPrice;
    lines.push({ tenantId, itemId: item.id, systemQty: qty, countedQty: qty, variance: 0, unitCost, varianceValue: 0 });
  }
  const stocktake = await db.stocktake.create({
    data: {
      tenantId, stocktakeNumber, orgNodeId: data.orgNodeId,
      countDate: data.countDate ? new Date(data.countDate) : new Date(),
      status: "counting", notes: data.notes ?? null, createdBy: user.id,
      lines: { create: lines.map((l, i) => ({ ...l, lineNo: i + 1 })) },
    },
    include: { lines: { include: { item: { select: { id: true, sku: true, name: true, uom: true } } } } },
  });
  return Response.json({ stocktake }, { status: 201 });
});
