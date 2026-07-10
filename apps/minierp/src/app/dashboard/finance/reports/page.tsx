"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3 } from "lucide-react";

interface TrialBalanceRow { accountCode: string; accountName: string; accountType: string; debitBalance: number; creditBalance: number }
interface PnLData { revenue: { code: string; name: string; amount: number }[]; cogs: { code: string; name: string; amount: number }[]; grossProfit: number; operatingExpenses: { code: string; name: string; amount: number }[]; payrollExpenses: { code: string; name: string; amount: number }[]; netProfit: number; totalRevenue: number; totalCogs: number; totalOperating: number; totalPayroll: number }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);

export default function ReportsPage() {
  const [tab, setTab] = useState<"trial" | "pnl">("trial");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [tb, setTb] = useState<TrialBalanceRow[]>([]);
  const [pnl, setPnl] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadTB() { setLoading(true); try { const res = await fetch(`/api/finance/reports/trial-balance?asOf=${asOf}`); if (!res.ok) throw new Error(); const data = await res.json(); setTb(data.accounts ?? []); } catch { setTb([]); } finally { setLoading(false); } }
  async function loadPnL() { setLoading(true); try { const res = await fetch(`/api/finance/reports/profit-and-loss?from=${from}&to=${to}`); if (!res.ok) throw new Error(); const data = await res.json(); setPnl(data); } catch { setPnl(null); } finally { setLoading(false); } }
  useEffect(() => { if (tab === "trial") loadTB(); else loadPnL(); }, [tab]);

  const tbTotalDebit = tb.reduce((s, r) => s + r.debitBalance, 0);
  const tbTotalCredit = tb.reduce((s, r) => s + r.creditBalance, 0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1><p className="text-sm text-muted-foreground">Trial balance, P&L statement, balance sheet</p></div>
      <div className="flex gap-2 border-b"><Button variant={tab === "trial" ? "default" : "ghost"} size="sm" onClick={() => setTab("trial")}>Trial Balance</Button><Button variant={tab === "pnl" ? "default" : "ghost"} size="sm" onClick={() => setTab("pnl")}>Profit & Loss</Button></div>
      {tab === "trial" && (
        <Card><CardHeader><div className="flex items-center gap-2"><Label htmlFor="asOf" className="text-sm">As of:</Label><Input id="asOf" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-40" /><Button size="sm" onClick={loadTB} disabled={loading}>Refresh</Button></div></CardHeader>
          <CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : tb.length === 0 ? (
            <div className="py-12 text-center"><BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No posted journal entries yet</p></div>
          ) : (
            <><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
              <TableBody>{tb.map(r => (<TableRow key={r.accountCode}><TableCell className="font-mono text-xs">{r.accountCode}</TableCell><TableCell className="text-sm">{r.accountName}</TableCell><TableCell className="text-xs capitalize">{r.accountType}</TableCell><TableCell className="text-right">{r.debitBalance > 0 ? fmtETB(r.debitBalance) : "—"}</TableCell><TableCell className="text-right">{r.creditBalance > 0 ? fmtETB(r.creditBalance) : "—"}</TableCell></TableRow>))}</TableBody>
            </Table>
              <div className="mt-4 flex justify-end"><div className="w-72 space-y-1 rounded-md border p-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Total Debit:</span><span className="font-bold">{fmtETB(tbTotalDebit)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Total Credit:</span><span className="font-bold">{fmtETB(tbTotalCredit)}</span></div><div className="flex justify-between border-t pt-1 font-bold"><span>Balance:</span><span className={Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? "text-green-600" : "text-red-600"}>{fmtETB(tbTotalDebit - tbTotalCredit)}</span></div></div></div>
            </>
          )}</CardContent>
        </Card>
      )}
      {tab === "pnl" && (
        <Card><CardHeader><div className="flex items-center gap-2"><Label htmlFor="from" className="text-sm">From:</Label><Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /><Label htmlFor="to" className="text-sm">To:</Label><Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /><Button size="sm" onClick={loadPnL} disabled={loading}>Refresh</Button></div></CardHeader>
          <CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : !pnl ? (
            <div className="py-12 text-center"><BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No data for selected period</p></div>
          ) : (
            <div className="space-y-6">
              <Section title="Revenue" rows={pnl.revenue} total={pnl.totalRevenue} fmt={fmtETB} />
              <Section title="Cost of Goods Sold" rows={pnl.cogs} total={pnl.totalCogs} fmt={fmtETB} />
              <div className="rounded-md border-l-4 border-green-500 bg-green-50 p-3"><div className="flex justify-between text-sm font-bold"><span>Gross Profit</span><span>{fmtETB(pnl.grossProfit)}</span></div></div>
              <Section title="Operating Expenses" rows={pnl.operatingExpenses} total={pnl.totalOperating} fmt={fmtETB} />
              <Section title="Payroll Expenses" rows={pnl.payrollExpenses} total={pnl.totalPayroll} fmt={fmtETB} />
              <div className={`rounded-md border-l-4 p-3 ${pnl.netProfit >= 0 ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}><div className={`flex justify-between text-base font-bold ${pnl.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}><span>Net Profit</span><span>{fmtETB(pnl.netProfit)}</span></div></div>
            </div>
          )}</CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({ title, rows, total, fmt }: { title: string; rows: { code: string; name: string; amount: number }[]; total: number; fmt: (n: number) => string }) {
  return (
    <div><h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">No entries</TableCell></TableRow> : rows.map(r => (<TableRow key={r.code}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell className="text-sm">{r.name}</TableCell><TableCell className="text-right">{fmt(r.amount)}</TableCell></TableRow>))}</TableBody>
      </Table>
      <div className="mt-1 flex justify-end"><div className="w-48 flex justify-between border-t pt-1 text-sm font-medium"><span>Total:</span><span>{fmt(total)}</span></div></div>
    </div>
  );
}
