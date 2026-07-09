"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  LayoutDashboard,
  Package,
  Wallet,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  phase: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, phase: "" },
  { label: "Inventory", href: "/dashboard/inventory", icon: Package, phase: "Phase 1" },
  { label: "Finance", href: "/dashboard/finance", icon: Wallet, phase: "Phase 2" },
  { label: "HR & Payroll", href: "/dashboard/hr", icon: Users, phase: "Phase 3" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, phase: "" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <ChefHat className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Mini ERP</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Back-office
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.phase && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-700">
                  {item.phase}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Mini ERP v0.1</p>
          <p className="mt-1">Phase 0 — Foundation</p>
        </div>
      </div>
    </aside>
  );
}
