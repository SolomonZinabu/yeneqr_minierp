// POST /api/inventory/stocktakes/[id]/post  (requires inventory.stocktake.post)
import { withPermission, db, HttpError } from "@/lib/api-helpers";
import { StockService } from "@/lib/services/stock-service";
import { GlService } from "@/lib/services/gl-service";

export const POST = withPermission("inventory.stocktake.post", async ({ params, user }) => {
  const stocktake = await db.stocktake.findUnique({ where: { id: params.id }, include: { lines: true } });
  if (!stocktake) throw new HttpError(404, "Stocktake not found");
  if (stocktake.status === "posted") throw new HttpError(409, "Stocktake already posted");
  if (!["counting", "reconciled"].includes(stocktake.status)) throw new HttpError(409, `Stocktake is in status "${stocktake.status}" — must be "counting" or "reconciled"`);
  for (const line of stocktake.lines) {
    const variance = line.countedQty - line.systemQty;
    const varianceValue = variance * line.unitCost;
    await db.stocktakeLine.update({ where: { id: line.id }, data: { variance, varianceValue } });
    if (Math.abs(variance) > 0.001) {
      await StockService.recordMovement({
        orgNodeId: stocktake.orgNodeId, itemId: line.itemId, movementType: "adjust",
        quantity: variance, unitCost: line.unitCost, refType: "stocktake", refId: stocktake.id,
        notes: `Stocktake ${stocktake.stocktakeNumber} adjustment`, createdBy: user.id,
      });
    }
  }
  const journalEntryId = await GlService.postStocktakeVariance(params.id, user.id);
  const updated = await db.stocktake.update({ where: { id: params.id }, data: { status: "posted", postedDate: new Date() } });
  return Response.json({ stocktake: updated, journalEntryId });
});
