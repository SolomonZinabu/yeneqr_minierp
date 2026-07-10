"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-sm text-muted-foreground">Manage your tenant configuration, roles, and audit trail.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/settings/roles" className="block"><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-6"><p className="text-sm font-semibold">Role & Permission Matrix</p><p className="mt-1 text-xs text-muted-foreground">View which permissions each role has.</p><p className="mt-4 text-xs font-medium text-primary">Open →</p></CardContent></Card></Link>
        <Link href="/dashboard/settings/audit-log" className="block"><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="p-6"><p className="text-sm font-semibold">Audit Log</p><p className="mt-1 text-xs text-muted-foreground">Append-only history of every change to tenant data.</p><p className="mt-4 text-xs font-medium text-primary">Open →</p></CardContent></Card></Link>
      </div>
    </div>
  );
}
