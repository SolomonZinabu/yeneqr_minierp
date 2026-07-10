// POST /api/inventory/transfers/[id]/receive  (requires inventory.transfer.receive)
import { withPermission, db, HttpError } from "@/lib/api-helpers";
import { StockService } from "@/lib/services/stock-service";

export const POST = withPermission("inventory.transfer.receive", async ({ params, user }) => {
  const transfer = await db.stockTransfer.findUnique({ where: { id: params.id }, include: { lines: { include: { item: true } } } });
  if (!transfer) throw new HttpError(404, "Transfer not found");
  if (transfer.status === "received") throw new HttpError(409, "Transfer already received");
  if (transfer.status === "cancelled") throw new HttpError(409, "Transfer was cancelled");
  for (const line of transfer.lines) {
    await StockService.recordMovement({
      orgNodeId: transfer.fromOrgNodeId, itemId: line.itemId, movementType: "transfer_out",
      quantity: -line.quantity, unitCost: line.unitCost, refType: "transfer", refId: transfer.id,
      notes: `Transfer out: ${transfer.transferNumber} → ${line.quantity} ${line.uom}`, createdBy: user.id,
    });
    await StockService.recordMovement({
      orgNodeId: transfer.toOrgNodeId, itemId: line.itemId, movementType: "transfer_in",
      quantity: line.quantity, unitCost: line.unitCost, refType: "transfer", refId: transfer.id,
      notes: `Transfer in: ${transfer.transferNumber} → ${line.quantity} ${line.uom}`, createdBy: user.id,
    });
  }
  const updated = await db.stockTransfer.update({ where: { id: params.id }, data: { status: "received", receivedDate: new Date() } });
  return Response.json({ transfer: updated });
});
