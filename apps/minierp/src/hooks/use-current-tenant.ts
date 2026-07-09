// src/hooks/use-current-tenant.ts
// Client hook: returns the currently selected tenant (from React context).

"use client";

import { useTenant } from "@/lib/tenant-context";

export function useCurrentTenant() {
  const { tenant, tenants, setTenant, isLoading } = useTenant();
  return { tenant, tenants, setTenant, isLoading };
}
