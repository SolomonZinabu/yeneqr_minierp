// POST /api/inventory/wastages/[id]/post  (requires inventory.wastage.post)
import { withPermission, db, HttpError } from "@/lib/api-helpers";
import { StockService } from "@/lib/services/stock-service";
import { GlService } from "@/lib/services/gl-service";

export const POST = withPermission("inventory.wastage.post", async ({ params, user }) => {
  const wastage = await db.wastage.findUnique({ where: { id: params.id }, include: { lines: true } });
  if (!wastage) throw new HttpError(404, "Wastage not found");
  if (wastage.status === "posted") throw new HttpError(409, "Wastage already posted");
  if (wastage.status === "cancelled") throw new HttpError(409, "Wastage was cancelled");
  for (const line of wastage.lines) {
    await StockService.recordMovement({
      orgNodeId: wastage.orgNodeId, itemId: line.itemId, movementType: "wastage",
      quantity: -line.quantity, unitCost: line.unitCost, refType: "wastage", refId: wastage.id,
      notes: `Wastage ${wastage.wastageNumber} — line ${line.lineNo} (${wastage.wastageType})`, createdBy: user.id,
    });
  }
  const journalEntryId = await GlService.postWastage(params.id, user.id);
  const updated = await db.wastage.update({ where: { id: params.id }, data: { status: "posted" } });
  return Response.json({ wastage: updated, journalEntryId });
});
