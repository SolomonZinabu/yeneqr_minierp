"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Wallet } from "lucide-react";

interface PayrollRun { id: string; runNumber: string; period: string; status: string; employeeCount: number; totalGross: number; totalTax: number; totalPension: number; totalNet: number; journalEntryId: string | null }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", calculated: "outline", approved: "default", paid: "default", reversed: "destructive" };

export default function PayrollRunsPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/hr/payroll/runs").then(r => r.json()).then(d => setRuns(d.runs ?? [])).catch(() => setRuns([])).finally(() => setLoading(false)); }, []);

  async function approve(id: string) {
    if (!confirm("Approve this payroll run and post to GL?")) return;
    const res = await fetch(`/api/hr/payroll/runs/${id}/approve`, { method: "POST" });
    if (res.ok) { const fresh = await fetch("/api/hr/payroll/runs").then(r => r.json()); setRuns(fresh.runs ?? []); }
    else { const err = await res.json(); alert(err.error ?? "Failed"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Payroll Runs</h1><p className="text-sm text-muted-foreground">Calculate → approve → posts to GL (PIT + pension + OT)</p></div><Button asChild><Link href="/dashboard/hr/payroll/new"><Plus className="mr-2 h-4 w-4" /> New Run</Link></Button></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : runs.length === 0 ? (
        <div className="py-12 text-center"><Wallet className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No payroll runs yet</p><Button asChild className="mt-4"><Link href="/dashboard/hr/payroll/new"><Plus className="mr-2 h-4 w-4" /> Run Payroll</Link></Button></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Run #</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Employees</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">PIT</TableHead><TableHead className="text-right">Pension</TableHead><TableHead className="text-right">Net</TableHead><TableHead>GL</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>{runs.map(r => (<TableRow key={r.id}><TableCell className="font-mono font-medium">{r.runNumber}</TableCell><TableCell className="text-sm">{r.period}</TableCell><TableCell className="text-right">{r.employeeCount}</TableCell><TableCell className="text-right">{fmtETB(r.totalGross)}</TableCell><TableCell className="text-right text-red-600">{fmtETB(r.totalTax)}</TableCell><TableCell className="text-right text-amber-600">{fmtETB(r.totalPension)}</TableCell><TableCell className="text-right font-medium">{fmtETB(r.totalNet)}</TableCell><TableCell>{r.journalEntryId ? <Badge className="text-xs">Posted</Badge> : <Badge variant="outline" className="text-xs">Pending</Badge>}</TableCell><TableCell><Badge variant={statusColors[r.status] ?? "outline"} className="text-xs">{r.status}</Badge></TableCell><TableCell>{r.status === "calculated" && <Button size="sm" variant="outline" onClick={() => approve(r.id)}>Approve & Post</Button>}</TableCell></TableRow>))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
