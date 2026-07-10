// GET/POST /api/inventory/transfers
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { NumberService } from "@/lib/services/number-service";
import { z } from "zod";

const transferLineSchema = z.object({
  itemId: z.string().min(1), quantity: z.number().positive(), uom: z.string().default("each"),
  unitCost: z.number().min(0).default(0), notes: z.string().max(500).optional().nullable(),
});
const transferSchema = z.object({
  fromOrgNodeId: z.string().min(1), toOrgNodeId: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(), lines: z.array(transferLineSchema).min(1),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const transfers = await db.stockTransfer.findMany({
    where: status ? { status } : {},
    include: { fromOrgNode: { select: { id: true, name: true, code: true } }, toOrgNode: { select: { id: true, name: true, code: true } }, _count: { select: { lines: true } } },
    orderBy: { transferDate: "desc" }, take: 100,
  });
  return Response.json({ transfers });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, transferSchema);
  if (data.fromOrgNodeId === data.toOrgNodeId) throw new HttpError(400, "Source and destination nodes must be different");
  const tenantId = getCurrentTenantId()!;
  const transferNumber = await NumberService.next(tenantId, "TRF");
  let totalValue = 0;
  const lines = data.lines.map((line, idx) => {
    const lineTotal = line.quantity * line.unitCost; totalValue += lineTotal;
    return { tenantId, lineNo: idx + 1, itemId: line.itemId, quantity: line.quantity, uom: line.uom, unitCost: line.unitCost, lineTotal, notes: line.notes ?? null };
  });
  const transfer = await db.stockTransfer.create({
    data: {
      tenantId, transferNumber, fromOrgNodeId: data.fromOrgNodeId, toOrgNodeId: data.toOrgNodeId,
      notes: data.notes ?? null, status: "in_transit", createdBy: user.id,
      lines: { create: lines },
    },
    include: { lines: { include: { item: { select: { id: true, sku: true, name: true, uom: true } } } } },
  });
  return Response.json({ transfer }, { status: 201 });
});
