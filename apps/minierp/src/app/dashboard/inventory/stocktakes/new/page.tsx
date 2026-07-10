"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

interface OrgNode { id: string; name: string; code: string }
export default function NewStocktakePage() {
  const router = useRouter();
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [orgNodeId, setOrgNodeId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/org-nodes").then(r => r.json()).then(d => setOrgNodes(d.nodes ?? [])).catch(() => {}); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgNodeId) { toast.error("Select a branch"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/stocktakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgNodeId, notes: notes || null }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      const data = await res.json(); toast.success(`Stocktake ${data.stocktake.stocktakeNumber} created`); router.push("/dashboard/inventory/stocktakes");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">New Stocktake</h1><p className="text-sm text-muted-foreground">Snapshots current system quantities for manual count review</p></div><Button asChild variant="outline"><Link href="/dashboard/inventory/stocktakes"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <form onSubmit={handleSubmit}>
        <Card><CardHeader><CardTitle className="text-sm">Stocktake Details</CardTitle></CardHeader><CardContent className="grid gap-4">
          <div><Label htmlFor="orgNodeId">Branch *</Label><select required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)}><option value="">Select branch...</option>{orgNodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)}</select><p className="mt-1 text-xs text-muted-foreground">All stockable items at this branch will be included.</p></div>
          <div><Label htmlFor="notes">Notes</Label><Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </CardContent></Card>
        <div className="mt-4 flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/inventory/stocktakes">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Create Stocktake"}</Button></div>
      </form>
    </div>
  );
}
