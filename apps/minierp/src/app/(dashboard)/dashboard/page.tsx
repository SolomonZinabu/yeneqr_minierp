"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Package,
  Wallet,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";

interface PhaseCard {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  phase: string;
  status: "ready" | "phase-1" | "phase-2" | "phase-3";
}

const PHASES: PhaseCard[] = [
  {
    title: "Inventory & SCM",
    description:
      "Stock ledger, suppliers, purchase orders, goods receipts, costing, wastage, transfers, stocktake.",
    icon: Package,
    href: "/dashboard/inventory",
    phase: "Phase 1",
    status: "phase-1",
  },
  {
    title: "Finance & GL",
    description:
      "Chart of accounts, journal entries, auto-posting engine, P&L, balance sheet, bank reconciliation.",
    icon: Wallet,
    href: "/dashboard/finance",
    phase: "Phase 2",
    status: "phase-2",
  },
  {
    title: "HR & Payroll",
    description:
      "Employees, attendance, Ethiopian-compliant payroll (PIT, pension, OT), loans, leave.",
    icon: Users,
    href: "/dashboard/hr",
    phase: "Phase 3",
    status: "phase-3",
  },
];

export default function DashboardPage() {
  const { user } = useCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Mini ERP is in Phase 0 (foundation). Business modules ship in Phases 1–3.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PHASES.map((p) => (
          <Link key={p.href} href={p.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <CardDescription className="line-clamp-3 text-xs">
                    {p.description}
                  </CardDescription>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <p.icon className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                  {p.phase}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Phase 0 — Foundation</CardTitle>
          <CardDescription>
            What&apos;s ready now, and what comes next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            <p>
              <strong>Multi-tenant auth</strong> — Better-Auth with organization
              plugin, session cookies scoped to cross-subdomain SSO with YeneQR.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            <p>
              <strong>Postgres + Prisma</strong> with <code>$extends</code> middleware
              that auto-injects <code>tenantId</code> on every query — no
              cross-tenant leaks possible.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            <p>
              <strong>YeneQR webhook ingestion</strong> — events received at{" "}
              <code>/api/integrations/yeneqr/webhook</code> and stored for async
              processing. YeneQR&apos;s dormant <code>dispatchPOSWebhook</code> is
              now activated on order creation, status change, payment, and refund.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <p>
              <strong>Phase 1 (next)</strong> — StockMovement ledger, Suppliers,
              PurchaseOrders, GoodsReceipts, ItemCostSnapshot, Stocktake,
              StockTransfer, Wastage. ETA ~2 weeks.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
