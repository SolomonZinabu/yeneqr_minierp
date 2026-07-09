// src/lib/erp-gate.ts
// "Gate" helper: enforce that a tenant has ERP enabled before allowing
// access to ERP business endpoints.
//
// Use in API routes that touch ERP business logic (inventory, finance, HR).
// Returns a 402-style response (Payment Required) when the tenant's
// `erpEnabled` flag is false.

import { NextResponse } from "next/server";

import type { TenantInfo } from "./tenant-context";

export interface ErpGateResult {
  ok: boolean;
  response?: NextResponse;
}

/**
 * Check whether the given tenant can use ERP features.
 * Returns `{ ok: false, response }` if not — caller should `return response`.
 */
export function assertErpEnabled(tenant: {
  erpEnabled: boolean;
  name: string;
  slug: string;
  erpPlanSlug: string;
}): ErpGateResult {
  if (!tenant.erpEnabled) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "ERP_NOT_ENABLED",
          message: `ERP is not enabled for tenant "${tenant.name}". Upgrade required.`,
          plan: tenant.erpPlanSlug,
          upgradeUrl: "/settings/billing",
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true };
}

/**
 * Convert a Tenant row (Prisma) to the TenantInfo shape used in the client.
 */
export function toTenantInfo(t: {
  id: string;
  name: string;
  slug: string;
  currency: string;
  erpEnabled: boolean;
  erpPlanSlug: string;
  externalYeneqrId: string | null;
}): TenantInfo {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    currency: t.currency,
    erpEnabled: t.erpEnabled,
    erpPlanSlug: t.erpPlanSlug,
    externalYeneqrId: t.externalYeneqrId,
  };
}
