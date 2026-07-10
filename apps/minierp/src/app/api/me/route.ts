// GET /api/me — returns current user + role + effective permissions
import { withTenant } from "@/lib/api-helpers";

export const GET = withTenant(async ({ user, role, permissions, tenant }) => {
  return Response.json({
    user, role, permissions: Array.from(permissions).sort(),
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, currency: tenant.currency, erpPlanSlug: tenant.erpPlanSlug },
  });
});
