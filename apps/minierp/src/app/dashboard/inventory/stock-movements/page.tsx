"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";

interface StockMovement { id: string; movementType: string; quantity: number; balanceAfter: number | null; unitCost: number; totalCost: number; refType: string | null; refId: string | null; notes: string | null; createdAt: string; item: { sku: string; name: string; uom: string }; orgNode: { name: string; code: string | null } }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleString("en-ET", { dateStyle: "short", timeStyle: "short" });
const typeColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { receive: "default", issue: "outline", transfer_in: "default", transfer_out: "outline", adjust: "secondary", wastage: "destructive", sale: "outline", return: "default", production: "outline" };

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/inventory/stock-movements?limit=200").then(r => r.json()).then(d => setMovements(d.movements ?? [])).catch(() => setMovements([])).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Stock Movements</h1><p className="text-sm text-muted-foreground">Append-only ledger — every receive, issue, transfer, adjustment</p></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : movements.length === 0 ? (
        <div className="py-12 text-center"><History className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No movements yet</p><p className="mt-1 text-xs text-muted-foreground">Stock movements appear here as you receive, sell, or adjust inventory.</p></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Unit Cost</TableHead><TableHead>Ref</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
          <TableBody>{movements.map(m => (
            <TableRow key={m.id}><TableCell className="text-xs">{fmtDate(m.createdAt)}</TableCell><TableCell><Badge variant={typeColors[m.movementType] ?? "outline"} className="text-xs">{m.movementType}</Badge></TableCell><TableCell><div className="font-medium text-sm">{m.item.name}</div><div className="font-mono text-xs text-muted-foreground">{m.item.sku}</div></TableCell><TableCell className="text-xs">{m.orgNode?.name ?? "—"}</TableCell><TableCell className={`text-right font-mono ${m.quantity > 0 ? "text-green-600" : "text-red-600"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity.toFixed(2)}</TableCell><TableCell className="text-right font-mono text-xs">{m.balanceAfter?.toFixed(2) ?? "—"}</TableCell><TableCell className="text-right">{fmtETB(m.unitCost)}</TableCell><TableCell className="text-xs font-mono">{m.refType ? `${m.refType}` : "—"}</TableCell><TableCell className="text-xs text-muted-foreground max-w-xs truncate">{m.notes ?? "—"}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
