// GET/POST /api/inventory/wastages
import { withTenant, parseAndValidate, db } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { NumberService } from "@/lib/services/number-service";
import { z } from "zod";

const wastageLineSchema = z.object({
  itemId: z.string().min(1), quantity: z.number().positive(), uom: z.string().default("each"),
  unitCost: z.number().min(0).default(0), reasonCode: z.string().max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
const wastageSchema = z.object({
  orgNodeId: z.string().min(1),
  wastageType: z.enum(["spoilage", "breakage", "expiry", "theft", "sample", "other"]).default("spoilage"),
  wastageDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z.array(wastageLineSchema).min(1),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const orgNodeId = url.searchParams.get("orgNodeId");
  const wastages = await db.wastage.findMany({
    where: { ...(status ? { status } : {}), ...(orgNodeId ? { orgNodeId } : {}) },
    include: { orgNode: { select: { id: true, name: true, code: true } }, _count: { select: { lines: true } } },
    orderBy: { wastageDate: "desc" }, take: 100,
  });
  return Response.json({ wastages });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, wastageSchema);
  const tenantId = getCurrentTenantId()!;
  const wastageNumber = await NumberService.next(tenantId, "WST");
  let totalValue = 0;
  const lines = data.lines.map((line, idx) => {
    const lineTotal = line.quantity * line.unitCost; totalValue += lineTotal;
    return { tenantId, lineNo: idx + 1, itemId: line.itemId, quantity: line.quantity, uom: line.uom, unitCost: line.unitCost, lineTotal, reasonCode: line.reasonCode ?? null, notes: line.notes ?? null };
  });
  const wastage = await db.wastage.create({
    data: {
      tenantId, wastageNumber, orgNodeId: data.orgNodeId, wastageType: data.wastageType,
      wastageDate: data.wastageDate ? new Date(data.wastageDate) : new Date(),
      totalValue, notes: data.notes ?? null, status: "draft", createdBy: user.id,
      lines: { create: lines },
    },
    include: { lines: { include: { item: { select: { id: true, sku: true, name: true, uom: true } } } } },
  });
  return Response.json({ wastage }, { status: 201 });
});
