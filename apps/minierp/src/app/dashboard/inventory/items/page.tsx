"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Package } from "lucide-react";

interface InventoryItem { id: string; sku: string; name: string; category: string | null; uom: string; itemType: string; isStockable: boolean; costPrice: number; sellPrice: number; reorderPoint: number; isActive: boolean }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(n);

export default function ItemsListPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await fetch(`/api/inventory/items?${params}`);
      if (res.ok) { const data = await res.json(); setItems(data.items ?? []); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Items</h1><p className="text-sm text-muted-foreground">Master catalog — ingredients, finished goods, packaging</p></div>
        <Button asChild><Link href="/dashboard/inventory/items/new"><Plus className="mr-2 h-4 w-4" /> New Item</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search by SKU, name, or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : items.length === 0 ? (
            <div className="py-12 text-center"><Package className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No items yet</p><Button asChild className="mt-4"><Link href="/dashboard/inventory/items/new"><Plus className="mr-2 h-4 w-4" /> New Item</Link></Button></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead>UoM</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Sell</TableHead><TableHead className="text-right">Reorder Pt</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell><Link href={`/dashboard/inventory/items/${item.id}`} className="font-medium hover:underline">{item.name}</Link></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.category ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{item.itemType}</Badge></TableCell>
                    <TableCell className="text-xs">{item.uom}</TableCell>
                    <TableCell className="text-right">{fmtETB(item.costPrice)}</TableCell>
                    <TableCell className="text-right">{fmtETB(item.sellPrice)}</TableCell>
                    <TableCell className="text-right text-xs">{item.reorderPoint}</TableCell>
                    <TableCell><Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">{item.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
