"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, LayoutDashboard, Package, Wallet, Users, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";

interface NavItem { label: string; href: string; icon: LucideIcon; requiresPermission?: string[] }

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inventory", href: "/dashboard/inventory", icon: Package, requiresPermission: ["inventory.items.read", "inventory.stock.read"] },
  { label: "Finance", href: "/dashboard/finance", icon: Wallet, requiresPermission: ["finance.accounts.read", "finance.journal.read", "finance.reports.read"] },
  { label: "HR & Payroll", href: "/dashboard/hr", icon: Users, requiresPermission: ["hr.employees.read", "hr.attendance.read", "hr.payroll.read"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, requiresPermission: ["settings.read"] },
];

const SETTINGS_SUBITEMS: { label: string; href: string; requiresPermission: string }[] = [
  { label: "Role Matrix", href: "/dashboard/settings/roles", requiresPermission: "settings.read" },
  { label: "Audit Log", href: "/dashboard/settings/audit-log", requiresPermission: "settings.audit_log.read" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, user } = useCurrentUser();
  const canSee = (item: NavItem) => !item.requiresPermission || item.requiresPermission.length === 0 || item.requiresPermission.some(p => hasPermission(p));
  const visibleItems = NAV_ITEMS.filter(canSee);
  const visibleSettingsSubs = SETTINGS_SUBITEMS.filter(s => hasPermission(s.requiresPermission));

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary"><ChefHat className="h-4 w-4 text-primary-foreground" /></div>
        <div>
          <p className="text-sm font-semibold leading-tight">Mini ERP</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Back-office</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          const isSettings = item.href === "/dashboard/settings";
          const showSubs = isSettings && visibleSettingsSubs.length > 0 && active;
          return (
            <div key={item.href}>
              <Link href={item.href} className={cn("group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-slate-100 hover:text-foreground")}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </Link>
              {showSubs && (
                <div className="ml-6 mt-1 space-y-1 border-l pl-3">
                  {visibleSettingsSubs.map(sub => (
                    <Link key={sub.href} href={sub.href} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors", pathname === sub.href ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground")}>
                      <ShieldCheck className="h-3 w-3" />{sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="rounded-md bg-slate-50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{user?.user.name ?? user?.user.email ?? "—"}</p>
          <p className="mt-0.5 capitalize">{user?.role ?? ""} · {user?.permissions.length ?? 0} perms</p>
        </div>
      </div>
    </aside>
  );
}
