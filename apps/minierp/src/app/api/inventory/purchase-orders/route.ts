// GET/POST /api/inventory/purchase-orders
import { withTenant, parseAndValidate, db } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { NumberService } from "@/lib/services/number-service";
import { z } from "zod";

const poLineSchema = z.object({
  itemId: z.string().min(1), quantity: z.number().positive(), uom: z.string().default("each"),
  unitCost: z.number().min(0), taxRate: z.number().min(0).max(1).default(0), discountPct: z.number().min(0).max(100).default(0),
  notes: z.string().max(500).optional().nullable(),
});
const poSchema = z.object({
  orgNodeId: z.string().optional().nullable(), supplierId: z.string().min(1),
  expectedDate: z.string().datetime().optional().nullable(), currency: z.string().default("ETB"),
  notes: z.string().max(2000).optional().nullable(), lines: z.array(poLineSchema).min(1),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const supplierId = url.searchParams.get("supplierId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const pos = await db.purchaseOrder.findMany({
    where: { ...(status ? { status } : {}), ...(supplierId ? { supplierId } : {}) },
    include: { supplier: { select: { id: true, name: true, code: true } }, orgNode: { select: { id: true, name: true, code: true } }, _count: { select: { lines: true, goodsReceipts: true } } },
    orderBy: { orderDate: "desc" }, take: limit,
  });
  return Response.json({ purchaseOrders: pos });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, poSchema);
  const tenantId = getCurrentTenantId()!;
  const poNumber = await NumberService.next(tenantId, "PO");
  let subtotal = 0, taxTotal = 0;
  const lines = data.lines.map((line, idx) => {
    const gross = line.quantity * line.unitCost;
    const discount = gross * (line.discountPct / 100);
    const net = gross - discount;
    const tax = net * line.taxRate;
    subtotal += net; taxTotal += tax;
    return { tenantId, lineNo: idx + 1, itemId: line.itemId, quantity: line.quantity, uom: line.uom, unitCost: line.unitCost, taxRate: line.taxRate, discountPct: line.discountPct, lineTotal: net + tax, notes: line.notes ?? null };
  });
  const po = await db.purchaseOrder.create({
    data: {
      tenantId, poNumber, orgNodeId: data.orgNodeId ?? null, supplierId: data.supplierId,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null, currency: data.currency,
      subtotal, taxTotal, discountTotal: 0, totalAmount: subtotal + taxTotal,
      notes: data.notes ?? null, status: "draft", createdBy: user.id,
      lines: { create: lines },
    },
    include: { lines: { include: { item: { select: { id: true, sku: true, name: true } } } } },
  });
  return Response.json({ purchaseOrder: po }, { status: 201 });
});
