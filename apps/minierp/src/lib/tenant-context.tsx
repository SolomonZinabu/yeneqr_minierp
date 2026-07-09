// src/lib/tenant-context.ts
// React context + hook for the currently selected tenant.
//
// The tenant ID lives in a cookie (selected by the user via the tenant
// switcher) and is also propagated as an `x-tenant-id` HTTP header on
// every API request via lib/api-client.ts.

"use client";

import * as React from "react";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  currency: string;
  erpEnabled: boolean;
  erpPlanSlug: string;
  externalYeneqrId: string | null;
}

interface TenantContextValue {
  tenant: TenantInfo | null;
  tenants: TenantInfo[]; // all tenants the user can access
  setTenant: (tenantId: string) => void;
  isLoading: boolean;
}

const TenantContext = React.createContext<TenantContextValue | null>(null);

export function TenantProvider({
  children,
  initialTenant,
  initialTenants,
}: {
  children: React.ReactNode;
  initialTenant: TenantInfo | null;
  initialTenants: TenantInfo[];
}) {
  const [tenant, setTenantState] = React.useState<TenantInfo | null>(initialTenant);
  const [tenants, setTenants] = React.useState<TenantInfo[]>(initialTenants);
  const [isLoading, setIsLoading] = React.useState(false);

  const setTenant = React.useCallback(
    (tenantId: string) => {
      setIsLoading(true);
      // Persist selection in a cookie (1 year)
      document.cookie = `mini-erp-tenant-id=${tenantId}; path=/; max-age=${
        60 * 60 * 24 * 365
      }; samesite=lax`;
      const next = tenants.find((t) => t.id === tenantId) ?? null;
      setTenantState(next);
      // Reload to re-fetch server data with new tenant context
      window.location.reload();
    },
    [tenants],
  );

  const value = React.useMemo<TenantContextValue>(
    () => ({ tenant, tenants, setTenant, isLoading }),
    [tenant, tenants, setTenant, isLoading],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = React.useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within a <TenantProvider>.");
  }
  return ctx;
}
