"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ArrowLeftRight } from "lucide-react";

interface Transfer { id: string; transferNumber: string; status: string; transferDate: string; fromOrgNode: { name: string; code: string }; toOrgNode: { name: string; code: string }; _count: { lines: number } }
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" });
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", in_transit: "outline", received: "default", cancelled: "destructive" };

export default function TransfersPage() {
  const [items, setItems] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/inventory/transfers").then(r => r.json()).then(d => setItems(d.transfers ?? [])).catch(() => setItems([])).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Transfers</h1><p className="text-sm text-muted-foreground">Branch-to-branch transfers with in-transit tracking</p></div><Button asChild><Link href="/dashboard/inventory/transfers/new"><Plus className="mr-2 h-4 w-4" /> New Transfer</Link></Button></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? (
        <div className="py-12 text-center"><ArrowLeftRight className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No transfers yet</p></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Transfer #</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Lines</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{items.map(i => (<TableRow key={i.id}><TableCell className="font-mono font-medium">{i.transferNumber}</TableCell><TableCell className="text-sm">{i.fromOrgNode?.name ?? "—"}</TableCell><TableCell className="text-sm">{i.toOrgNode?.name ?? "—"}</TableCell><TableCell className="text-xs">{fmtDate(i.transferDate)}</TableCell><TableCell className="text-right text-xs">{i._count?.lines ?? 0}</TableCell><TableCell><Badge variant={statusColors[i.status] ?? "outline"} className="text-xs">{i.status}</Badge></TableCell></TableRow>))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
