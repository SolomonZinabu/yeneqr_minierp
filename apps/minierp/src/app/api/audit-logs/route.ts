// GET /api/audit-logs
import { withTenant, db } from "@/lib/api-helpers";

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const logs = await db.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}),
      ...(action ? { action } : {}), ...(userId ? { userId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" }, take: limit,
  });
  return Response.json({ logs, count: logs.length });
});
