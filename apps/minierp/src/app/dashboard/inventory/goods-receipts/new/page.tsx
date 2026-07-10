"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

interface Supplier { id: string; name: string }
interface OrgNode { id: string; name: string; code: string }
interface Item { id: string; sku: string; name: string; uom: string; costPrice: number }

export default function NewGoodsReceiptPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>}>
      <NewGoodsReceiptContent />
    </Suspense>
  );
}

function NewGoodsReceiptContent() {
  const router = useRouter();
  const params = useSearchParams();
  const poId = params.get("poId");
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [orgNodeId, setOrgNodeId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [autoPost, setAutoPost] = useState(true);
  const [lines, setLines] = useState<{ itemId: string; quantityReceived: number; uom: string; unitCost: number; taxRate: number; batchNo: string; expiryDate: string }[]>([{ itemId: "", quantityReceived: 1, uom: "each", unitCost: 0, taxRate: 0, batchNo: "", expiryDate: "" }]);

  useEffect(() => {
    Promise.all([fetch("/api/inventory/suppliers").then(r => r.json()), fetch("/api/org-nodes").then(r => r.json()), fetch("/api/inventory/items?limit=500").then(r => r.json())])
      .then(([s, o, i]) => { setSuppliers(s.suppliers ?? []); setOrgNodes(o.nodes ?? []); setItems(i.items ?? []); }).catch(() => toast.error("Failed to load form data"));
    if (poId) {
      fetch(`/api/inventory/purchase-orders/${poId}`).then(r => r.json()).then(d => {
        const po = d.purchaseOrder;
        if (po) { setSupplierId(po.supplierId ?? ""); setOrgNodeId(po.orgNodeId ?? "");
          setLines((po.lines ?? []).map((l: { itemId: string; quantity: number; receivedQty: number; uom: string; unitCost: number; taxRate: number }) => ({ itemId: l.itemId, quantityReceived: Math.max(0, l.quantity - l.receivedQty), uom: l.uom, unitCost: l.unitCost, taxRate: l.taxRate, batchNo: "", expiryDate: "" })));
        }
      }).catch(() => toast.error("Failed to load PO"));
    }
  }, [poId]);

  const updateLine = (idx: number, patch: Record<string, unknown>) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, { itemId: "", quantityReceived: 1, uom: "each", unitCost: 0, taxRate: 0, batchNo: "", expiryDate: "" }]);
  const removeLine = (idx: number) => setLines(ls => ls.filter((_, i) => i !== idx));
  const onSelectItem = (idx: number, itemId: string) => { const item = items.find(i => i.id === itemId); if (item) updateLine(idx, { itemId, uom: item.uom, unitCost: item.costPrice }); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgNodeId) { toast.error("Select a branch"); return; }
    if (lines.some(l => !l.itemId || l.quantityReceived <= 0)) { toast.error("Fill in all lines"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/goods-receipts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgNodeId, supplierId: supplierId || null, purchaseOrderId: poId || null, invoiceNumber: invoiceNumber || null, notes: notes || null, autoPost, lines: lines.map(l => ({ itemId: l.itemId, quantityReceived: Number(l.quantityReceived), uom: l.uom, unitCost: Number(l.unitCost), taxRate: Number(l.taxRate), batchNo: l.batchNo || null, expiryDate: l.expiryDate || null })) }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      const data = await res.json(); toast.success(`GRN ${data.goodsReceipt.grnNumber} created${data.journalEntryId ? " — GL posted" : ""}`);
      router.push(`/dashboard/inventory/goods-receipts/${data.goodsReceipt.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  const subtotal = lines.reduce((s, l) => s + l.quantityReceived * l.unitCost, 0);
  const taxTotal = lines.reduce((s, l) => s + l.quantityReceived * l.unitCost * l.taxRate, 0);
  const total = subtotal + taxTotal;
  const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">New Goods Receipt</h1><p className="text-sm text-muted-foreground">Receive stock — updates inventory and weighted-avg cost</p>{poId && <p className="mt-1 text-xs text-blue-600">Receiving against PO: {poId}</p>}</div><Button asChild variant="outline"><Link href="/dashboard/inventory/goods-receipts"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card><CardHeader><CardTitle className="text-sm">GRN Header</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
          <div><Label htmlFor="orgNodeId">Branch *</Label><select required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)}><option value="">Select branch...</option>{orgNodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)}</select></div>
          <div><Label htmlFor="supplierId">Supplier</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Select supplier...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><Label htmlFor="invoiceNumber">Invoice #</Label><Input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
          <div className="md:col-span-3"><Label htmlFor="notes">Notes</Label><Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="md:col-span-3 flex items-center gap-2"><Checkbox id="autoPost" checked={autoPost} onCheckedChange={(v) => setAutoPost(v === true)} /><Label htmlFor="autoPost" className="text-sm font-normal">Auto-post to GL (Dr Inventory / Dr VAT Receivable / Cr Accounts Payable)</Label></div>
        </CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Items Received</CardTitle><Button type="button" onClick={addLine} variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Line</Button></CardHeader>
          <CardContent><div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><Label className="text-xs">Item</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={line.itemId} onChange={(e) => onSelectItem(idx, e.target.value)}><option value="">Select item...</option>{items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select></div>
                <div className="col-span-2"><Label className="text-xs">Qty Received</Label><Input type="number" step="0.01" min="0" value={line.quantityReceived} onChange={(e) => updateLine(idx, { quantityReceived: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-1"><Label className="text-xs">UoM</Label><Input value={line.uom} onChange={(e) => updateLine(idx, { uom: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Unit Cost</Label><Input type="number" step="0.01" min="0" value={line.unitCost} onChange={(e) => updateLine(idx, { unitCost: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-1"><Label className="text-xs">Tax%</Label><Input type="number" step="0.01" min="0" max="1" value={line.taxRate} onChange={(e) => updateLine(idx, { taxRate: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-2"><Label className="text-xs">Batch #</Label><Input value={line.batchNo} onChange={(e) => updateLine(idx, { batchNo: e.target.value })} /></div>
                <div className="col-span-1 flex items-end justify-end"><Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
              </div>
            ))}
          </div>
            <div className="mt-6 flex justify-end"><div className="w-64 space-y-1 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{fmtETB(subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{fmtETB(taxTotal)}</span></div><div className="flex justify-between border-t pt-1 font-bold"><span>Total:</span><span>{fmtETB(total)}</span></div></div></div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/inventory/goods-receipts">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Receive Stock"}</Button></div>
      </form>
    </div>
  );
}
