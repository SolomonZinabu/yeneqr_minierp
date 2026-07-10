// GET/PATCH/DELETE /api/inventory/items/[id]
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { StockService } from "@/lib/services/stock-service";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  uom: z.string().max(20).optional(),
  itemType: z.enum(["ingredient", "finished_good", "packaging", "consumable"]).optional(),
  isStockable: z.boolean().optional(),
  reorderPoint: z.number().min(0).optional(),
  reorderQty: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  sellPrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  orgNodeId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const GET = withTenant(async ({ params }) => {
  const id = params.id;
  const item = await db.inventoryItem.findUnique({
    where: { id },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 20, include: { orgNode: { select: { name: true, code: true } } } } },
  });
  if (!item) throw new HttpError(404, "Item not found");
  const stockOnHand = await StockService.getStockOnHand(id);
  return Response.json({ item, stockOnHand });
});

export const PATCH = withTenant(async ({ req, params }) => {
  const id = params.id;
  const data = await parseAndValidate(req, updateSchema);
  const existing = await db.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Item not found");
  const item = await db.inventoryItem.update({ where: { id }, data });
  return Response.json({ item });
});

export const DELETE = withTenant(async ({ params }) => {
  const id = params.id;
  const existing = await db.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Item not found");
  await db.inventoryItem.update({ where: { id }, data: { isActive: false } });
  return Response.json({ ok: true });
});
