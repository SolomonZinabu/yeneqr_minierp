"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ClipboardCheck } from "lucide-react";

interface Stocktake { id: string; stocktakeNumber: string; status: string; countDate: string; orgNode: { name: string; code: string }; _count: { lines: number } }
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" });
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", counting: "outline", reconciled: "default", posted: "default", cancelled: "destructive" };

export default function StocktakesPage() {
  const [items, setItems] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/inventory/stocktakes").then(r => r.json()).then(d => setItems(d.stocktakes ?? [])).catch(() => setItems([])).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Stocktakes</h1><p className="text-sm text-muted-foreground">Count sheet → variance review → auto-adjustment + GL posting</p></div><Button asChild><Link href="/dashboard/inventory/stocktakes/new"><Plus className="mr-2 h-4 w-4" /> New Stocktake</Link></Button></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? (
        <div className="py-12 text-center"><ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No stocktakes yet</p><Button asChild className="mt-4"><Link href="/dashboard/inventory/stocktakes/new"><Plus className="mr-2 h-4 w-4" /> Start Count</Link></Button></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Stocktake #</TableHead><TableHead>Branch</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Items</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{items.map(i => (<TableRow key={i.id}><TableCell className="font-mono font-medium">{i.stocktakeNumber}</TableCell><TableCell className="text-sm">{i.orgNode?.name ?? "—"}</TableCell><TableCell className="text-xs">{fmtDate(i.countDate)}</TableCell><TableCell className="text-right text-xs">{i._count?.lines ?? 0}</TableCell><TableCell><Badge variant={statusColors[i.status] ?? "outline"} className="text-xs">{i.status}</Badge></TableCell></TableRow>))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
