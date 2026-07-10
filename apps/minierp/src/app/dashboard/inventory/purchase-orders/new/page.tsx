"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

interface Supplier { id: string; name: string; code: string }
interface OrgNode { id: string; name: string; code: string }
interface Item { id: string; sku: string; name: string; uom: string; costPrice: number }
interface Line { itemId: string; quantity: number; uom: string; unitCost: number; taxRate: number; notes: string }

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [orgNodeId, setOrgNodeId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ itemId: "", quantity: 1, uom: "each", unitCost: 0, taxRate: 0, notes: "" }]);

  useEffect(() => {
    Promise.all([
      fetch("/api/inventory/suppliers").then(r => r.json()),
      fetch("/api/org-nodes").then(r => r.json()),
      fetch("/api/inventory/items?limit=500").then(r => r.json()),
    ]).then(([s, o, i]) => { setSuppliers(s.suppliers ?? []); setOrgNodes(o.nodes ?? []); setItems(i.items ?? []); }).catch(() => toast.error("Failed to load form data"));
  }, []);

  const updateLine = (idx: number, patch: Partial<Line>) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, { itemId: "", quantity: 1, uom: "each", unitCost: 0, taxRate: 0, notes: "" }]);
  const removeLine = (idx: number) => setLines(ls => ls.filter((_, i) => i !== idx));
  const onSelectItem = (idx: number, itemId: string) => { const item = items.find(i => i.id === itemId); if (item) updateLine(idx, { itemId, uom: item.uom, unitCost: item.costPrice }); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) { toast.error("Select a supplier"); return; }
    if (lines.some(l => !l.itemId || l.quantity <= 0)) { toast.error("Fill in all line items"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/purchase-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, orgNodeId: orgNodeId || null, expectedDate: expectedDate || null, notes: notes || null, lines: lines.map(l => ({ ...l, notes: l.notes || null })) }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      const data = await res.json(); toast.success(`PO ${data.purchaseOrder.poNumber} created`);
      router.push(`/dashboard/inventory/purchase-orders/${data.purchaseOrder.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const taxTotal = lines.reduce((s, l) => s + l.quantity * l.unitCost * l.taxRate, 0);
  const total = subtotal + taxTotal;
  const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">New Purchase Order</h1><p className="text-sm text-muted-foreground">Create a draft PO — submit and approve after review</p></div><Button asChild variant="outline"><Link href="/dashboard/inventory/purchase-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card><CardHeader><CardTitle className="text-sm">PO Header</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
          <div><Label htmlFor="supplierId">Supplier *</Label><select id="supplierId" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Select supplier...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></div>
          <div><Label htmlFor="orgNodeId">Branch (optional)</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)}><option value="">Tenant-wide</option>{orgNodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)}</select></div>
          <div><Label htmlFor="expectedDate">Expected Date</Label><Input id="expectedDate" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></div>
          <div className="md:col-span-3"><Label htmlFor="notes">Notes</Label><Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Line Items</CardTitle><Button type="button" onClick={addLine} variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Line</Button></CardHeader>
          <CardContent><div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4"><Label className="text-xs">Item</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={line.itemId} onChange={(e) => onSelectItem(idx, e.target.value)}><option value="">Select item...</option>{items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select></div>
                <div className="col-span-2"><Label className="text-xs">Qty</Label><Input type="number" step="0.01" min="0" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-1"><Label className="text-xs">UoM</Label><Input value={line.uom} onChange={(e) => updateLine(idx, { uom: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Unit Cost</Label><Input type="number" step="0.01" min="0" value={line.unitCost} onChange={(e) => updateLine(idx, { unitCost: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-1"><Label className="text-xs">Tax%</Label><Input type="number" step="0.01" min="0" max="1" value={line.taxRate} onChange={(e) => updateLine(idx, { taxRate: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-2 flex items-end gap-1"><div className="flex-1 text-right text-sm font-medium">{fmtETB(line.quantity * line.unitCost * (1 + line.taxRate))}</div><Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
              </div>
            ))}
          </div>
            <div className="mt-6 flex justify-end"><div className="w-64 space-y-1 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{fmtETB(subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{fmtETB(taxTotal)}</span></div><div className="flex justify-between border-t pt-1 font-bold"><span>Total:</span><span>{fmtETB(total)}</span></div></div></div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/inventory/purchase-orders">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Create Draft PO"}</Button></div>
      </form>
    </div>
  );
}
