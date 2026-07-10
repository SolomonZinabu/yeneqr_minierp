// GET/PATCH/DELETE /api/inventory/purchase-orders/[id]
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["draft", "submitted", "approved", "sent", "cancelled"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
  expectedDate: z.string().datetime().optional().nullable(),
});

export const GET = withTenant(async ({ params }) => {
  const po = await db.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true, orgNode: true,
      lines: { orderBy: { lineNo: "asc" }, include: { item: true } },
      goodsReceipts: { orderBy: { receiptDate: "desc" }, select: { id: true, grnNumber: true, receiptDate: true, status: true, totalAmount: true } },
    },
  });
  if (!po) throw new HttpError(404, "Purchase order not found");
  return Response.json({ purchaseOrder: po });
});

export const PATCH = withTenant(async ({ req, params, user }) => {
  const data = await parseAndValidate(req, patchSchema);
  const existing = await db.purchaseOrder.findUnique({ where: { id: params.id } });
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (data.status && data.status !== existing.status) {
    const transitions: Record<string, string[]> = {
      draft: ["submitted", "cancelled"], submitted: ["approved", "draft", "cancelled"],
      approved: ["sent", "cancelled"], sent: ["partial", "received", "cancelled"],
      partial: ["received", "closed"], received: ["closed"], closed: [], cancelled: [],
    };
    if (!transitions[existing.status]?.includes(data.status)) throw new HttpError(409, `Cannot transition PO from "${existing.status}" to "${data.status}"`);
  }
  const po = await db.purchaseOrder.update({
    where: { id: params.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.expectedDate !== undefined ? { expectedDate: data.expectedDate ? new Date(data.expectedDate) : null } : {}),
      ...(data.status === "approved" ? { approvedBy: user.id, approvedAt: new Date() } : {}),
    },
  });
  return Response.json({ purchaseOrder: po });
});

export const DELETE = withTenant(async ({ params }) => {
  const existing = await db.purchaseOrder.findUnique({ where: { id: params.id } });
  if (!existing) throw new HttpError(404, "Purchase order not found");
  if (!["draft", "submitted"].includes(existing.status)) throw new HttpError(409, `Cannot cancel PO in status "${existing.status}"`);
  await db.purchaseOrder.update({ where: { id: params.id }, data: { status: "cancelled" } });
  return Response.json({ ok: true });
});
