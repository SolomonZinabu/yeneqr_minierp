// GET /api/inventory/stock-on-hand
import { withTenant, db } from "@/lib/api-helpers";
import { StockService } from "@/lib/services/stock-service";

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const orgNodeId = url.searchParams.get("orgNodeId");
  const itemId = url.searchParams.get("itemId");
  const lowStock = url.searchParams.get("lowStock") === "true";
  if (lowStock) {
    const items = await StockService.getLowStockItems(orgNodeId ?? undefined);
    return Response.json({ items, count: items.length });
  }
  if (itemId) {
    const stock = await StockService.getStockOnHand(itemId, orgNodeId ?? undefined);
    return Response.json({ stock });
  }
  const items = await db.inventoryItem.findMany({
    where: { isStockable: true, isActive: true },
    select: {
      id: true, sku: true, name: true, category: true, uom: true,
      reorderPoint: true, costPrice: true, sellPrice: true,
      movements: orgNodeId ? { where: { orgNodeId }, select: { quantity: true, unitCost: true } } : { select: { quantity: true, unitCost: true, orgNodeId: true } },
    },
    orderBy: { name: "asc" },
  });
  const result = items.map((item) => {
    const qty = item.movements.reduce((s, m) => s + m.quantity, 0);
    return {
      itemId: item.id, sku: item.sku, name: item.name, category: item.category, uom: item.uom,
      qtyOnHand: qty, unitCost: item.costPrice, totalValue: qty * item.costPrice,
      reorderPoint: item.reorderPoint, isLow: qty <= item.reorderPoint,
    };
  });
  return Response.json({ items: result, count: result.length });
});
