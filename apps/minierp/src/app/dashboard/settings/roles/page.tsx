"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";

interface PermissionData { permissions: string[]; permissionLabels: Record<string, string>; permissionGroups: { module: string; label: string; permissions: string[] }[]; roles: string[]; roleLabels: Record<string, string>; rolePermissions: Record<string, string[]> }

export default function RoleMatrixPage() {
  const [data, setData] = useState<PermissionData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/permissions").then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, []);

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>;
  if (!data) return <p className="py-8 text-center text-sm text-red-600">Failed to load permissions</p>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Role &amp; Permission Matrix</h1><p className="text-sm text-muted-foreground">Each role grants a set of permissions. Users get their role&apos;s permissions plus any extra permissions added directly to their profile.</p></div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {data.roles.map(role => (<Card key={role}><CardContent className="p-4"><p className="text-sm font-semibold">{data.roleLabels[role]}</p><p className="mt-1 text-xs text-muted-foreground capitalize">{role}</p><p className="mt-2 text-2xl font-bold">{data.rolePermissions[role]?.length ?? 0}</p><p className="text-xs text-muted-foreground">permissions</p></CardContent></Card>))}
      </div>
      <Card><CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left p-3 font-medium sticky left-0 bg-white">Permission</th>{data.roles.map(role => <th key={role} className="text-center p-3 font-medium min-w-[100px]"><div><div className="text-xs">{data.roleLabels[role]}</div><div className="text-[10px] font-normal text-muted-foreground capitalize">{role}</div></div></th>)}</tr></thead>
          <tbody>
            {data.permissionGroups.map(group => (
              <>
                <tr key={group.module} className="bg-slate-50"><td colSpan={data.roles.length + 1} className="p-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{group.label}</td></tr>
                {group.permissions.map(perm => (
                  <tr key={perm} className="border-b hover:bg-slate-50"><td className="p-3 sticky left-0 bg-white"><div className="font-mono text-xs text-muted-foreground">{perm}</div><div className="text-sm">{data.permissionLabels[perm] ?? perm}</div></td>{data.roles.map(role => { const has = data.rolePermissions[role]?.includes(perm); return <td key={role} className="text-center p-3">{has ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-slate-300 mx-auto" />}</td>; })}</tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
      <Card><CardContent className="p-4 text-xs text-muted-foreground"><p><strong>Note:</strong> This matrix is read-only in the current build. To customize a user&apos;s permissions beyond their role, add permission strings to <code className="rounded bg-slate-100 px-1 py-0.5">TenantUser.permissions</code> (a JSON array) via Prisma Studio or a future User Management UI.</p></CardContent></Card>
    </div>
  );
}
