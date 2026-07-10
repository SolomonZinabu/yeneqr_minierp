// POST /api/inventory/goods-receipts/[id]/post  (requires inventory.grn.post)
import { withPermission, db, HttpError } from "@/lib/api-helpers";
import { GlService } from "@/lib/services/gl-service";

export const POST = withPermission("inventory.grn.post", async ({ params, user }) => {
  const gr = await db.goodsReceipt.findUnique({ where: { id: params.id } });
  if (!gr) throw new HttpError(404, "Goods receipt not found");
  if (gr.status !== "received") throw new HttpError(409, `GRN is in status "${gr.status}" — only "received" GRNs can be posted`);
  if (gr.journalEntryId) return Response.json({ journalEntryId: gr.journalEntryId, alreadyPosted: true });
  const journalEntryId = await GlService.postGoodsReceipt(params.id, user.id);
  return Response.json({ journalEntryId });
});
