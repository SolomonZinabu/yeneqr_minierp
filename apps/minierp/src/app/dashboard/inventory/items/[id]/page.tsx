"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

interface Item { id: string; sku: string; name: string; description: string | null; category: string | null; uom: string; itemType: string; isStockable: boolean; costPrice: number; sellPrice: number; taxRate: number | null; reorderPoint: number; reorderQty: number; barcode: string | null; isActive: boolean; movements: { id: string; movementType: string; quantity: number; balanceAfter: number | null; unitCost: number; createdAt: string; notes: string | null; orgNode: { name: string; code: string | null } }[] }
interface StockOnHand { orgNodeId: string; qtyOnHand: number; unitCost: number; totalValue: number }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleString("en-ET", { dateStyle: "short", timeStyle: "short" });

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [stock, setStock] = useState<StockOnHand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/inventory/items/${params.id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/inventory/stock-on-hand?itemId=${params.id}`).then(r => r.ok ? r.json() : { stock: [] }),
    ]).then(([itemData, stockData]) => {
      if (itemData?.item) setItem(itemData.item);
      setStock(stockData.stock ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  async function handleDelete() {
    if (!confirm("Deactivate this item?")) return;
    const res = await fetch(`/api/inventory/items/${params.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Item deactivated"); router.push("/dashboard/inventory/items"); }
    else toast.error("Failed to deactivate");
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await fetch(`/api/inventory/items/${params.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data, costPrice: parseFloat(data.costPrice as string) || 0, sellPrice: parseFloat(data.sellPrice as string) || 0,
          reorderPoint: parseFloat(data.reorderPoint as string) || 0, reorderQty: parseFloat(data.reorderQty as string) || 0,
          taxRate: data.taxRate === "" ? null : parseFloat(data.taxRate as string),
          description: data.description || null, category: data.category || null, barcode: data.barcode || null,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      toast.success("Item updated"); setEditing(false);
      const fresh = await fetch(`/api/inventory/items/${params.id}`).then(r => r.json());
      setItem(fresh.item);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>;
  if (!item) return <p className="py-8 text-center text-sm text-red-600">Item not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{item.name}</h1><Badge variant="outline">{item.sku}</Badge><Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.itemType} · {item.uom}</p></div>
        <div className="flex gap-2"><Button asChild variant="outline"><Link href="/dashboard/inventory/items"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>{!editing ? <Button onClick={() => setEditing(true)}>Edit</Button> : <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>}<Button variant="destructive" size="icon" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Total On Hand</p><p className="mt-2 text-2xl font-bold">{stock.reduce((s, r) => s + r.qtyOnHand, 0).toFixed(2)} {item.uom}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Stock Value</p><p className="mt-2 text-2xl font-bold">{fmtETB(stock.reduce((s, r) => s + r.totalValue, 0))}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm font-medium text-muted-foreground">Avg Unit Cost</p><p className="mt-2 text-2xl font-bold">{fmtETB(item.costPrice)}</p></CardContent></Card>
      </div>
      {editing ? (
        <form onSubmit={handleSave}>
          <Card><CardHeader><CardTitle className="text-sm">Edit Item</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={item.name} required /></div>
            <div><Label htmlFor="category">Category</Label><Input id="category" name="category" defaultValue={item.category ?? ""} /></div>
            <div className="md:col-span-2"><Label htmlFor="description">Description</Label><Input id="description" name="description" defaultValue={item.description ?? ""} /></div>
            <div><Label htmlFor="costPrice">Cost Price (ETB)</Label><Input id="costPrice" name="costPrice" type="number" step="0.01" defaultValue={item.costPrice} /></div>
            <div><Label htmlFor="sellPrice">Sell Price (ETB)</Label><Input id="sellPrice" name="sellPrice" type="number" step="0.01" defaultValue={item.sellPrice} /></div>
            <div><Label htmlFor="reorderPoint">Reorder Point</Label><Input id="reorderPoint" name="reorderPoint" type="number" step="0.01" defaultValue={item.reorderPoint} /></div>
            <div><Label htmlFor="reorderQty">Reorder Qty</Label><Input id="reorderQty" name="reorderQty" type="number" step="0.01" defaultValue={item.reorderQty} /></div>
            <div><Label htmlFor="taxRate">Tax Rate (blank = tenant default)</Label><Input id="taxRate" name="taxRate" type="number" step="0.01" min="0" max="1" defaultValue={item.taxRate ?? ""} /></div>
            <div><Label htmlFor="barcode">Barcode</Label><Input id="barcode" name="barcode" defaultValue={item.barcode ?? ""} /></div>
          </CardContent></Card>
          <div className="mt-4 flex justify-end"><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}</Button></div>
        </form>
      ) : (
        <Card><CardHeader><CardTitle className="text-sm">Recent Stock Movements</CardTitle></CardHeader><CardContent>
          {item.movements.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No movements yet.</p> : (
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Unit Cost</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>{item.movements.map(m => (
                <TableRow key={m.id}><TableCell className="text-xs">{fmtDate(m.createdAt)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{m.movementType}</Badge></TableCell><TableCell className="text-xs">{m.orgNode?.name ?? "—"}</TableCell><TableCell className={`text-right font-mono ${m.quantity > 0 ? "text-green-600" : "text-red-600"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity.toFixed(2)}</TableCell><TableCell className="text-right font-mono text-xs">{m.balanceAfter?.toFixed(2) ?? "—"}</TableCell><TableCell className="text-right">{fmtETB(m.unitCost)}</TableCell><TableCell className="text-xs text-muted-foreground">{m.notes ?? "—"}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}
