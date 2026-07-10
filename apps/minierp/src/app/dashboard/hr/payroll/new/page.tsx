"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function NewPayrollRunPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [period, setPeriod] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(lastOfMonth.toISOString().slice(0, 10));
  const [payDate, setPayDate] = useState(lastOfMonth.toISOString().slice(0, 10));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/hr/payroll/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, startDate: new Date(startDate).toISOString(), endDate: new Date(endDate).toISOString(), payDate: new Date(payDate).toISOString() }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      const data = await res.json(); toast.success(`Payroll ${data.run.runNumber} calculated for ${data.run.employeeCount} employees`); router.push("/dashboard/hr/payroll");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Run Payroll</h1><p className="text-sm text-muted-foreground">Calculates PIT, pension, and OT for all active employees</p></div><Button asChild variant="outline"><Link href="/dashboard/hr/payroll"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <Card><CardHeader><CardTitle className="text-sm">Payroll Period</CardTitle></CardHeader><CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="period">Period (YYYY-MM) *</Label><Input id="period" required pattern="\d{4}-\d{2}" placeholder="2026-07" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
          <div></div>
          <div><Label htmlFor="startDate">Period Start *</Label><Input id="startDate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><Label htmlFor="endDate">Period End *</Label><Input id="endDate" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div><Label htmlFor="payDate">Pay Date *</Label><Input id="payDate" type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
          <div></div>
          <div className="md:col-span-2 rounded-md bg-blue-50 p-3 text-xs text-blue-700"><p className="font-medium">What happens next?</p><ul className="mt-1 space-y-0.5"><li>• Pulls all active employees + their attendance for the period</li><li>• Calculates gross, taxable income, PIT, pension (EE + ER), and net pay</li><li>• Saves a PayrollRun in <code>calculated</code> status</li><li>• After review, approve to post the GL entry (Dr Salaries + Dr Pension ER / Cr PIT + Cr Pension + Cr Salary Payable)</li></ul></div>
          <div className="md:col-span-2 flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/hr/payroll">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Calculating..." : "Calculate Payroll"}</Button></div>
        </form>
      </CardContent></Card>
    </div>
  );
}
