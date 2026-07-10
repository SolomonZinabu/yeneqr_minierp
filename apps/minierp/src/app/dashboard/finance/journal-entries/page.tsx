"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText } from "lucide-react";

interface JournalEntry { id: string; entryNumber: string; entryDate: string; source: string | null; sourceRefId: string | null; description: string | null; status: string; isReversed: boolean; totalDebit: number; totalCredit: number; lines: { accountCode: string; account: { code: string; name: string }; debit: number; credit: number }[] }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" });

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/finance/journal-entries?limit=100").then(r => r.json()).then(d => setEntries(d.entries ?? [])).catch(() => setEntries([])).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1><p className="text-sm text-muted-foreground">All GL entries — manual + auto-posted</p></div><Button asChild><Link href="/dashboard/finance/journal-entries/new"><Plus className="mr-2 h-4 w-4" /> New Entry</Link></Button></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : entries.length === 0 ? (
        <div className="py-12 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No journal entries yet</p><p className="mt-1 text-xs text-muted-foreground">Receive stock via a GRN to auto-post your first entry.</p></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Entry #</TableHead><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{entries.map(e => (
            <TableRow key={e.id}><TableCell className="font-mono text-xs font-medium">{e.entryNumber}</TableCell><TableCell className="text-xs">{fmtDate(e.entryDate)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{e.source ?? "manual"}</Badge></TableCell><TableCell className="text-sm">{e.description ?? "—"}</TableCell><TableCell className="text-right font-medium">{fmtETB(e.totalDebit)}</TableCell><TableCell className="text-right font-medium">{fmtETB(e.totalCredit)}</TableCell><TableCell><div className="flex gap-1"><Badge variant={e.status === "posted" ? "default" : "secondary"} className="text-xs">{e.status}</Badge>{e.isReversed && <Badge variant="destructive" className="text-xs">Reversed</Badge>}</div></TableCell></TableRow>
          ))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
