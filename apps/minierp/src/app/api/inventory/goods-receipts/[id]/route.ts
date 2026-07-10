// GET/PATCH /api/inventory/goods-receipts/[id]
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { z } from "zod";
const patchSchema = z.object({ notes: z.string().max(2000).optional().nullable(), status: z.enum(["draft", "received", "reversed"]).optional() });

export const GET = withTenant(async ({ params }) => {
  const gr = await db.goodsReceipt.findUnique({
    where: { id: params.id },
    include: { supplier: true, orgNode: true, purchaseOrder: { include: { supplier: true } }, lines: { orderBy: { lineNo: "asc" }, include: { item: true } } },
  });
  if (!gr) throw new HttpError(404, "Goods receipt not found");
  return Response.json({ goodsReceipt: gr });
});

export const PATCH = withTenant(async ({ req, params }) => {
  const data = await parseAndValidate(req, patchSchema);
  const gr = await db.goodsReceipt.update({ where: { id: params.id }, data });
  return Response.json({ goodsReceipt: gr });
});
