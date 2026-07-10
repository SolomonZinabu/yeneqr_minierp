// GET /api/permissions — full permission catalog + role→permission mapping
import { withTenant } from "@/lib/api-helpers";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, ROLE_LABELS, PERMISSION_LABELS, PERMISSION_GROUPS } from "@/lib/permissions";

export const GET = withTenant(async () => {
  return Response.json({
    permissions: PERMISSIONS, permissionLabels: PERMISSION_LABELS, permissionGroups: PERMISSION_GROUPS,
    roles: ROLES, roleLabels: ROLE_LABELS,
    rolePermissions: Object.fromEntries(ROLES.map((r) => [r, ROLE_PERMISSIONS[r]])),
  });
});
