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

interface OrgNode { id: string; name: string; code: string }
interface Item { id: string; sku: string; name: string; uom: string; costPrice: number }

export default function NewWastagePage() {
  const router = useRouter();
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [orgNodeId, setOrgNodeId] = useState("");
  const [wastageType, setWastageType] = useState("spoilage");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState([{ itemId: "", quantity: 1, uom: "each", unitCost: 0, reasonCode: "", notes: "" }]);

  useEffect(() => {
    Promise.all([fetch("/api/org-nodes").then(r => r.json()), fetch("/api/inventory/items?limit=500").then(r => r.json())])
      .then(([o, i]) => { setOrgNodes(o.nodes ?? []); setItems(i.items ?? []); }).catch(() => toast.error("Failed to load"));
  }, []);

  const updateLine = (idx: number, patch: Record<string, unknown>) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, { itemId: "", quantity: 1, uom: "each", unitCost: 0, reasonCode: "", notes: "" }]);
  const removeLine = (idx: number) => setLines(ls => ls.filter((_, i) => i !== idx));
  const onSelectItem = (idx: number, itemId: string) => { const item = items.find(i => i.id === itemId); if (item) updateLine(idx, { itemId, uom: item.uom, unitCost: item.costPrice }); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgNodeId) { toast.error("Select a branch"); return; }
    if (lines.some(l => !l.itemId || l.quantity <= 0)) { toast.error("Fill all lines"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/wastages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgNodeId, wastageType, notes: notes || null, lines: lines.map(l => ({ itemId: l.itemId, quantity: Number(l.quantity), uom: l.uom, unitCost: Number(l.unitCost), reasonCode: l.reasonCode || null, notes: l.notes || null })) }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json(); toast.success(`Wastage ${data.wastage.wastageNumber} created — finalize to post GL`); router.push("/dashboard/inventory/wastages");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">New Wastage</h1><p className="text-sm text-muted-foreground">Record stock loss — finalize to post GL entry</p></div><Button asChild variant="outline"><Link href="/dashboard/inventory/wastages"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card><CardHeader><CardTitle className="text-sm">Wastage Header</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
          <div><Label htmlFor="orgNodeId">Branch *</Label><select required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)}><option value="">Select branch...</option>{orgNodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)}</select></div>
          <div><Label htmlFor="wastageType">Type</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={wastageType} onChange={(e) => setWastageType(e.target.value)}><option value="spoilage">Spoilage</option><option value="breakage">Breakage</option><option value="expiry">Expiry</option><option value="theft">Theft</option><option value="sample">Sample</option><option value="other">Other</option></select></div>
          <div><Label htmlFor="notes">Notes</Label><Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Items Lost</CardTitle><Button type="button" onClick={addLine} variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Line</Button></CardHeader>
          <CardContent><div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4"><Label className="text-xs">Item</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={line.itemId} onChange={(e) => onSelectItem(idx, e.target.value)}><option value="">Select...</option>{items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select></div>
                <div className="col-span-2"><Label className="text-xs">Qty</Label><Input type="number" step="0.01" min="0" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-1"><Label className="text-xs">UoM</Label><Input value={line.uom} onChange={(e) => updateLine(idx, { uom: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Unit Cost</Label><Input type="number" step="0.01" min="0" value={line.unitCost} onChange={(e) => updateLine(idx, { unitCost: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-2"><Label className="text-xs">Reason</Label><Input placeholder="spoilage, theft..." value={line.reasonCode} onChange={(e) => updateLine(idx, { reasonCode: e.target.value })} /></div>
                <div className="col-span-1 flex items-end justify-end"><Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
              </div>
            ))}
          </div></CardContent>
        </Card>
        <div className="flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/inventory/wastages">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Create Wastage"}</Button></div>
      </form>
    </div>
  );
}
