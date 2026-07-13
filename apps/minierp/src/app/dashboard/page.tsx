"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function DashboardPage() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time snapshot of inventory, finance, and HR across your branches.</p>
      </div>
      <div className="rounded-md border p-4 text-sm">
        <p className="font-medium">Welcome, {user?.user.name ?? user?.user.email ?? "User"}</p>
        <p className="mt-1 text-muted-foreground">Role: {user?.role} · {user?.permissions.length ?? 0} permissions</p>
        <p className="mt-1 text-muted-foreground">Tenant: {user?.tenant.name ?? "—"}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <a href="/dashboard/inventory" className="rounded-lg border p-6 hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold">Inventory</p>
          <p className="mt-1 text-xs text-muted-foreground">Items, POs, GRNs, stock</p>
        </a>
        <a href="/dashboard/finance" className="rounded-lg border p-6 hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold">Finance</p>
          <p className="mt-1 text-xs text-muted-foreground">GL, journals, reports</p>
        </a>
        <a href="/dashboard/hr" className="rounded-lg border p-6 hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold">HR</p>
          <p className="mt-1 text-xs text-muted-foreground">Employees, payroll</p>
        </a>
      </div>
    </div>
  );
}
