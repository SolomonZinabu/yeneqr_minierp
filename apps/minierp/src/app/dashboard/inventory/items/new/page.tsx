"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewItemPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", description: "", category: "", uom: "each", itemType: "ingredient", isStockable: true, reorderPoint: 0, reorderQty: 0, costPrice: 0, sellPrice: 0, taxRate: "", barcode: "" });
  const update = (k: string, v: string | boolean | number) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, description: form.description || null, category: form.category || null, taxRate: form.taxRate === "" ? null : parseFloat(form.taxRate), barcode: form.barcode || null }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? `HTTP ${res.status}`); }
      toast.success("Item created"); router.push("/dashboard/inventory/items"); router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">New Item</h1><p className="text-sm text-muted-foreground">Add a new inventory item to the catalog</p></div>
        <Button asChild variant="outline"><Link href="/dashboard/inventory/items"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
      </div>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle className="text-sm">Item Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label htmlFor="sku">SKU *</Label><Input id="sku" required value={form.sku} onChange={(e) => update("sku", e.target.value)} /></div>
            <div><Label htmlFor="name">Name *</Label><Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} /></div>
            <div className="md:col-span-2"><Label htmlFor="description">Description</Label><Input id="description" value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
            <div><Label htmlFor="category">Category</Label><Input id="category" placeholder="Meat, Produce, Beverage..." value={form.category} onChange={(e) => update("category", e.target.value)} /></div>
            <div><Label htmlFor="uom">Unit of Measure</Label><Input id="uom" value={form.uom} onChange={(e) => update("uom", e.target.value)} /></div>
            <div><Label htmlFor="itemType">Item Type</Label><select id="itemType" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.itemType} onChange={(e) => update("itemType", e.target.value)}><option value="ingredient">Ingredient (raw material)</option><option value="finished_good">Finished Good (menu item)</option><option value="packaging">Packaging</option><option value="consumable">Consumable</option></select></div>
            <div><Label htmlFor="barcode">Barcode</Label><Input id="barcode" value={form.barcode} onChange={(e) => update("barcode", e.target.value)} /></div>
            <div><Label htmlFor="costPrice">Cost Price (ETB)</Label><Input id="costPrice" type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => update("costPrice", parseFloat(e.target.value) || 0)} /></div>
            <div><Label htmlFor="sellPrice">Sell Price (ETB)</Label><Input id="sellPrice" type="number" step="0.01" min="0" value={form.sellPrice} onChange={(e) => update("sellPrice", parseFloat(e.target.value) || 0)} /></div>
            <div><Label htmlFor="taxRate">Tax Rate (override, leave blank for tenant default)</Label><Input id="taxRate" type="number" step="0.01" min="0" max="1" placeholder="0.15" value={form.taxRate} onChange={(e) => update("taxRate", e.target.value)} /></div>
            <div><Label htmlFor="reorderPoint">Reorder Point</Label><Input id="reorderPoint" type="number" step="0.01" min="0" value={form.reorderPoint} onChange={(e) => update("reorderPoint", parseFloat(e.target.value) || 0)} /></div>
            <div><Label htmlFor="reorderQty">Reorder Quantity</Label><Input id="reorderQty" type="number" step="0.01" min="0" value={form.reorderQty} onChange={(e) => update("reorderQty", parseFloat(e.target.value) || 0)} /></div>
            <div className="flex items-center gap-2 md:col-span-2"><input id="isStockable" type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={form.isStockable} onChange={(e) => update("isStockable", e.target.checked)} /><Label htmlFor="isStockable" className="text-sm font-normal">Stockable (track quantity in stock ledger)</Label></div>
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/inventory/items">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Item"}</Button></div>
      </form>
    </div>
  );
}
