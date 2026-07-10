"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Wallet, Users, TrendingUp, AlertTriangle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);

export default function DashboardPage() {
  const [stats, setStats] = useState<{ inventoryValue: number; lowStockCount: number } | null>(null);
  const [lowStock, setLowStock] = useState<{ itemId: string; sku: string; name: string; qtyOnHand: number; reorderPoint: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/inventory/stock-on-hand").then(r => r.ok ? r.json() : { items: [] }),
      fetch("/api/inventory/stock-on-hand?lowStock=true").then(r => r.ok ? r.json() : { items: [] }),
    ]).then(([statsData, lowData]) => {
      const inventoryValue = (statsData.items ?? []).reduce((s: number, i: { totalValue: number }) => s + i.totalValue, 0);
      setStats({ inventoryValue, lowStockCount: (lowData.items ?? []).length });
      setLowStock(lowData.items ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div><h1 className="text-2xl font-bold">Overview</h1><p className="py-8 text-center text-sm text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Overview</h1><p className="text-sm text-muted-foreground">Real-time snapshot of inventory, finance, and HR across your branches.</p></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Inventory Value" value={fmtETB(stats?.inventoryValue ?? 0)} icon={Package} href="/dashboard/inventory" subtitle="Current stock at cost" />
        <KpiCard title="Low-Stock Items" value={String(stats?.lowStockCount ?? 0)} icon={AlertTriangle} href="/dashboard/inventory/stock-on-hand" subtitle={stats?.lowStockCount ? "Action required" : "All healthy"} tone={stats?.lowStockCount ? "warning" : "ok"} />
        <KpiCard title="Month Revenue" value={fmtETB(0)} icon={TrendingUp} href="/dashboard/finance/reports" subtitle="Net of VAT" />
        <KpiCard title="Active Employees" value="—" icon={Users} href="/dashboard/hr/employees" subtitle="On payroll" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div><CardTitle className="text-base">Low-Stock Alerts</CardTitle><CardDescription className="text-xs">Items at or below reorder point</CardDescription></div>
            <Button asChild variant="outline" size="sm"><Link href="/dashboard/inventory/stock-on-hand">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">All items above reorder point.</p> : (
              <div className="space-y-2">
                {lowStock.slice(0, 5).map((item) => (
                  <div key={item.itemId} className="flex items-center justify-between rounded-md border p-2">
                    <div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></div>
                    <div className="text-right"><p className="text-sm font-semibold text-red-600">{item.qtyOnHand} {item.reorderPoint ? `/ ${item.reorderPoint}` : ""}</p></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Quick Links</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <PhaseCard title="Inventory" description="Items, POs, GRNs, stock" icon={Package} href="/dashboard/inventory" />
            <PhaseCard title="Finance" description="GL, journals, reports" icon={Wallet} href="/dashboard/finance" />
            <PhaseCard title="HR" description="Employees, payroll" icon={Users} href="/dashboard/hr" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, href, subtitle, tone = "default" }: { title: string; value: string; icon: LucideIcon; href: string; subtitle?: string; tone?: "default" | "warning" | "ok" }) {
  const toneClass = tone === "warning" ? "text-red-600" : tone === "ok" ? "text-green-600" : "text-foreground";
  return (
    <Card><CardContent className="p-6">
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">{title}</p><Icon className="h-4 w-4 text-muted-foreground" /></div>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      <Button asChild variant="ghost" size="sm" className="mt-3 h-7 px-2 text-xs"><Link href={href}>View details →</Link></Button>
    </CardContent></Card>
  );
}

function PhaseCard({ title, description, icon: Icon, href }: { title: string; description: string; icon: LucideIcon; href: string }) {
  return (
    <Link href={href} className="block"><Card className="transition-shadow hover:shadow-md"><CardContent className="p-4">
      <div className="flex items-start gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></div>
    </CardContent></Card></Link>
  );
}
