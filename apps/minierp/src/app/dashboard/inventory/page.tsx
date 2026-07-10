"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Users, ShoppingCart, FileText, ClipboardCheck, ArrowLeftRight, Trash2, BarChart3, History } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SECTIONS: { title: string; description: string; href: string; icon: LucideIcon }[] = [
  { title: "Items", description: "Master catalog — ingredients, finished goods, packaging", href: "/dashboard/inventory/items", icon: Package },
  { title: "Suppliers", description: "Vendor directory with payment terms, lead times", href: "/dashboard/inventory/suppliers", icon: Users },
  { title: "Purchase Orders", description: "Draft → submit → approve → send → receive", href: "/dashboard/inventory/purchase-orders", icon: ShoppingCart },
  { title: "Goods Receipts", description: "Receive stock, update weighted-avg cost, post to GL", href: "/dashboard/inventory/goods-receipts", icon: FileText },
  { title: "Stock on Hand", description: "Current levels, low-stock alerts, valuation", href: "/dashboard/inventory/stock-on-hand", icon: BarChart3 },
  { title: "Stock Movements", description: "Append-only ledger — every receive/issue/adjust", href: "/dashboard/inventory/stock-movements", icon: History },
  { title: "Stocktakes", description: "Count sheet → variance → auto-adjustment + GL", href: "/dashboard/inventory/stocktakes", icon: ClipboardCheck },
  { title: "Transfers", description: "Branch-to-branch transfers with in-transit tracking", href: "/dashboard/inventory/transfers", icon: ArrowLeftRight },
  { title: "Wastage", description: "Spoilage, breakage, expiry, theft — posts to GL", href: "/dashboard/inventory/wastages", icon: Trash2 },
];

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Inventory & SCM</h1><p className="text-sm text-muted-foreground">Stock ledger, suppliers, purchase orders, goods receipts, costing, wastage, transfers, stocktakes.</p></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10"><s.icon className="h-5 w-5 text-primary" /></div>
                <div><p className="text-sm font-semibold">{s.title}</p><p className="mt-1 text-xs text-muted-foreground">{s.description}</p></div>
              </div>
              <p className="mt-4 text-xs font-medium text-primary">Open →</p>
            </CardContent></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
