"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Search } from "lucide-react";

interface StockItem { itemId: string; sku: string; name: string; category: string | null; uom: string; qtyOnHand: number; unitCost: number; totalValue: number; reorderPoint: number; isLow: boolean }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(n);

export default function StockOnHandPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (lowOnly) params.set("lowStock", "true");
    fetch(`/api/inventory/stock-on-hand?${params}`).then(r => r.ok ? r.json() : { items: [] }).then(d => setItems(d.items ?? [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, [lowOnly]);

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()));
  const totalValue = filtered.reduce((s, i) => s + i.totalValue, 0);
  const lowCount = filtered.filter(i => i.isLow).length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Stock on Hand</h1><p className="text-sm text-muted-foreground">Current inventory levels and valuation</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Total Stock Value</p><p className="mt-2 text-2xl font-bold">{fmtETB(totalValue)}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Items Tracked</p><p className="mt-2 text-2xl font-bold">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Low-Stock Alerts</p><p className={`mt-2 text-2xl font-bold ${lowCount > 0 ? "text-red-600" : "text-green-600"}`}>{lowCount}</p></CardContent></Card>
      </div>
      <Card><CardContent className="p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 flex-1"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></div><Button variant={lowOnly ? "default" : "outline"} size="sm" onClick={() => setLowOnly(!lowOnly)}>{lowOnly ? "Showing low-stock only" : "Show low-stock only"}</Button></div></CardContent></Card>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="py-12 text-center"><BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No items found</p><p className="mt-1 text-xs text-muted-foreground">Receive stock via a Goods Receipt to see it here.</p><Button asChild className="mt-4"><Link href="/dashboard/inventory/goods-receipts/new">Receive Stock</Link></Button></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Qty On Hand</TableHead><TableHead>UoM</TableHead><TableHead className="text-right">Unit Cost</TableHead><TableHead className="text-right">Total Value</TableHead><TableHead className="text-right">Reorder Pt</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.map(item => (
            <TableRow key={item.itemId}><TableCell className="font-mono text-xs"><Link href={`/dashboard/inventory/items/${item.itemId}`} className="hover:underline">{item.sku}</Link></TableCell><TableCell className="font-medium">{item.name}</TableCell><TableCell className="text-xs text-muted-foreground">{item.category ?? "—"}</TableCell><TableCell className={`text-right font-mono ${item.qtyOnHand < 0 ? "text-red-600" : ""}`}>{item.qtyOnHand.toFixed(2)}</TableCell><TableCell className="text-xs">{item.uom}</TableCell><TableCell className="text-right">{fmtETB(item.unitCost)}</TableCell><TableCell className="text-right font-medium">{fmtETB(item.totalValue)}</TableCell><TableCell className="text-right text-xs">{item.reorderPoint}</TableCell><TableCell>{item.isLow ? <Badge variant="destructive" className="text-xs">Low</Badge> : <Badge variant="outline" className="text-xs">OK</Badge>}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
