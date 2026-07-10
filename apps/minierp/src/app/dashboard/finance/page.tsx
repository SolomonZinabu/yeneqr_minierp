"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, FileText, BarChart3, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SECTIONS: { title: string; description: string; href: string; icon: LucideIcon }[] = [
  { title: "Chart of Accounts", description: "Ethiopian restaurant COA — seeded on provisioning, extendable", href: "/dashboard/finance/accounts", icon: BookOpen },
  { title: "Journal Entries", description: "Manual entries + auto-posted entries from GRN/sale/wastage/payroll", href: "/dashboard/finance/journal-entries", icon: FileText },
  { title: "Reports", description: "Trial balance, P&L statement, balance sheet", href: "/dashboard/finance/reports", icon: BarChart3 },
];

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Finance & GL</h1><p className="text-sm text-muted-foreground">Chart of accounts, double-entry journals, auto-posting engine, financial reports.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="block"><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10"><s.icon className="h-5 w-5 text-primary" /></div><div><p className="text-sm font-semibold">{s.title}</p><p className="mt-1 text-xs text-muted-foreground">{s.description}</p></div></div><p className="mt-4 text-xs font-medium text-primary">Open →</p></CardContent></Card></Link>
        ))}
      </div>
      <Card><CardContent className="p-6"><div className="flex items-start gap-3"><Wallet className="h-5 w-5 text-muted-foreground" /><div className="text-sm"><p className="font-medium">Auto-posting engine</p><p className="mt-1 text-muted-foreground">Every business event posts a balanced journal entry automatically:</p><ul className="mt-2 space-y-1 text-xs text-muted-foreground"><li>• <strong>Goods Receipt</strong> → Dr Inventory + Dr VAT Receivable / Cr Accounts Payable</li><li>• <strong>Sale (YeneQR)</strong> → Dr Cash/Bank / Cr Revenue + Cr VAT Payable</li><li>• <strong>Wastage</strong> → Dr Wastage Expense / Cr Inventory</li><li>• <strong>Stocktake Variance</strong> → Dr/Cr Inventory / Cr/Dr Variance Income or Expense</li><li>• <strong>Payroll</strong> → Dr Salary Expense (by dept) + Dr Pension Expense (employer) / Cr PIT Payable + Cr Pension Payable + Cr Salary Payable</li></ul></div></div></CardContent></Card>
    </div>
  );
}
