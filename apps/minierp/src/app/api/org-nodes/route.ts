// GET /api/org-nodes
import { withTenant, db } from "@/lib/api-helpers";

export const GET = withTenant(async () => {
  const nodes = await db.organizationNode.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  return Response.json({ nodes });
});
