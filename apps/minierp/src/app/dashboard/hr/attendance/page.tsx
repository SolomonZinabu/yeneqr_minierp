"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CalendarDays } from "lucide-react";
import { toast } from "sonner";

interface AttendanceRecord { id: string; date: string; workedHours: number; otHoursRegular: number; otHoursRest: number; otHoursPublic: number; status: string; notes: string | null; employee: { id: string; employeeNumber: string; fullName: string; department: string | null } }
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { dateStyle: "medium" });

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<{ id: string; fullName: string; employeeNumber: string }[]>([]);
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [worked, setWorked] = useState(8);
  const [otReg, setOtReg] = useState(0);
  const [otRest, setOtRest] = useState(0);
  const [otPub, setOtPub] = useState(0);
  const [status, setStatus] = useState("present");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/hr/attendance?limit=100").then(r => r.json()), fetch("/api/hr/employees").then(r => r.json())])
      .then(([a, e]) => { setRecords(a.records ?? []); setEmployees(e.employees ?? []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hr/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: empId, date: new Date(date).toISOString(), workedHours: Number(worked), otHoursRegular: Number(otReg), otHoursRest: Number(otRest), otHoursPublic: Number(otPub), status }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Attendance recorded");
      const fresh = await fetch("/api/hr/attendance?limit=100").then(r => r.json());
      setRecords(fresh.records ?? []); setOtReg(0); setOtRest(0); setOtPub(0);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Attendance</h1><p className="text-sm text-muted-foreground">Daily check-in / out + overtime hours (day / rest / public holiday)</p></div>
      <Card><CardHeader><CardTitle className="text-sm">Record Attendance</CardTitle></CardHeader><CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-7 items-end">
          <div className="md:col-span-2"><Label className="text-xs">Employee</Label><select required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={empId} onChange={(e) => setEmpId(e.target.value)}><option value="">Select...</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.employeeNumber} — {emp.fullName}</option>)}</select></div>
          <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">Worked Hrs</Label><Input type="number" step="0.5" min="0" value={worked} onChange={(e) => setWorked(parseFloat(e.target.value) || 0)} /></div>
          <div><Label className="text-xs">OT Day</Label><Input type="number" step="0.5" min="0" value={otReg} onChange={(e) => setOtReg(parseFloat(e.target.value) || 0)} /></div>
          <div><Label className="text-xs">OT Rest</Label><Input type="number" step="0.5" min="0" value={otRest} onChange={(e) => setOtRest(parseFloat(e.target.value) || 0)} /></div>
          <div><Label className="text-xs">OT Public</Label><Input type="number" step="0.5" min="0" value={otPub} onChange={(e) => setOtPub(parseFloat(e.target.value) || 0)} /></div>
          <div className="md:col-span-6"><Label className="text-xs">Status</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option><option value="holiday">Holiday</option><option value="rest_day">Rest Day</option></select></div>
          <div><Button type="submit" disabled={saving} className="w-full"><Plus className="mr-2 h-4 w-4" /> Save</Button></div>
        </form>
      </CardContent></Card>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : records.length === 0 ? (
        <div className="py-12 text-center"><CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No attendance records yet</p></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Dept</TableHead><TableHead className="text-right">Worked</TableHead><TableHead className="text-right">OT Day</TableHead><TableHead className="text-right">OT Rest</TableHead><TableHead className="text-right">OT Public</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{records.map(r => (<TableRow key={r.id}><TableCell className="text-xs">{fmtDate(r.date)}</TableCell><TableCell className="text-sm font-medium">{r.employee.fullName}</TableCell><TableCell className="text-xs">{r.employee.department ?? "—"}</TableCell><TableCell className="text-right">{r.workedHours}</TableCell><TableCell className="text-right">{r.otHoursRegular || "—"}</TableCell><TableCell className="text-right">{r.otHoursRest || "—"}</TableCell><TableCell className="text-right">{r.otHoursPublic || "—"}</TableCell><TableCell><Badge variant="outline" className="text-xs capitalize">{r.status}</Badge></TableCell></TableRow>))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
