"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen } from "lucide-react";

interface Account { id: string; code: string; name: string; type: string; subtype: string | null; isSystem: boolean; isControl: boolean; parentCode: string | null; description: string | null; isActive: boolean }
const typeColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { asset: "default", liability: "secondary", equity: "outline", revenue: "default", expense: "destructive", contra: "outline" };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/finance/accounts").then(r => r.json()).then(d => setAccounts(d.accounts ?? [])).catch(() => setAccounts([])).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1><p className="text-sm text-muted-foreground">Ethiopian restaurant COA — seeded automatically on tenant provisioning</p></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : accounts.length === 0 ? (
        <div className="py-12 text-center"><BookOpen className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No accounts found</p><p className="mt-1 text-xs text-muted-foreground">Accounts are seeded when a tenant is provisioned.</p></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Subtype</TableHead><TableHead>Parent</TableHead><TableHead>Flags</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{accounts.map(a => (
            <TableRow key={a.id}><TableCell className="font-mono text-xs font-medium">{a.code}</TableCell><TableCell className="text-sm">{a.name}</TableCell><TableCell><Badge variant={typeColors[a.type] ?? "outline"} className="text-xs capitalize">{a.type}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{a.subtype ?? "—"}</TableCell><TableCell className="font-mono text-xs">{a.parentCode ?? "—"}</TableCell><TableCell><div className="flex gap-1">{a.isSystem && <Badge variant="outline" className="text-xs">System</Badge>}{a.isControl && <Badge variant="outline" className="text-xs">Control</Badge>}</div></TableCell><TableCell><Badge variant={a.isActive ? "default" : "secondary"} className="text-xs">{a.isActive ? "Active" : "Inactive"}</Badge></TableCell></TableRow>
          ))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
