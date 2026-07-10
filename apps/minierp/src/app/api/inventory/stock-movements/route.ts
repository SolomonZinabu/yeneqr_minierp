// GET /api/inventory/stock-movements
import { withTenant, db } from "@/lib/api-helpers";

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const orgNodeId = url.searchParams.get("orgNodeId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const type = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const movements = await db.stockMovement.findMany({
    where: {
      ...(itemId ? { itemId } : {}),
      ...(orgNodeId ? { orgNodeId } : {}),
      ...(type ? { movementType: type } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    include: { item: { select: { id: true, sku: true, name: true, uom: true } }, orgNode: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: "desc" }, take: limit,
  });
  return Response.json({ movements, count: movements.length });
});
