"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users } from "lucide-react";

interface Employee { id: string; employeeNumber: string; fullName: string; department: string | null; jobTitle: string | null; baseSalary: number; employmentStatus: string; employmentType: string; orgNode: { name: string; code: string } | null }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { active: "default", on_leave: "outline", suspended: "destructive", terminated: "secondary" };

export default function EmployeesListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await fetch(`/api/hr/employees?${params}`);
      if (res.ok) { const d = await res.json(); setEmployees(d.employees ?? []); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Employees</h1><p className="text-sm text-muted-foreground">Staff directory with Ethiopian compliance fields</p></div><Button asChild><Link href="/dashboard/hr/employees/new"><Plus className="mr-2 h-4 w-4" /> New Employee</Link></Button></div>
      <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, employee #, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></div></CardContent></Card>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : employees.length === 0 ? (
        <div className="py-12 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No employees yet</p><Button asChild className="mt-4"><Link href="/dashboard/hr/employees/new"><Plus className="mr-2 h-4 w-4" /> Add Employee</Link></Button></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Emp #</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Title</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Base Salary</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{employees.map(e => (<TableRow key={e.id}><TableCell className="font-mono text-xs">{e.employeeNumber}</TableCell><TableCell className="font-medium">{e.fullName}</TableCell><TableCell className="text-xs">{e.department ?? "—"}</TableCell><TableCell className="text-xs">{e.jobTitle ?? "—"}</TableCell><TableCell className="text-xs">{e.orgNode?.name ?? "—"}</TableCell><TableCell className="text-right">{fmtETB(e.baseSalary)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{e.employmentType}</Badge></TableCell><TableCell><Badge variant={statusColors[e.employmentStatus] ?? "outline"} className="text-xs">{e.employmentStatus}</Badge></TableCell></TableRow>))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
