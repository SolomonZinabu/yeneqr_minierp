// GET/POST /api/inventory/goods-receipts
import { withTenant, parseAndValidate, db } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { NumberService } from "@/lib/services/number-service";
import { StockService } from "@/lib/services/stock-service";
import { GlService } from "@/lib/services/gl-service";
import { z } from "zod";

const grLineSchema = z.object({
  itemId: z.string().min(1), poLineId: z.string().optional().nullable(),
  quantityOrdered: z.number().optional().nullable(), quantityReceived: z.number().positive(),
  quantityRejected: z.number().min(0).default(0), uom: z.string().default("each"),
  unitCost: z.number().min(0), taxRate: z.number().min(0).max(1).default(0),
  batchNo: z.string().optional().nullable(), expiryDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
const grSchema = z.object({
  orgNodeId: z.string().min(1), supplierId: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  invoiceNumber: z.string().max(100).optional().nullable(),
  currency: z.string().default("ETB"), notes: z.string().max(2000).optional().nullable(),
  lines: z.array(grLineSchema).min(1), autoPost: z.boolean().default(false),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const supplierId = url.searchParams.get("supplierId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const grs = await db.goodsReceipt.findMany({
    where: { ...(status ? { status } : {}), ...(supplierId ? { supplierId } : {}) },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      orgNode: { select: { id: true, name: true, code: true } },
      purchaseOrder: { select: { id: true, poNumber: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { receiptDate: "desc" }, take: limit,
  });
  return Response.json({ goodsReceipts: grs });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, grSchema);
  const tenantId = getCurrentTenantId()!;
  const grnNumber = await NumberService.next(tenantId, "GRN");
  let subtotal = 0, taxTotal = 0;
  const lines = data.lines.map((line, idx) => {
    const net = line.quantityReceived * line.unitCost;
    const tax = net * line.taxRate;
    subtotal += net; taxTotal += tax;
    return { lineNo: idx + 1, ...line, lineTotal: net + tax };
  });
  const gr = await db.$transaction(async (tx) => {
    const created = await tx.goodsReceipt.create({
      data: {
        tenantId, grnNumber, orgNodeId: data.orgNodeId, supplierId: data.supplierId ?? null,
        purchaseOrderId: data.purchaseOrderId ?? null,
        invoiceNumber: data.invoiceNumber ?? null, currency: data.currency,
        subtotal, taxTotal, totalAmount: subtotal + taxTotal,
        notes: data.notes ?? null, status: "received", createdBy: user.id,
        lines: {
          create: lines.map((l) => ({
            tenantId, lineNo: l.lineNo, poLineId: l.poLineId ?? null, itemId: l.itemId,
            quantityOrdered: l.quantityOrdered ?? null, quantityReceived: l.quantityReceived,
            quantityRejected: l.quantityRejected, uom: l.uom, unitCost: l.unitCost,
            taxRate: l.taxRate, lineTotal: l.lineTotal, batchNo: l.batchNo ?? null,
            expiryDate: l.expiryDate ? new Date(l.expiryDate) : null, notes: l.notes ?? null,
          })),
        },
      },
      include: { lines: true },
    });
    if (data.purchaseOrderId) {
      for (const line of lines) {
        if (line.poLineId) {
          await tx.purchaseOrderLine.update({ where: { id: line.poLineId }, data: { receivedQty: { increment: line.quantityReceived } } });
        }
      }
      const po = await tx.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId }, include: { lines: true } });
      if (po) {
        const allReceived = po.lines.every((l) => l.receivedQty >= l.quantity);
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: allReceived ? "received" : "partial" } });
      }
    }
    return created;
  });
  const grWithLines = await db.goodsReceipt.findUniqueOrThrow({ where: { id: gr.id }, include: { lines: true } });
  for (const line of grWithLines.lines) {
    await StockService.recordMovement({
      orgNodeId: data.orgNodeId, itemId: line.itemId, movementType: "receive",
      quantity: line.quantityReceived, unitCost: line.unitCost,
      refType: "goods_receipt", refId: gr.id, batchNo: line.batchNo ?? undefined,
      expiryDate: line.expiryDate ?? undefined, notes: `GRN ${gr.grnNumber} — line ${line.lineNo}`, createdBy: user.id,
    });
  }
  let journalEntryId: string | null = null;
  if (data.autoPost) journalEntryId = await GlService.postGoodsReceipt(gr.id, user.id);
  return Response.json({ goodsReceipt: gr, journalEntryId }, { status: 201 });
});
