// GET/PATCH/DELETE /api/inventory/suppliers/[id]
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactName: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  paymentTerms: z.string().max(50).optional().nullable(),
  leadTimeDays: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const GET = withTenant(async ({ params }) => {
  const supplier = await db.supplier.findUnique({
    where: { id: params.id },
    include: { purchaseOrders: { orderBy: { orderDate: "desc" }, take: 10, select: { id: true, poNumber: true, status: true, totalAmount: true, orderDate: true } }, _count: { select: { purchaseOrders: true, goodsReceipts: true } } },
  });
  if (!supplier) throw new HttpError(404, "Supplier not found");
  return Response.json({ supplier });
});

export const PATCH = withTenant(async ({ req, params }) => {
  const data = await parseAndValidate(req, updateSchema);
  const supplier = await db.supplier.update({ where: { id: params.id }, data });
  return Response.json({ supplier });
});

export const DELETE = withTenant(async ({ params }) => {
  await db.supplier.update({ where: { id: params.id }, data: { isActive: false } });
  return Response.json({ ok: true });
});
