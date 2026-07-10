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

interface Account { id: string; code: string; name: string; type: string }
interface Line { accountCode: string; debit: number; credit: number; description: string }

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ accountCode: "", debit: 0, credit: 0, description: "" }, { accountCode: "", debit: 0, credit: 0, description: "" }]);

  useEffect(() => { fetch("/api/finance/accounts").then(r => r.json()).then(d => setAccounts(d.accounts ?? [])).catch(() => {}); }, []);

  const updateLine = (idx: number, patch: Partial<Line>) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, { accountCode: "", debit: 0, credit: 0, description: "" }]);
  const removeLine = (idx: number) => setLines(ls => ls.filter((_, i) => i !== idx));
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(n);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description) { toast.error("Description required"); return; }
    if (!balanced) { toast.error(`Not balanced — debit ${fmtETB(totalDebit)} ≠ credit ${fmtETB(totalCredit)}`); return; }
    if (lines.some(l => !l.accountCode)) { toast.error("All lines must have an account"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/journal-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, entryDate: entryDate || undefined, source: "manual", lines: lines.map(l => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || null })) }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Journal entry posted"); router.push("/dashboard/finance/journal-entries");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">New Journal Entry</h1><p className="text-sm text-muted-foreground">Manual double-entry — must balance (debits = credits)</p></div><Button asChild variant="outline"><Link href="/dashboard/finance/journal-entries"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card><CardHeader><CardTitle className="text-sm">Entry Header</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="description">Description *</Label><Input id="description" required value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label htmlFor="entryDate">Entry Date</Label><Input id="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
        </CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Lines</CardTitle><Button type="button" onClick={addLine} variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Line</Button></CardHeader>
          <CardContent><div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5"><Label className="text-xs">Account</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={line.accountCode} onChange={(e) => updateLine(idx, { accountCode: e.target.value })}><option value="">Select...</option>{accounts.map(a => <option key={a.id} value={a.code}>{a.code} — {a.name}</option>)}</select></div>
                <div className="col-span-3"><Label className="text-xs">Description</Label><Input value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Debit</Label><Input type="number" step="0.01" min="0" value={line.debit} onChange={(e) => updateLine(idx, { debit: parseFloat(e.target.value) || 0, credit: 0 })} /></div>
                <div className="col-span-2"><Label className="text-xs">Credit</Label><Input type="number" step="0.01" min="0" value={line.credit} onChange={(e) => updateLine(idx, { credit: parseFloat(e.target.value) || 0, debit: 0 })} /></div>
                {lines.length > 2 && <div className="col-span-12 flex justify-end -mt-1"><Button type="button" variant="ghost" size="sm" onClick={() => removeLine(idx)}><Trash2 className="mr-1 h-3 w-3 text-red-500" /> Remove</Button></div>}
              </div>
            ))}
          </div>
            <div className="mt-6 flex justify-end"><div className={`w-72 space-y-1 rounded-md border p-3 text-sm ${balanced ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}><div className="flex justify-between"><span className="text-muted-foreground">Total Debit:</span><span className="font-medium">{fmtETB(totalDebit)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Total Credit:</span><span className="font-medium">{fmtETB(totalCredit)}</span></div><div className="flex justify-between border-t pt-1 font-bold"><span>Diff:</span><span className={balanced ? "text-green-600" : "text-red-600"}>{fmtETB(totalDebit - totalCredit)}</span></div></div></div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/finance/journal-entries">Cancel</Link></Button><Button type="submit" disabled={saving || !balanced}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Post Entry"}</Button></div>
      </form>
    </div>
  );
}
