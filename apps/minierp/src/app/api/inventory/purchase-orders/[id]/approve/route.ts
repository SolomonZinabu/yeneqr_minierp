// POST /api/inventory/purchase-orders/[id]/approve  (requires inventory.po.approve)
import { withPermission, db, HttpError } from "@/lib/api-helpers";

export const POST = withPermission("inventory.po.approve", async ({ params, user }) => {
  const existing = await db.purchaseOrder.findUnique({ where: { id: params.id } });
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (!["draft", "submitted"].includes(existing.status)) throw new HttpError(409, `PO is in status "${existing.status}" — cannot approve`);
  const po = await db.purchaseOrder.update({ where: { id: params.id }, data: { status: "approved", approvedBy: user.id, approvedAt: new Date() } });
  return Response.json({ purchaseOrder: po });
});
