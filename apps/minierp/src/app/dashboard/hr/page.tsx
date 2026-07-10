"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CalendarDays, Wallet, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SECTIONS: { title: string; description: string; href: string; icon: LucideIcon }[] = [
  { title: "Employees", description: "Employee directory — Ethiopian fields (TIN, pension, ID)", href: "/dashboard/hr/employees", icon: Users },
  { title: "Attendance", description: "Daily check-in/out, OT hours (day/rest/public holiday)", href: "/dashboard/hr/attendance", icon: CalendarDays },
  { title: "Payroll Runs", description: "Calculate → approve → post to GL (PIT + pension + OT)", href: "/dashboard/hr/payroll", icon: Wallet },
  { title: "Salary Components", description: "Configure earnings, deductions, allowances", href: "/dashboard/settings/salary-components", icon: FileText },
];

export default function HRPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">HR & Payroll</h1><p className="text-sm text-muted-foreground">Ethiopian-compliant — PIT brackets, 7%/11% pension, OT at 1.25/1.5/2.0×.</p></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map(s => (<Link key={s.href} href={s.href} className="block"><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10"><s.icon className="h-5 w-5 text-primary" /></div><div><p className="text-sm font-semibold">{s.title}</p><p className="mt-1 text-xs text-muted-foreground">{s.description}</p></div></div><p className="mt-4 text-xs font-medium text-primary">Open →</p></CardContent></Card></Link>))}
      </div>
      <Card><CardContent className="p-6"><h3 className="text-sm font-semibold">Ethiopian Compliance</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-3 text-xs">
          <div className="rounded-md border p-3"><p className="font-medium">PIT Brackets (Proc. 979/2016)</p><ul className="mt-2 space-y-1 text-muted-foreground"><li>0 – 600: exempt</li><li>601 – 1,650: 10%</li><li>1,651 – 3,200: 15%</li><li>3,201 – 5,250: 20%</li><li>5,251 – 7,800: 25%</li><li>7,801 – 10,900: 30%</li><li>10,901+: 35%</li></ul></div>
          <div className="rounded-md border p-3"><p className="font-medium">Pension (Proc. 715/2011)</p><ul className="mt-2 space-y-1 text-muted-foreground"><li>Employee: 7% of pensionable base</li><li>Employer: 11% of pensionable base</li><li>Base cap: ETB 2,800/month</li><li>Employee max: ETB 196</li><li>Employer max: ETB 308</li></ul></div>
          <div className="rounded-md border p-3"><p className="font-medium">Overtime (Proc. 1156/2019)</p><ul className="mt-2 space-y-1 text-muted-foreground"><li>Day OT (weekday): 1.25× hourly</li><li>Rest day OT: 1.50× hourly</li><li>Public holiday OT: 2.00× hourly</li><li>Hourly = monthly salary / 240</li><li>Transport allowance: tax-free up to ETB 600/mo</li></ul></div>
        </div>
      </CardContent></Card>
    </div>
  );
}
