"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

interface Wastage { id: string; wastageNumber: string; status: string; wastageType: string; wastageDate: string; totalValue: number; journalEntryId: string | null; orgNode: { name: string; code: string }; _count: { lines: number } }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" });
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", posted: "default", cancelled: "destructive" };

export default function WastagesPage() {
  const [items, setItems] = useState<Wastage[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/inventory/wastages").then(r => r.json()).then(d => setItems(d.wastages ?? [])).catch(() => setItems([])).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Wastage</h1><p className="text-sm text-muted-foreground">Spoilage, breakage, expiry, theft — posts to GL on finalize</p></div><Button asChild><Link href="/dashboard/inventory/wastages/new"><Plus className="mr-2 h-4 w-4" /> New Wastage</Link></Button></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? (
        <div className="py-12 text-center"><Trash2 className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No wastage records yet</p></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Wastage #</TableHead><TableHead>Branch</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Lines</TableHead><TableHead>GL</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{items.map(i => (<TableRow key={i.id}><TableCell className="font-mono font-medium">{i.wastageNumber}</TableCell><TableCell className="text-sm">{i.orgNode?.name ?? "—"}</TableCell><TableCell><Badge variant="outline" className="text-xs capitalize">{i.wastageType}</Badge></TableCell><TableCell className="text-xs">{fmtDate(i.wastageDate)}</TableCell><TableCell className="text-right font-medium text-red-600">{fmtETB(i.totalValue)}</TableCell><TableCell className="text-right text-xs">{i._count?.lines ?? 0}</TableCell><TableCell>{i.journalEntryId ? <Badge className="text-xs">Posted</Badge> : <Badge variant="outline" className="text-xs">Pending</Badge>}</TableCell><TableCell><Badge variant={statusColors[i.status] ?? "outline"} className="text-xs">{i.status}</Badge></TableCell></TableRow>))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
