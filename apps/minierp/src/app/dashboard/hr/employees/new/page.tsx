"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

interface OrgNode { id: string; name: string; code: string }

export default function NewEmployeePage() {
  const router = useRouter();
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", gender: "", dateOfBirth: "", idNumber: "", tinNumber: "", pensionNumber: "", phone: "", email: "", address: "", emergencyContact: "", emergencyPhone: "", hireDate: new Date().toISOString().slice(0, 10), employmentType: "permanent", jobTitle: "", department: "", baseSalary: 0, bankAccount: "", bankName: "", taxExemptionAmount: 0, allowsOvertime: false, orgNodeId: "" });

  useEffect(() => { fetch("/api/org-nodes").then(r => r.json()).then(d => setOrgNodes(d.nodes ?? [])).catch(() => {}); }, []);
  const update = (k: string, v: string | number | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/hr/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, gender: form.gender || null, dateOfBirth: form.dateOfBirth || null, idNumber: form.idNumber || null, tinNumber: form.tinNumber || null, pensionNumber: form.pensionNumber || null, phone: form.phone || null, email: form.email || null, address: form.address || null, emergencyContact: form.emergencyContact || null, emergencyPhone: form.emergencyPhone || null, jobTitle: form.jobTitle || null, department: form.department || null, bankAccount: form.bankAccount || null, bankName: form.bankName || null, orgNodeId: form.orgNodeId || null, hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : undefined, baseSalary: Number(form.baseSalary) || 0, taxExemptionAmount: Number(form.taxExemptionAmount) || 0 }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Employee created"); router.push("/dashboard/hr/employees");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">New Employee</h1><p className="text-sm text-muted-foreground">Add a new employee to the payroll</p></div><Button asChild variant="outline"><Link href="/dashboard/hr/employees"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card><CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
          <div><Label>First Name *</Label><Input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></div>
          <div><Label>Middle Name</Label><Input value={form.middleName} onChange={(e) => update("middleName", e.target.value)} /></div>
          <div><Label>Last Name *</Label><Input required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></div>
          <div><Label>Gender</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="">—</option><option value="male">Male</option><option value="female">Female</option></select></div>
          <div><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} /></div>
          <div><Label>National ID</Label><Input value={form.idNumber} onChange={(e) => update("idNumber", e.target.value)} /></div>
          <div><Label>TIN</Label><Input value={form.tinNumber} onChange={(e) => update("tinNumber", e.target.value)} /></div>
          <div><Label>Pension Number</Label><Input value={form.pensionNumber} onChange={(e) => update("pensionNumber", e.target.value)} /></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
          <div><Label>Emergency Contact</Label><Input value={form.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} /></div>
          <div><Label>Emergency Phone</Label><Input value={form.emergencyPhone} onChange={(e) => update("emergencyPhone", e.target.value)} /></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Employment</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
          <div><Label>Hire Date *</Label><Input type="date" required value={form.hireDate} onChange={(e) => update("hireDate", e.target.value)} /></div>
          <div><Label>Employment Type</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="casual">Casual</option><option value="intern">Intern</option></select></div>
          <div><Label>Job Title</Label><Input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} /></div>
          <div><Label>Department</Label><Input placeholder="Kitchen, Service, Management..." value={form.department} onChange={(e) => update("department", e.target.value)} /></div>
          <div><Label>Branch</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.orgNodeId} onChange={(e) => update("orgNodeId", e.target.value)}><option value="">Select...</option>{orgNodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)}</select></div>
          <div><Label>Base Salary (ETB/month)</Label><Input type="number" step="0.01" min="0" value={form.baseSalary} onChange={(e) => update("baseSalary", parseFloat(e.target.value) || 0)} /></div>
          <div><Label>Tax Exemption Amount</Label><Input type="number" step="0.01" min="0" value={form.taxExemptionAmount} onChange={(e) => update("taxExemptionAmount", parseFloat(e.target.value) || 0)} /></div>
          <div className="flex items-end gap-2"><input id="allowsOvertime" type="checkbox" className="h-4 w-4" checked={form.allowsOvertime} onChange={(e) => update("allowsOvertime", e.target.checked)} /><Label htmlFor="allowsOvertime" className="text-sm font-normal">Eligible for overtime</Label></div>
          <div><Label>Bank Name</Label><Input value={form.bankName} onChange={(e) => update("bankName", e.target.value)} /></div>
          <div><Label>Bank Account</Label><Input value={form.bankAccount} onChange={(e) => update("bankAccount", e.target.value)} /></div>
        </CardContent></Card>
        <div className="flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/hr/employees">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Employee"}</Button></div>
      </form>
    </div>
  );
}
